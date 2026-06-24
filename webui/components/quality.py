import os
from collections.abc import Callable

import streamlit as st

from app.config import config
from app.utils import utils

try:
    from app.services.quality import local_library as _local_lib

    _LOCAL_LIB_AVAILABLE = True
except Exception:
    _LOCAL_LIB_AVAILABLE = False


Translator = Callable[[str], str]


def _local_lib_db_path() -> str:
    return os.path.join(utils.storage_dir("local_library", create=True), "library.db")


def _option_index(options, value, fallback):
    return options.index(value) if value in options else fallback


def render_quality_section(params, tr: Translator) -> None:
    with st.expander(tr("Personal Quality"), expanded=False):
        quality_enabled = st.checkbox(
            tr("Enable quality enhancements"),
            value=bool(config.quality.get("enabled", False)),
            help=tr("Optional. When off, the video is generated exactly as before."),
        )
        params.quality_enabled = quality_enabled
        if quality_enabled:
            profiles = ["fast", "balanced", "high", "archival"]
            platforms = ["shorts", "reels", "tiktok", "landscape"]
            styles = ["classic", "clean", "premium", "karaoke", "documentary"]

            q_cols = st.columns(3)
            with q_cols[0]:
                st.markdown(f"**{tr('Render')}**")
                params.quality_profile = st.selectbox(
                    tr("Quality Profile"),
                    options=profiles,
                    index=_option_index(
                        profiles,
                        str(config.quality.get("profile", "balanced")),
                        1,
                    ),
                    help=tr("Higher quality renders slower (high/archival use a lower CRF)."),
                )
                params.quality_target_platform = st.selectbox(
                    tr("Target Platform"),
                    options=platforms,
                    index=_option_index(
                        platforms,
                        str(config.quality.get("target_platform", "shorts")),
                        0,
                    ),
                    help=tr("Sets the subtitle safe-area for the destination format."),
                )
            with q_cols[1]:
                st.markdown(f"**{tr('Subtitles')}**")
                params.quality_subtitle_style = st.selectbox(
                    tr("Subtitle Style"),
                    options=styles,
                    index=_option_index(
                        styles,
                        str(config.quality.get("subtitle_style", "premium")),
                        2,
                    ),
                )
                params.quality_word_highlight = st.checkbox(
                    tr("Word Highlight (karaoke)"),
                    value=bool(config.quality.get("word_highlight", False)),
                    help=tr("Saves per-word timing; falls back to phrase subtitles if unavailable."),
                )
            with q_cols[2]:
                st.markdown(f"**{tr('Content & material')}**")
                params.quality_language = st.text_input(
                    tr("Content Language"),
                    value=str(config.quality.get("language", "es")),
                )
                params.quality_prefer_local_assets = st.checkbox(
                    tr("Prefer Local Material Library"),
                    value=bool(config.quality.get("prefer_local_assets", True)),
                    help=tr("Use your indexed local clips before downloading stock."),
                )
                params.quality_content_package = st.checkbox(
                    tr("Spanish Content Package"),
                    value=bool(config.quality.get("content_package", False)),
                    help=tr("Also generate title, description, hashtags and a review checklist."),
                )

        if _LOCAL_LIB_AVAILABLE:
            _render_local_library_panel(tr)


def _render_local_library_panel(tr: Translator) -> None:
    st.markdown("---")
    st.markdown(f"**{tr('Local Material Library')}**")
    lib_conn = None
    try:
        lib_conn = _local_lib.connect(_local_lib_db_path())
        lib_entries = _local_lib.all_entries(lib_conn)
        lib_total = len(lib_entries)
        lib_videos = sum(1 for entry in lib_entries if entry.media_type == "video")
        lib_images = sum(1 for entry in lib_entries if entry.media_type == "image")
        lib_duration = sum(entry.duration for entry in lib_entries)
        if lib_total == 0:
            st.info(
                "La biblioteca esta vacia. Agrega videos para poder usarlos en tus proyectos."
            )
        else:
            st.markdown(
                f"**{lib_total} entries** - "
                f"{lib_videos} video(s), {lib_images} image(s) - "
                f"{lib_duration:.0f}s total duration"
            )
            lib_rows = [
                {
                    "path": entry.path,
                    "type": entry.media_type,
                    "duration": f"{entry.duration:.1f}s",
                    "source": entry.source or "",
                    "tags": ",".join(entry.tags),
                }
                for entry in lib_entries[:50]
            ]
            st.dataframe(lib_rows, use_container_width=True)

        st.markdown(f"**{tr('Index a directory:')}**")
        idx_col1, idx_col2 = st.columns([3, 1])
        with idx_col1:
            index_dir = st.text_input(
                tr("Directory path"),
                key="lib_index_dir",
                placeholder="/path/to/your/videos",
            )
        with idx_col2:
            index_source = st.text_input(
                tr("Source label"),
                value="user",
                key="lib_index_source",
            )
        if st.button(tr("Index directory"), key="lib_index_btn"):
            _index_local_library_directory(lib_conn, index_dir, index_source, tr)
    except Exception as lib_exc:
        st.error(f"Local library error: {lib_exc}")
    finally:
        if lib_conn is not None:
            lib_conn.close()


def _index_local_library_directory(lib_conn, index_dir: str, index_source: str, tr: Translator) -> None:
    if index_dir and os.path.isdir(index_dir):
        try:
            idx_stats = _local_lib.index_directory(
                lib_conn,
                index_dir,
                source=index_source,
                tags=[],
            )
            st.success(
                f"scanned={idx_stats['scanned']} "
                f"added={idx_stats['added']} "
                f"updated={idx_stats['updated']} "
                f"skipped={idx_stats['skipped']}"
            )
        except Exception as idx_exc:
            st.error(str(idx_exc))
    else:
        st.error(tr("Directory not found or invalid path."))
