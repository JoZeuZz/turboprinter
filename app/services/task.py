import math
import os.path
import re
from os import path

from loguru import logger

from app.config import config
from app.models import const
from app.models.schema import VideoAspect, VideoConcatMode, VideoParams
from app.services import llm, material, subtitle, video, voice, upload_post
from app.services import state as sm
from app.services.quality import settings as quality_settings
from app.utils import file_security, utils


def generate_script(task_id, params):
    logger.info("\n\n## generating video script")
    video_script = params.video_script.strip()
    if not video_script:
        video_script = llm.generate_script(
            video_subject=params.video_subject,
            language=params.video_language,
            paragraph_number=params.paragraph_number,
            video_script_prompt=params.video_script_prompt,
            custom_system_prompt=params.custom_system_prompt,
        )
    else:
        logger.debug(f"video script: \n{video_script}")

    if not video_script:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        logger.error("failed to generate video script.")
        return None

    return video_script


def generate_terms(task_id, params, video_script):
    logger.info("\n\n## generating video terms")
    video_terms = params.video_terms
    if not video_terms:
        # 开启素材按文案顺序匹配后，关键词本身也必须按脚本叙事顺序生成；
        # 否则后续即使顺序下载和顺序拼接，也只能复用一组全局主题词，
        # 无法改善“后面内容的画面提前出现”的问题。
        video_terms = llm.generate_terms(
            video_subject=params.video_subject,
            video_script=video_script,
            amount=8 if params.match_materials_to_script else 5,
            match_script_order=params.match_materials_to_script,
        )
    else:
        if isinstance(video_terms, str):
            video_terms = [term.strip() for term in re.split(r"[,，]", video_terms)]
        elif isinstance(video_terms, list):
            video_terms = [term.strip() for term in video_terms]
        else:
            raise ValueError("video_terms must be a string or a list of strings.")

        logger.debug(f"video terms: {utils.to_json(video_terms)}")

    if not video_terms:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        logger.error("failed to generate video terms.")
        return None

    return video_terms


def save_script_data(task_id, video_script, video_terms, params):
    script_file = path.join(utils.task_dir(task_id), "script.json")
    script_data = {
        "script": video_script,
        "search_terms": video_terms,
        "params": params,
    }

    with open(script_file, "w", encoding="utf-8") as f:
        f.write(utils.to_json(script_data))


def resolve_custom_audio_file(task_id: str, custom_audio_file: str | None) -> str:
    requested_file = (custom_audio_file or "").strip()
    if not requested_file:
        return ""

    task_dir = utils.task_dir(task_id)
    try:
        return file_security.resolve_path_within_directory(
            task_dir,
            requested_file,
        )
    except ValueError as exc:
        task_dir_error = exc

    server_audio_file = path.realpath(
        requested_file
        if path.isabs(requested_file)
        else path.join(utils.root_dir(), requested_file)
    )
    if not path.isabs(requested_file):
        project_root = path.realpath(utils.root_dir())
        try:
            if path.commonpath([project_root, server_audio_file]) != project_root:
                raise ValueError(
                    "relative custom audio paths must stay within the project directory"
                )
        except ValueError as exc:
            raise ValueError(
                "custom audio file must be task-local or an existing server-side file"
            ) from exc

    if not path.isfile(server_audio_file):
        raise ValueError(
            "custom audio file does not exist or is not a file"
        ) from task_dir_error

    return server_audio_file


def generate_audio(task_id, params, video_script):
    '''
    Generate audio for the video script.
    If a custom audio file is provided, it will be used directly.
    There will be no subtitle maker object returned in this case.
    Otherwise, TTS will be used to generate the audio.
    Returns:
        - audio_file: path to the generated or provided audio file
        - audio_duration: duration of the audio in seconds
        - sub_maker: subtitle maker object if TTS is used, None otherwise
    '''
    logger.info("\n\n## generating audio")
    # /audio 和 /subtitle 请求模型不包含 custom_audio_file，
    # 这里统一做兼容读取，避免直调接口时抛属性错误。
    requested_custom_audio_file = getattr(params, "custom_audio_file", None)
    try:
        custom_audio_file = resolve_custom_audio_file(
            task_id, requested_custom_audio_file
        )
    except ValueError as exc:
        logger.error(
            "custom audio file is invalid, "
            f"task_id: {task_id}, path: {requested_custom_audio_file}, error: {str(exc)}"
        )
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return None, None, None

    if not custom_audio_file:
        logger.info("no custom audio file provided, using TTS to generate audio.")
        audio_file = path.join(utils.task_dir(task_id), "audio.mp3")
        sub_maker = voice.tts(
            text=video_script,
            voice_name=voice.parse_voice_name(params.voice_name),
            voice_rate=params.voice_rate,
            voice_file=audio_file,
        )
        if sub_maker is None:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error(
                """failed to generate audio:
1. check if the language of the voice matches the language of the video script.
2. check if the network is available. If you are in China, it is recommended to use a VPN and enable the global traffic mode.
            """.strip()
            )
            return None, None, None
        audio_duration = math.ceil(voice.get_audio_duration(sub_maker))
        if audio_duration == 0:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error("failed to get audio duration.")
            return None, None, None
        return audio_file, audio_duration, sub_maker
    else:
        logger.info(f"using custom audio file: {custom_audio_file}")
        audio_duration = voice.get_audio_duration(custom_audio_file)
        if audio_duration == 0:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error("failed to get audio duration from custom audio file.")
            return None, None, None
        return custom_audio_file, audio_duration, None

def generate_subtitle(task_id, params, video_script, sub_maker, audio_file):
    '''
    Generate subtitle for the video script.
    If subtitle generation is disabled or no subtitle maker is provided, it will return an empty string.
    Otherwise, it will generate the subtitle using the specified provider.
    Returns:
        - subtitle_path: path to the generated subtitle file
    '''
    logger.info("\n\n## generating subtitle")
    if not params.subtitle_enabled or sub_maker is None:
        return ""

    subtitle_path = path.join(utils.task_dir(task_id), "subtitle.srt")
    subtitle_provider = config.app.get("subtitle_provider", "edge").strip().lower()
    logger.info(f"\n\n## generating subtitle, provider: {subtitle_provider}")

    subtitle_fallback = False
    if subtitle_provider == "edge":
        voice.create_subtitle(
            text=video_script, sub_maker=sub_maker, subtitle_file=subtitle_path
        )
        if not os.path.exists(subtitle_path):
            subtitle_fallback = True
            logger.warning("subtitle file not found, fallback to whisper")

    if subtitle_provider == "whisper" or subtitle_fallback:
        subtitle.create(audio_file=audio_file, subtitle_file=subtitle_path)
        logger.info("\n\n## correcting subtitle")
        subtitle.correct(subtitle_file=subtitle_path, video_script=video_script)

    subtitle_lines = subtitle.file_to_subtitles(subtitle_path)
    if not subtitle_lines:
        logger.warning(f"subtitle file is invalid: {subtitle_path}")
        return ""

    return subtitle_path


def _select_local_library_materials(params, quality_settings_obj, audio_duration=0.0):
    """Return ``(paths, covers)`` of prioritized local-library video materials.

    ``paths`` are ranked local video paths filtered to files that still exist;
    ``covers`` is True when their usable duration already meets ``audio_duration``
    (so the caller can skip downloading stock entirely). Returns ``([], False)``
    unless the quality stack is enabled with ``prefer_local_assets`` and a
    library database exists. Any failure degrades to ``([], False)`` so the stock
    pipeline keeps working.
    """
    if not (
        quality_settings_obj
        and getattr(quality_settings_obj, "enabled", False)
        and getattr(quality_settings_obj, "prefer_local_assets", False)
    ):
        return [], False
    try:
        from app.services.quality import local_library, material_ranker

        db_path = path.join(
            utils.storage_dir("local_library", create=True), "library.db"
        )
        if not path.isfile(db_path):
            return [], False

        aspect = VideoAspect(params.video_aspect)
        target_width, target_height = aspect.to_resolution()
        context = material_ranker.RankContext(
            target_width=target_width,
            target_height=target_height,
            target_orientation=aspect.name,
            min_useful_duration=max(1.0, float(params.video_clip_duration) / 2.0),
        )
        conn = local_library.connect(db_path)
        try:
            entries = local_library.select_pipeline_entries(
                conn, quality_settings_obj, context, limit=0
            )
        finally:
            conn.close()

        existing = [e for e in entries if path.isfile(e.path)]
        paths = [e.path for e in existing]
        covers = bool(existing) and local_library.useful_duration(
            existing, params.video_clip_duration
        ) >= float(audio_duration or 0.0)
        if paths:
            logger.info(
                f"local library contributed {len(paths)} prioritized materials"
                f"{' (covers full duration)' if covers else ''}"
            )
        return paths, covers
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"local library selection failed, skipping: {exc}")
        return [], False


def get_video_materials(task_id, params, video_terms, audio_duration):
    if params.video_source == "local":
        logger.info("\n\n## preprocess local materials")
        materials = video.preprocess_video(
            materials=params.video_materials, clip_duration=params.video_clip_duration
        )
        if not materials:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error(
                "no valid materials found, please check the materials and try again."
            )
            return None
        return [material_info.url for material_info in materials]
    else:
        logger.info(f"\n\n## downloading videos from {params.video_source}")
        # Optional quality material ranking. Returns disabled settings (or None
        # on error) when the quality stack is off, leaving upstream selection.
        try:
            qs = quality_settings.current_quality_settings(params)
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug(f"quality settings unavailable for material ranking: {exc}")
            qs = None
        # Prioritize the user's local library (Fase 6). If the indexed clips
        # already cover the required duration, skip the stock download entirely.
        required_duration = audio_duration * params.video_count
        local_videos, local_covers = _select_local_library_materials(
            params, qs, required_duration
        )
        if local_covers and local_videos:
            logger.info(
                "local library covers the required duration; skipping stock download"
            )
            return local_videos

        # 顺序匹配模式只在用户显式开启时生效。这里强制素材下载按关键词顺序
        # 轮询，避免某个早期关键词下载太多素材，把后续脚本主题挤出最终时间线。
        downloaded_videos = material.download_videos(
            task_id=task_id,
            search_terms=video_terms,
            source=params.video_source,
            video_aspect=params.video_aspect,
            video_concat_mode=(
                VideoConcatMode.sequential
                if params.match_materials_to_script
                else params.video_concat_mode
            ),
            audio_duration=required_duration,
            max_clip_duration=params.video_clip_duration,
            match_script_order=params.match_materials_to_script,
            quality_settings=qs,
        )
        # combine_videos consumes materials in order and stops once the audio
        # duration is covered, so local assets are used first and stock fills
        # any remainder.
        downloaded_videos = downloaded_videos or []
        combined_videos = local_videos + [
            v for v in downloaded_videos if v not in local_videos
        ]
        if not combined_videos:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            logger.error(
                "failed to download videos, maybe the network is not available. if you are in China, please use a VPN."
            )
            return None
        return combined_videos


def generate_final_videos(
    task_id, params, downloaded_videos, audio_file, subtitle_path
):
    final_video_paths = []
    combined_video_paths = []
    # 多视频生成默认会打散素材以增加差异；但“按文案顺序匹配素材”追求的是
    # 时间线稳定性和可解释性，所以开启后所有输出都使用顺序拼接。
    if params.match_materials_to_script:
        video_concat_mode = VideoConcatMode.sequential
    elif params.video_count == 1:
        video_concat_mode = params.video_concat_mode
    else:
        video_concat_mode = VideoConcatMode.random
    video_transition_mode = params.video_transition_mode

    # Resolve the optional quality render profile once per task. Returns None
    # (upstream behaviour) when the quality stack is disabled.
    render_profile = video.resolve_render_profile(params)

    _progress = 50
    for i in range(params.video_count):
        index = i + 1
        combined_video_path = path.join(
            utils.task_dir(task_id), f"combined-{index}.mp4"
        )
        logger.info(f"\n\n## combining video: {index} => {combined_video_path}")
        video.combine_videos(
            combined_video_path=combined_video_path,
            video_paths=downloaded_videos,
            audio_file=audio_file,
            video_aspect=params.video_aspect,
            video_concat_mode=video_concat_mode,
            video_transition_mode=video_transition_mode,
            max_clip_duration=params.video_clip_duration,
            threads=params.n_threads,
            render_profile=render_profile,
        )

        _progress += 50 / params.video_count / 2
        sm.state.update_task(task_id, progress=_progress)

        final_video_path = path.join(utils.task_dir(task_id), f"final-{index}.mp4")

        logger.info(f"\n\n## generating video: {index} => {final_video_path}")
        video.generate_video(
            video_path=combined_video_path,
            audio_path=audio_file,
            subtitle_path=subtitle_path,
            output_file=final_video_path,
            params=params,
        )

        _progress += 50 / params.video_count / 2
        sm.state.update_task(task_id, progress=_progress)

        final_video_paths.append(final_video_path)
        combined_video_paths.append(combined_video_path)

    return final_video_paths, combined_video_paths


def maybe_save_word_timestamps(task_id, params, audio_file, sub_maker):
    """Save per-word timestamps when word-highlight (karaoke) is enabled.

    Uses the TTS adapter: first tries the provider's own word boundaries from
    ``sub_maker``; if absent, falls back to Whisper alignment (reusing the
    already-shipped faster-whisper dependency). Writes ``word_timestamps.json``
    to the task dir and returns its path, or "" when disabled/unavailable.
    Never aborts the pipeline; karaoke cleanly falls back to phrase subtitles.
    """
    try:
        qs = quality_settings.current_quality_settings(params)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug(f"quality settings unavailable for word timestamps: {exc}")
        return ""
    if not (getattr(qs, "enabled", False) and getattr(qs, "word_highlight", False)):
        return ""
    if not audio_file:
        return ""

    try:
        from app.services.quality import tts_adapter

        result = tts_adapter.build_tts_result(
            audio_file=audio_file,
            duration=0.0,
            provider="pipeline",
            word_timestamps=tts_adapter.extract_word_timestamps_from_submaker(sub_maker)
            or None,
        )
        if not tts_adapter.has_word_timestamps(result):
            aligner = tts_adapter.make_faster_whisper_aligner(
                model_size=config.whisper.get("model_size", "large-v3"),
                device=config.whisper.get("device", "cpu"),
                compute_type=config.whisper.get("compute_type", "int8"),
                language=(params.video_language or None),
            )
            result = tts_adapter.ensure_word_timestamps(
                result, audio_file, aligner=aligner
            )
        if not tts_adapter.has_word_timestamps(result):
            logger.info(
                "no word timestamps available; karaoke falls back to phrase subtitles"
            )
            return ""

        out_path = path.join(utils.task_dir(task_id), "word_timestamps.json")
        with open(out_path, "w", encoding="utf-8") as fp:
            fp.write(
                utils.to_json(
                    [
                        {"word": w.word, "start": w.start, "end": w.end}
                        for w in result.word_timestamps
                    ]
                )
            )
        logger.success(
            f"word timestamps saved: {out_path} ({len(result.word_timestamps)} words)"
        )
        return out_path
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"failed to compute word timestamps: {exc}")
        return ""


def generate_content_package(task_id, params, video_script, video_terms):
    """Generate and save the Spanish Content Package sidecar when enabled.

    Deterministic and LLM-free: works with a manually pasted script. Writes
    ``content_package.json`` and ``content_package.md`` into the task dir and
    returns the JSON path (or "" when disabled / on failure). Never aborts the
    main pipeline.
    """
    try:
        qs = quality_settings.current_quality_settings(params)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug(f"quality settings unavailable for content package: {exc}")
        return ""
    if not (getattr(qs, "enabled", False) and getattr(qs, "content_package", False)):
        return ""

    try:
        from app.services.quality import content_package as cp

        terms = video_terms
        if isinstance(terms, str):
            terms = [t.strip() for t in re.split(r"[,，]", terms) if t.strip()]
        elif not isinstance(terms, list):
            terms = None

        package = cp.build_content_package(
            subject=params.video_subject or "",
            script=video_script or "",
            keywords=terms or None,
            language=getattr(qs, "language", "es"),
            platform=getattr(qs, "target_platform", "shorts"),
        )

        task_path = utils.task_dir(task_id)
        json_path = path.join(task_path, "content_package.json")
        md_path = path.join(task_path, "content_package.md")
        with open(json_path, "w", encoding="utf-8") as fp:
            fp.write(utils.to_json(cp.package_to_dict(package)))
        with open(md_path, "w", encoding="utf-8") as fp:
            fp.write(cp.package_to_markdown(package))
        logger.success(f"spanish content package saved: {json_path}")
        return json_path
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(f"failed to generate content package: {exc}")
        return ""


def start(task_id, params: VideoParams, stop_at: str = "video"):
    logger.info(f"start task: {task_id}, stop_at: {stop_at}")
    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=5)

    # 1. Generate script
    video_script = generate_script(task_id, params)
    if not video_script or "Error: " in video_script:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=10)

    if stop_at == "script":
        sm.state.update_task(
            task_id, state=const.TASK_STATE_COMPLETE, progress=100, script=video_script
        )
        return {"script": video_script}

    # 2. Generate terms
    video_terms = ""
    if params.video_source != "local":
        video_terms = generate_terms(task_id, params, video_script)
        if not video_terms:
            sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
            return

    save_script_data(task_id, video_script, video_terms, params)

    # Optional Spanish Content Package sidecar (deterministic, no LLM required).
    content_package_path = generate_content_package(
        task_id, params, video_script, video_terms
    )

    if stop_at == "terms":
        sm.state.update_task(
            task_id, state=const.TASK_STATE_COMPLETE, progress=100, terms=video_terms
        )
        return {"script": video_script, "terms": video_terms}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=20)

    # 3. Generate audio
    audio_file, audio_duration, sub_maker = generate_audio(
        task_id, params, video_script
    )
    if not audio_file:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=30)

    if stop_at == "audio":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            audio_file=audio_file,
        )
        return {"audio_file": audio_file, "audio_duration": audio_duration}

    # 3.5 Optional per-word timestamps for karaoke/word-highlight (additive
    # artifact; falls back cleanly when unavailable).
    word_timestamps_path = maybe_save_word_timestamps(
        task_id, params, audio_file, sub_maker
    )

    # 4. Generate subtitle
    subtitle_path = generate_subtitle(
        task_id, params, video_script, sub_maker, audio_file
    )

    if stop_at == "subtitle":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            subtitle_path=subtitle_path,
        )
        return {"subtitle_path": subtitle_path}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=40)

    # 5. Get video materials
    downloaded_videos = get_video_materials(
        task_id, params, video_terms, audio_duration
    )
    if not downloaded_videos:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return

    if stop_at == "materials":
        sm.state.update_task(
            task_id,
            state=const.TASK_STATE_COMPLETE,
            progress=100,
            materials=downloaded_videos,
        )
        return {"materials": downloaded_videos}

    sm.state.update_task(task_id, state=const.TASK_STATE_PROCESSING, progress=50)

    # 仅完整视频生成流程才需要处理视频拼接模式；
    # 这样可以避免 /subtitle 和 /audio 这类请求访问不存在的字段。
    if type(params.video_concat_mode) is str:
        params.video_concat_mode = VideoConcatMode(params.video_concat_mode)

    # 6. Generate final videos
    final_video_paths, combined_video_paths = generate_final_videos(
        task_id, params, downloaded_videos, audio_file, subtitle_path
    )

    if not final_video_paths:
        sm.state.update_task(task_id, state=const.TASK_STATE_FAILED)
        return

    logger.success(
        f"task {task_id} finished, generated {len(final_video_paths)} videos."
    )

    # 7. Cross-post to TikTok/Instagram (if enabled)
    cross_post_results = []
    if upload_post.upload_post_service.is_configured() and upload_post.upload_post_service.auto_upload:
        logger.info("\n\n## cross-posting videos to TikTok/Instagram")
        for video_path in final_video_paths:
            result = upload_post.cross_post_video(
                video_path=video_path,
                title=params.video_subject or "Check out this video! #shorts #viral"
            )
            cross_post_results.append(result)
            if result.get('success'):
                logger.info(f"✅ Cross-posted: {video_path}")
            else:
                logger.warning(f"⚠️ Failed to cross-post: {video_path} - {result.get('error', 'Unknown error')}")

    kwargs = {
        "videos": final_video_paths,
        "combined_videos": combined_video_paths,
        "script": video_script,
        "terms": video_terms,
        "audio_file": audio_file,
        "audio_duration": audio_duration,
        "subtitle_path": subtitle_path,
        "materials": downloaded_videos,
        "cross_post_results": cross_post_results if cross_post_results else None,
        "content_package": content_package_path or None,
        "word_timestamps": word_timestamps_path or None,
    }
    sm.state.update_task(
        task_id, state=const.TASK_STATE_COMPLETE, progress=100, **kwargs
    )
    return kwargs


if __name__ == "__main__":
    task_id = "task_id"
    params = VideoParams(
        video_subject="金钱的作用",
        voice_name="zh-CN-XiaoyiNeural-Female",
        voice_rate=1.0,
    )
    start(task_id, params, stop_at="video")
