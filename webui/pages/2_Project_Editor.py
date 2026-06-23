"""Project Editor (Fase 7) — minimal manual timeline review/edit UI.

Consumes the Fase 6 project API. Does not touch the legacy pipeline.
"""
from __future__ import annotations

import streamlit as st

from webui.project_api import ProjectApiClient, ProjectApiError


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


def _safe(fn, *args):  # pragma: no cover - thin Streamlit wrapper
    try:
        st.json(fn(*args))
    except ProjectApiError as exc:
        st.error(str(exc))


def _render_ui() -> None:  # pragma: no cover - Streamlit UI, validated manually
    st.title("Project Editor")
    base_url = st.text_input("API base URL", value=ProjectApiClient().base_url)
    client = ProjectApiClient(base_url=base_url)

    with st.expander("Create project from script", expanded=False):
        script = st.text_area("Script")
        language = st.text_input("Language", value="es")
        if st.button("Create"):
            try:
                data = client.create_from_script(script, language)
                st.session_state["project_id"] = data["project_id"]
                st.success(f"Created {data['project_id']}")
            except ProjectApiError as exc:
                st.error(str(exc))

    project_id = st.text_input("Project ID", value=st.session_state.get("project_id", ""))
    if not project_id:
        st.info("Enter or create a project to edit.")
        return

    try:
        st.json(client.get_project(project_id))
    except ProjectApiError as exc:
        st.error(str(exc))
        return

    col1, col2, col3 = st.columns(3)
    if col1.button("Run plan"):
        _safe(client.plan, project_id)
    if col2.button("Search media"):
        _safe(client.media_search, project_id)
    if col3.button("Build timeline"):
        _safe(client.build_timeline, project_id)

    if st.button("Render"):
        _safe(client.render, project_id)
    if st.button("Refresh render status"):
        try:
            st.json(client.render_status(project_id))
        except ProjectApiError as exc:
            st.error(str(exc))


def _is_streamlit_runtime() -> bool:
    try:
        return st.runtime.exists()
    except Exception:  # noqa: BLE001 - no runtime under tests/import
        return False


if _is_streamlit_runtime():  # pragma: no cover
    _render_ui()
