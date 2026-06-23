"""Project Editor (Fase 7) — minimal manual timeline review/edit UI.

Consumes the Fase 6 project API. Does not touch the legacy pipeline.
"""
from __future__ import annotations

import os

import streamlit as st

from webui.project_api import ProjectApiClient, ProjectApiError

_AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}


def build_trim_command(track_id: str, item_id: str, start: float, end: float) -> dict:
    return {
        "type": "trim", "track_id": track_id, "item_id": item_id,
        "trim_start_sec": float(start), "trim_end_sec": float(end),
    }


def build_reorder_command(track_id: str, items: list[dict], index: int, direction: str):
    if direction == "up" and index == 0:
        return None
    if direction == "down" and index >= len(items) - 1:
        return None
    neighbor = items[index - 1] if direction == "up" else items[index + 1]
    return {
        "type": "move", "track_id": track_id, "item_id": items[index]["id"],
        "new_start_sec": float(neighbor["start_sec"]),
    }


def build_reorder_commands(track_id: str, items: list[dict], index: int, direction: str) -> list[dict]:
    if direction == "up" and index == 0:
        return []
    if direction == "down" and index >= len(items) - 1:
        return []
    target = index - 1 if direction == "up" else index + 1
    ordered = list(items)
    item = ordered.pop(index)
    ordered.insert(target, item)
    cursor = 0.0
    commands: list[dict] = []
    for current in ordered:
        if abs(float(current.get("start_sec", 0.0)) - cursor) > 0.0001:
            commands.append({
                "type": "move", "track_id": track_id, "item_id": current["id"],
                "new_start_sec": float(cursor),
            })
        cursor += float(current.get("duration_sec", 0.0))
    return commands


def build_set_timing_command(track_id: str, item_id: str, duration: float) -> dict:
    return {
        "type": "set_timing", "track_id": track_id, "item_id": item_id,
        "duration_sec": float(duration),
    }


def build_replace_command(track_id: str, item_id: str, candidate: dict) -> dict:
    return {
        "type": "replace", "track_id": track_id, "item_id": item_id,
        "new_candidate": candidate,
    }


def asset_id_for_local_path(local_path: str | None, preview_assets: list[dict]) -> str | None:
    if not local_path:
        return None
    normalized = local_path.replace("\\", "/")
    for asset in preview_assets:
        asset_id = asset.get("asset_id") or asset.get("path")
        if asset_id and (normalized == asset_id or normalized.endswith(f"/{asset_id}")):
            return asset_id
    return None


def _safe(fn, *args, **kwargs):  # pragma: no cover - thin Streamlit wrapper
    try:
        st.json(fn(*args, **kwargs))
    except ProjectApiError as exc:
        st.error(str(exc))


def _candidate_label(candidate: dict) -> str:
    label = f"{candidate.get('id')} · {candidate.get('provider')}"
    query = candidate.get("query")
    score = candidate.get("score")
    if query:
        label += f" · {query}"
    if score is not None:
        label += f" · score {float(score):.2f}"
    return label


def _format_license(license: dict | None) -> str:
    if license is None:
        return "—"
    if license.get("unknown_or_provider_specific"):
        name = license.get("license_name") or "Custom"
        url = license.get("license_url") or license.get("source_terms_url")
        if url:
            return f"{name} ([ver]({url}))"
        return f"{name} ⚠"
    name = license.get("license_name")
    url = license.get("license_url")
    if name and url:
        return f"{name} ([licencia]({url}))"
    if name:
        return name
    return "—"


def _list_subtitle_styles() -> list[str]:
    """Return available subtitle preset names."""
    from app.services.quality.subtitle_styles import list_subtitle_styles
    return list_subtitle_styles()


def _list_available_fonts(fonts_dir: str) -> list[str]:
    """Return sorted font basenames from fonts_dir."""
    from app.services.quality.subtitle_styles import list_available_fonts
    return list_available_fonts(fonts_dir)


def _gantt_data(tracks: list[dict]) -> list[dict]:
    """Extract Altair-ready rows from video track items."""
    rows: list[dict] = []
    for track in tracks:
        for item in track.get("items") or []:
            start = float(item.get("start_sec") or 0.0)
            duration = float(item.get("duration_sec") or 0.0)
            rows.append({
                "name": item.get("id") or f"clip-{len(rows)}",
                "start": start,
                "end": start + duration,
                "segment_id": item.get("segment_id") or "unknown",
            })
    return rows


def _list_local_songs(songs_dir: str) -> list[str]:
    """Return sorted basenames of audio files in songs_dir."""
    if not os.path.isdir(songs_dir):
        return []
    return sorted(
        entry for entry in os.listdir(songs_dir)
        if os.path.splitext(entry)[1].lower() in _AUDIO_EXT
    )


def _queue(commands: list[dict]) -> None:  # pragma: no cover - Streamlit state wrapper
    if not commands:
        st.info("No hay cambios para guardar.")
        return
    queue_key = st.session_state.get(
        "project_editor_pending_key", "project_editor_pending_commands"
    )
    st.session_state.setdefault(queue_key, []).extend(commands)
    st.success(f"Cambios pendientes: {len(commands)}")


def _render_ui() -> None:  # pragma: no cover - Streamlit UI, validated manually
    st.set_page_config(page_title="Project Editor", page_icon="🎬", layout="wide")
    st.title("Project Editor")
    st.caption("Editor manual simple para Project Mode. Usa API/comandos; no edita JSON a mano.")

    with st.sidebar:
        st.header("Proyecto")
        base_url = st.text_input("API base URL", value=ProjectApiClient().base_url)
        client = ProjectApiClient(base_url=base_url)

        with st.expander("Crear desde guion", expanded=False):
            script = st.text_area("Guion")
            language = st.text_input("Idioma", value="es")
            if st.button("Crear proyecto"):
                try:
                    data = client.create_from_script(script, language)
                    st.session_state["project_id"] = data["project_id"]
                    st.success(f"Creado {data['project_id']}")
                except ProjectApiError as exc:
                    st.error(str(exc))

        project_id = st.text_input("Project ID", value=st.session_state.get("project_id", ""))
        if project_id:
            st.session_state["project_id"] = project_id

    if not project_id:
        st.info("Crea o carga un proyecto para editar.")
        return

    try:
        project_state = client.get_project(project_id)
    except ProjectApiError as exc:
        st.error(str(exc))
        return

    pending_key = f"project_editor_pending_commands:{project_id}"
    st.session_state["project_editor_pending_key"] = pending_key
    pending = st.session_state.setdefault(pending_key, [])
    status_cols = st.columns(4)
    status_cols[0].metric("Guion", "sí" if project_state.get("has_script") else "no")
    status_cols[1].metric("ShotPlan", "sí" if project_state.get("has_shot_plan") else "no")
    status_cols[2].metric("Media", "sí" if project_state.get("has_selected_media") else "no")
    status_cols[3].metric("Timeline", "sí" if project_state.get("has_timeline") else "no")

    action_cols = st.columns(6)
    if action_cols[0].button("Plan"):
        _safe(client.plan, project_id)
    if action_cols[1].button("Buscar media"):
        _safe(client.media_search, project_id)
    if action_cols[2].button("Build timeline"):
        _safe(client.build_timeline, project_id)

    if action_cols[3].button("Validar timeline"):
        _safe(client.validate_timeline, project_id)
    if action_cols[4].button("Guardar cambios", disabled=not pending):
        try:
            st.json(client.apply_commands(project_id, pending))
            pending.clear()
            st.rerun()
        except ProjectApiError as exc:
            st.error(str(exc))
    if action_cols[5].button("Descartar pendientes", disabled=not pending):
        pending.clear()
        st.rerun()

    if pending:
        st.warning(f"{len(pending)} comandos pendientes de guardar")
        with st.expander("Ver comandos pendientes"):
            st.json(pending)

    render_cols = st.columns(5)
    renderer = render_cols[0].selectbox("Renderer", ["preservar", "moviepy", "opencut"])
    include_subtitles = render_cols[1].checkbox("Subtítulos", value=True)
    include_music = render_cols[2].checkbox("Música", value=True)
    if render_cols[3].button("Renderizar timeline"):
        render_kwargs = {
            "include_subtitles": include_subtitles,
            "include_background_music": include_music,
        }
        if renderer != "preservar":
            render_kwargs["renderer"] = renderer
        if st.session_state.get("_render_subtitle_style"):
            render_kwargs["subtitle_style"] = st.session_state["_render_subtitle_style"]
        if st.session_state.get("_render_font_name"):
            render_kwargs["font_name"] = st.session_state["_render_font_name"]
        _safe(
            client.render,
            project_id,
            **render_kwargs,
        )
    if render_cols[4].button("Estado render"):
        try:
            st.json(client.render_status(project_id))
        except ProjectApiError as exc:
            st.error(str(exc))

    with st.expander("Opciones de subtítulos"):
        from app.utils.utils import font_dir as _font_dir
        _style_opts = ["(config)"] + _list_subtitle_styles()
        _font_opts = ["(config)"] + _list_available_fonts(_font_dir())
        sub_style_cols = st.columns(2)
        chosen_style = sub_style_cols[0].selectbox("Estilo subtítulos", _style_opts)
        chosen_font = sub_style_cols[1].selectbox("Fuente", _font_opts)
        if chosen_style != "(config)":
            st.session_state["_render_subtitle_style"] = chosen_style
        else:
            st.session_state.pop("_render_subtitle_style", None)
        if chosen_font != "(config)":
            st.session_state["_render_font_name"] = chosen_font
        else:
            st.session_state.pop("_render_font_name", None)
        if chosen_style != "(config)":
            st.caption(f"Estilo activo: `{chosen_style}`")
        if chosen_font != "(config)":
            st.caption(f"Fuente activa: `{chosen_font}`")

    script_text = project_state.get("script") or ""
    shot_plan = project_state.get("shot_plan") or {}
    timeline = project_state.get("timeline") or {}
    media_candidates = project_state.get("media_candidates") or []
    selected_music = project_state.get("selected_music") or []
    preview_assets = project_state.get("preview_assets") or []
    candidates_by_id = {c.get("id"): c for c in media_candidates if c.get("id")}

    tab_script, tab_plan, tab_timeline, tab_music = st.tabs([
        "Guion", "ShotPlan", "Timeline", "Música",
    ])

    with tab_script:
        st.text_area("Guion", value=script_text, height=260, disabled=True)

    with tab_plan:
        segments = shot_plan.get("segments") or []
        if not segments:
            st.info("Aún no hay ShotPlan.")
        for segment in segments:
            with st.expander(f"{segment.get('order')} · {segment.get('id')} · {segment.get('visual_goal')}"):
                st.write(segment.get("narration_text"))
                st.caption(f"Duración objetivo: {segment.get('target_duration_sec')}s")
                st.write("Queries:", segment.get("search_queries") or [])
                st.write("Fallback:", segment.get("fallback_queries") or [])

    with tab_timeline:
        tracks = timeline.get("tracks") or []
        video_tracks = [t for t in tracks if t.get("type") == "video"]
        if not video_tracks:
            st.info("Aún no hay timeline de video.")
        else:
            gantt_rows = _gantt_data(video_tracks)
            if gantt_rows:
                with st.expander("Visualización temporal", expanded=True):
                    try:
                        import altair as alt
                        import pandas as pd

                        df = pd.DataFrame(gantt_rows)
                        chart = (
                            alt.Chart(df)
                            .mark_bar()
                            .encode(
                                x=alt.X("start:Q", title="segundos"),
                                x2="end:Q",
                                y=alt.Y("name:N", title="clip"),
                                color=alt.Color(
                                    "segment_id:N",
                                    legend=alt.Legend(title="segmento"),
                                ),
                                tooltip=["name", "start", "end", "segment_id"],
                            )
                            .properties(height=max(80, len(df) * 28))
                        )
                        st.altair_chart(chart, use_container_width=True)
                    except Exception as exc:  # noqa: BLE001
                        st.caption(f"Gantt no disponible: {exc}")
        for track in video_tracks:
            st.subheader(f"{track.get('name', 'Video')} ({track.get('id')})")
            items = track.get("items") or []
            for index, item in enumerate(items):
                segment_id = item.get("segment_id")
                same_segment_candidates = [
                    c for c in media_candidates if c.get("segment_id") == segment_id
                ]
                current_candidate = candidates_by_id.get(item.get("media_id")) or {}
                provider = item.get("provider") or current_candidate.get("provider")
                source = (
                    item.get("local_path") or current_candidate.get("local_path")
                    or current_candidate.get("source_url") or current_candidate.get("download_url")
                )
                query = current_candidate.get("query")
                score = current_candidate.get("score")
                with st.container(border=True):
                    st.markdown(f"**Clip {index + 1}: `{item.get('id')}`**")
                    meta_cols = st.columns(4)
                    meta_cols[0].write(f"segment_id: `{segment_id}`")
                    meta_cols[1].write(f"provider: `{provider}`")
                    meta_cols[2].write(f"start_sec: `{item.get('start_sec')}`")
                    meta_cols[3].write(f"duration_sec: `{item.get('duration_sec')}`")
                    st.caption(f"local/source: {source or 'sin media'}")
                    st.caption(
                        f"trim: {item.get('trim_start_sec')} → {item.get('trim_end_sec')} · "
                        f"query: {query or 'n/a'} · score: {score if score is not None else 'n/a'}"
                    )
                    license_info = current_candidate.get("license")
                    st.caption(f"Licencia: {_format_license(license_info)}")
                    asset_id = asset_id_for_local_path(item.get("local_path"), preview_assets)
                    if asset_id:
                        st.video(client.asset_url(project_id, asset_id))
                    elif source:
                        st.markdown(f"[Abrir fuente]({source})")
                    else:
                        st.info("Preview no disponible para este clip.")

                    move_cols = st.columns(2)
                    if move_cols[0].button("Mover arriba", key=f"up-{track.get('id')}-{item.get('id')}"):
                        _queue(build_reorder_commands(track["id"], items, index, "up"))
                    if move_cols[1].button("Mover abajo", key=f"down-{track.get('id')}-{item.get('id')}"):
                        _queue(build_reorder_commands(track["id"], items, index, "down"))

                    with st.form(f"edit-{track.get('id')}-{item.get('id')}"):
                        edit_cols = st.columns(3)
                        trim_start = edit_cols[0].number_input(
                            "Trim start", min_value=0.0,
                            value=float(item.get("trim_start_sec") or 0.0), step=0.1,
                            key=f"trim-start-{item.get('id')}",
                        )
                        trim_end_default = item.get("trim_end_sec") or item.get("duration_sec") or 0.1
                        trim_end = edit_cols[1].number_input(
                            "Trim end", min_value=0.0,
                            value=float(trim_end_default), step=0.1,
                            key=f"trim-end-{item.get('id')}",
                        )
                        duration = edit_cols[2].number_input(
                            "Duración", min_value=0.1,
                            value=float(item.get("duration_sec") or 0.1), step=0.1,
                            key=f"duration-{item.get('id')}",
                        )
                        selected_candidate = None
                        if same_segment_candidates:
                            labels = [_candidate_label(c) for c in same_segment_candidates]
                            current_idx = next(
                                (i for i, c in enumerate(same_segment_candidates)
                                 if c.get("id") == item.get("media_id")),
                                0,
                            )
                            selected_label = st.selectbox(
                                "Reemplazar por candidato", labels, index=current_idx,
                                key=f"replace-{item.get('id')}",
                            )
                            selected_candidate = same_segment_candidates[labels.index(selected_label)]
                        submitted = st.form_submit_button("Añadir cambios")
                        if submitted:
                            commands = [build_trim_command(track["id"], item["id"], trim_start, trim_end)]
                            if abs(duration - float(item.get("duration_sec") or 0.0)) > 0.0001:
                                commands.append(build_set_timing_command(track["id"], item["id"], duration))
                            if selected_candidate and selected_candidate.get("id") != item.get("media_id"):
                                commands.append(build_replace_command(track["id"], item["id"], selected_candidate))
                            _queue(commands)

    with tab_music:
        from app.utils.utils import resource_dir as _resource_dir

        _songs_dir = _resource_dir("songs")
        _local_songs = _list_local_songs(_songs_dir)

        with st.form("music-select"):
            st.subheader("Seleccionar música contextual")
            song_options = ["(automático)"] + _local_songs
            selected_song = st.selectbox("Pista local", song_options)
            music_cols = st.columns(4)
            mood = music_cols[0].text_input("Mood", value="")
            energy = music_cols[1].text_input("Energy", value="")
            tempo = music_cols[2].text_input("Tempo", value="")
            style = music_cols[3].text_input("Style", value="")
            filter_cols = st.columns(3)
            commercial_safe = filter_cols[0].checkbox("Commercial safe only", value=True)
            local_only = filter_cols[1].checkbox("Local only", value=True)
            volume = filter_cols[2].slider("Volumen", min_value=0.0, max_value=1.0, value=0.2, step=0.05)
            if st.form_submit_button("Seleccionar música"):
                payload: dict = {
                    "commercial_safe_only": commercial_safe,
                    "local_only": local_only,
                    "volume": volume,
                }
                if selected_song != "(automático)":
                    payload["local_path"] = os.path.join(_songs_dir, selected_song)
                if mood or energy or tempo or style:
                    payload.update({"mood": mood, "energy": energy, "tempo": tempo, "style": style})
                _safe(client.select_music, project_id, payload)

        if selected_music:
            for track in selected_music:
                title = track.get("title") or track.get("id") or "pista"
                provider = track.get("provider") or "?"
                duration = track.get("duration_sec")
                composer = track.get("composer") or track.get("artist")
                meta = f"{provider}"
                if duration is not None:
                    meta += f" · {duration:.1f}s"
                if composer:
                    meta += f" · {composer}"
                st.write(f"**{title}** — {meta}")
                path_or_url = track.get("local_path") or track.get("url")
                if path_or_url:
                    st.caption(path_or_url)
                license_info = track.get("license") or {}
                if license_info:
                    st.caption(f"Licencia: {_format_license(license_info)}")
        else:
            st.info("No hay música contextual seleccionada todavía.")


def _is_streamlit_runtime() -> bool:
    try:
        return st.runtime.exists()
    except Exception:  # noqa: BLE001 - no runtime under tests/import
        return False


if _is_streamlit_runtime():  # pragma: no cover
    _render_ui()
