from collections.abc import Callable

import streamlit as st

from app.config import config


Translator = Callable[[str], str]


def render_publish_section(params, tr: Translator) -> None:
    del params
    with st.container(border=True):
        st.write(tr("Upload / Post"))
        col1, col2 = st.columns(2)
        with col1:
            saved_enabled = config.app.get("upload_post_enabled", False)
            upload_enabled = st.checkbox(
                tr("Enable Upload-Post"),
                value=saved_enabled,
                key="upload_post_enabled_checkbox",
            )
            config.app["upload_post_enabled"] = upload_enabled
        with col2:
            saved_auto = config.app.get("upload_post_auto_upload", False)
            auto_upload = st.checkbox(
                tr("Auto upload after generation"),
                value=saved_auto,
                key="upload_post_auto_checkbox",
            )
            config.app["upload_post_auto_upload"] = auto_upload

        if upload_enabled:
            saved_api_key = config.app.get("upload_post_api_key", "")
            saved_username = config.app.get("upload_post_username", "")
            saved_platforms = config.app.get(
                "upload_post_platforms", ["tiktok", "instagram"]
            )

            upload_api_key = st.text_input(
                tr("Upload-Post API Key"),
                value=saved_api_key,
                type="password",
                key="upload_post_api_key_input",
            )
            upload_username = st.text_input(
                tr("Upload-Post Username"),
                value=saved_username,
                key="upload_post_username_input",
            )
            platform_options = ["tiktok", "instagram"]
            selected_platforms = st.multiselect(
                tr("Platforms"),
                options=platform_options,
                default=[p for p in saved_platforms if p in platform_options],
                key="upload_post_platforms_select",
            )
            config.app["upload_post_api_key"] = upload_api_key
            config.app["upload_post_username"] = upload_username
            config.app["upload_post_platforms"] = selected_platforms
