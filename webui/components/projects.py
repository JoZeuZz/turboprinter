from collections.abc import Callable
from uuid import uuid4

import streamlit as st

from app.config import config
from app.services import project_store


Translator = Callable[[str], str]


def _project_status_label(status: str, tr: Translator) -> str:
    labels = {
        "draft": tr("Draft"),
        "generating": tr("Generating"),
        "completed": tr("Completed"),
        "failed": tr("Failed"),
    }
    return labels.get(status, status)


def ensure_active_project_id() -> str:
    project_id = st.session_state.get("active_project_id", "")
    if not project_id:
        project_id = str(uuid4())
        st.session_state["active_project_id"] = project_id
        config.app["active_project_id"] = project_id
    return project_id


def save_project_snapshot(params=None, *, status="draft", artifacts=None, task_id=""):
    project_id = ensure_active_project_id()
    subject = st.session_state.get("video_subject", "").strip()
    script = st.session_state.get("video_script", "").strip()
    terms = st.session_state.get("video_terms", "")
    conn = project_store.connect()
    try:
        return project_store.save_project(
            conn,
            project_id,
            subject=subject,
            status=status,
            script=script,
            terms=terms,
            params=params,
            artifacts=artifacts,
            task_id=task_id,
        )
    finally:
        conn.close()


def _load_project(project_id: str) -> None:
    conn = project_store.connect()
    try:
        project = project_store.get_project(conn, project_id)
    finally:
        conn.close()
    if not project:
        return
    st.session_state["active_project_id"] = project.id
    st.session_state["video_subject"] = project.subject
    st.session_state["video_script"] = project.script
    st.session_state["video_terms"] = ", ".join(project.terms)
    st.session_state["video_script_prompt"] = project.params.get(
        "video_script_prompt", ""
    )
    for key, value in project.params.items():
        if key not in {"project_id", "video_materials", "custom_audio_file"}:
            config.app[key] = value
    ui_param_keys = {
        "font_name",
        "subtitle_position",
        "custom_position",
        "font_size",
        "text_fore_color",
        "text_background_color",
        "stroke_color",
        "stroke_width",
        "rounded_subtitle_background",
    }
    for key in ui_param_keys:
        if key in project.params:
            config.ui[key] = project.params[key]
    if project.params.get("font_name"):
        st.session_state["selected_font"] = project.params["font_name"]
    if project.params.get("voice_name"):
        st.session_state["voice_gallery_selected"] = project.params["voice_name"]
        st.session_state["voice_gallery_page_initialized"] = False
    if "paragraph_number" in project.params:
        st.session_state["paragraph_number_input"] = project.params[
            "paragraph_number"
        ]
    if "match_materials_to_script" in project.params:
        st.session_state["match_materials_to_script"] = project.params[
            "match_materials_to_script"
        ]
    config.app["active_project_id"] = project.id


def render_project_control(tr: Translator) -> None:
    conn = project_store.connect()
    try:
        projects = project_store.list_projects(conn)
    finally:
        conn.close()
    project_by_id = {project.id: project for project in projects}
    options = [project.id for project in projects]
    active_id = st.session_state.get("active_project_id", "")
    default_index = options.index(active_id) if active_id in options else 0

    with st.container(border=True):
        st.write(tr("Projects"))
        picker_col, new_col, load_col, save_col = st.columns([4, 1, 1, 1])
        with picker_col:
            if options:
                selected_id = st.selectbox(
                    tr("Saved projects"),
                    options=options,
                    index=default_index,
                    format_func=lambda project_id: (
                        f"{project_by_id[project_id].subject or tr('Untitled project')} · "
                        f"{_project_status_label(project_by_id[project_id].status, tr)} · "
                        f"{project_by_id[project_id].updated_at[5:16].replace('T', ' ')}"
                    ),
                    label_visibility="collapsed",
                    key="project_picker",
                )
            else:
                st.text_input(
                    tr("Saved projects"),
                    value=tr("No saved projects"),
                    disabled=True,
                    label_visibility="collapsed",
                )
                selected_id = ""
        with new_col:
            if st.button(tr("New project"), use_container_width=True):
                st.session_state["active_project_id"] = str(uuid4())
                st.session_state["video_subject"] = ""
                st.session_state["video_script"] = ""
                st.session_state["video_terms"] = ""
                st.session_state["video_script_prompt"] = ""
                config.app["active_project_id"] = st.session_state[
                    "active_project_id"
                ]
                st.rerun()
        with load_col:
            if st.button(
                tr("Load project"),
                disabled=not selected_id,
                use_container_width=True,
            ):
                _load_project(selected_id)
                st.rerun()
        with save_col:
            if st.button(tr("Save draft"), use_container_width=True):
                st.session_state["save_project_requested"] = True
