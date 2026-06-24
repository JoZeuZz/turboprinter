import os
from collections.abc import Callable

import streamlit as st

from app.config import config
from app.models.schema import VideoAspect, VideoConcatMode, VideoTransitionMode
from app.utils import utils


Translator = Callable[[str], str]


def render_video_settings_section(params, tr: Translator):
    uploaded_files = []
    with st.container(border=True):
        st.write(tr("Video Settings"))
        _render_video_source(params, tr)
        uploaded_files = _render_local_source_inputs(params, tr)
        _render_video_modes(params, tr)
        _render_clip_and_count(params, tr)
        _render_advanced_video_settings(params, tr)
    return uploaded_files


def _render_video_source(params, tr: Translator) -> None:
    video_sources = [
        (tr("Pexels"), "pexels"),
        (tr("Pixabay"), "pixabay"),
        (tr("Coverr"), "coverr"),
        (tr("Local file"), "local"),
        (tr("Local Folder"), "local_folder"),
    ]
    saved_video_source_name = config.app.get("video_source", "pexels")
    saved_video_source_names = [item[1] for item in video_sources]
    if saved_video_source_name not in saved_video_source_names:
        saved_video_source_name = "pexels"
    saved_video_source_index = saved_video_source_names.index(saved_video_source_name)

    selected_index = st.selectbox(
        tr("Video Source"),
        options=range(len(video_sources)),
        format_func=lambda index: video_sources[index][0],
        index=saved_video_source_index,
    )
    params.video_source = video_sources[selected_index][1]
    config.app["video_source"] = params.video_source


def _render_local_source_inputs(params, tr: Translator):
    uploaded_files = []
    if params.video_source == "local":
        local_file_types = ["mp4", "mov", "avi", "flv", "mkv", "jpg", "jpeg", "png"]
        uploaded_files = st.file_uploader(
            tr("Upload Local Files"),
            type=local_file_types + [file_type.upper() for file_type in local_file_types],
            accept_multiple_files=True,
        )

    if params.video_source == "local_folder":
        local_folder_path = utils.storage_dir("local_videos", create=True)
        folder_files = []
        for file_name in os.listdir(local_folder_path):
            ext = os.path.splitext(file_name)[1].lower()
            if ext in [".mp4", ".mov", ".avi", ".flv", ".mkv", ".jpg", ".jpeg", ".png"]:
                folder_files.append(file_name)
        folder_files.sort()
        if folder_files:
            st.multiselect(
                tr("Select from Local Videos"),
                options=folder_files,
                default=st.session_state.get("selected_folder_files", []),
                key="selected_folder_files",
            )
        else:
            st.info(
                tr(
                    "No videos found in local directory. Upload files first using 'Local file' source."
                )
            )
    return uploaded_files


def _render_video_modes(params, tr: Translator) -> None:
    video_concat_modes = [
        (tr("Sequential"), "sequential"),
        (tr("Random"), "random"),
    ]
    selected_index = st.selectbox(
        tr("Video Concat Mode"),
        index=1,
        options=range(len(video_concat_modes)),
        format_func=lambda index: video_concat_modes[index][0],
    )
    params.video_concat_mode = VideoConcatMode(video_concat_modes[selected_index][1])

    video_transition_modes = [
        (tr("None"), VideoTransitionMode.none.value),
        (tr("Shuffle"), VideoTransitionMode.shuffle.value),
        (tr("FadeIn"), VideoTransitionMode.fade_in.value),
        (tr("FadeOut"), VideoTransitionMode.fade_out.value),
        (tr("SlideIn"), VideoTransitionMode.slide_in.value),
        (tr("SlideOut"), VideoTransitionMode.slide_out.value),
    ]
    selected_index = st.selectbox(
        tr("Video Transition Mode"),
        options=range(len(video_transition_modes)),
        format_func=lambda index: video_transition_modes[index][0],
        index=0,
    )
    params.video_transition_mode = VideoTransitionMode(
        video_transition_modes[selected_index][1]
    )

    video_aspect_ratios = [
        (tr("Portrait"), VideoAspect.portrait.value),
        (tr("Landscape"), VideoAspect.landscape.value),
    ]
    default_aspect_index = 1 if params.video_source == "coverr" else 0
    selected_index = st.selectbox(
        tr("Video Ratio"),
        options=range(len(video_aspect_ratios)),
        format_func=lambda index: video_aspect_ratios[index][0],
        index=default_aspect_index,
        key=f"video_aspect_for_{params.video_source}",
    )
    params.video_aspect = VideoAspect(video_aspect_ratios[selected_index][1])


def _render_clip_and_count(params, tr: Translator) -> None:
    saved_clip_dur = config.app.get("video_clip_duration", 5)
    clip_dur_options = [2, 3, 4, 5, 6, 7, 8, 9, 10]
    clip_dur_index = 1
    if saved_clip_dur in clip_dur_options:
        clip_dur_index = clip_dur_options.index(saved_clip_dur)
    params.video_clip_duration = st.selectbox(
        tr("Clip Duration"),
        options=clip_dur_options,
        index=clip_dur_index,
    )

    saved_video_count = config.app.get("video_count", 1)
    video_count_options = [1, 2, 3, 4, 5]
    video_count_index = 0
    if saved_video_count in video_count_options:
        video_count_index = video_count_options.index(saved_video_count)
    params.video_count = st.selectbox(
        tr("Number of Videos Generated Simultaneously"),
        options=video_count_options,
        index=video_count_index,
    )


def _render_advanced_video_settings(params, tr: Translator) -> None:
    with st.expander(tr("Advanced Video Settings"), expanded=False):
        params.match_materials_to_script = st.checkbox(
            tr("Match Materials to Script Order"),
            help=tr("Match Materials to Script Order Help"),
            key="match_materials_to_script",
        )
        config.app["match_materials_to_script"] = params.match_materials_to_script

        video_codec_options = [
            ("libx264 (CPU)", "libx264"),
            ("NVIDIA NVENC (h264_nvenc)", "h264_nvenc"),
            ("AMD AMF (h264_amf)", "h264_amf"),
            ("Intel QSV (h264_qsv)", "h264_qsv"),
            ("Windows MediaFoundation (h264_mf)", "h264_mf"),
            ("macOS VideoToolbox (h264_videotoolbox)", "h264_videotoolbox"),
        ]
        saved_video_codec = config.app.get("video_codec", "libx264")
        saved_video_codec_values = [item[1] for item in video_codec_options]
        if saved_video_codec not in saved_video_codec_values:
            saved_video_codec = "libx264"
        selected_codec_index = saved_video_codec_values.index(saved_video_codec)
        selected_codec_index = st.selectbox(
            tr("Video Encoder"),
            options=range(len(video_codec_options)),
            index=selected_codec_index,
            format_func=lambda index: video_codec_options[index][0],
            help=tr("Video Encoder Help"),
        )
        config.app["video_codec"] = video_codec_options[selected_codec_index][1]
