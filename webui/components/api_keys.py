from collections.abc import Callable

import streamlit as st

from app.config import config


Translator = Callable[[str], str]


def _mask_api_key(key: str) -> str:
    if not key:
        return ""
    suffix = key[-4:] if len(key) >= 4 else key
    return f"****{suffix}"


def _render_api_key_tab(
    *,
    config_key: str,
    label: str,
    input_key: str,
    delete_key: str,
    tr: Translator,
) -> None:
    if config_key not in config.app or config.app[config_key] is None:
        config.app[config_key] = []

    st.subheader(tr(label))
    if config.app[config_key]:
        st.write(tr("Current Keys:"))
        for key in config.app[config_key]:
            st.code(_mask_api_key(key))
    else:
        st.info(tr(f"No {label} currently"))

    new_key = st.text_input(tr(f"Add {label}"), key=input_key)
    if st.button(tr(f"Add {label}")):
        if new_key and new_key not in config.app[config_key]:
            config.app[config_key].append(new_key)
            config.save_config()
            st.success(tr(f"{label.removesuffix('s')} added successfully"))
        elif new_key in config.app[config_key]:
            st.warning(tr("This API Key already exists"))
        else:
            st.error(tr("Please enter a valid API Key"))

    if config.app[config_key]:
        key_labels = [
            f"{_mask_api_key(key)} (#{index + 1})"
            for index, key in enumerate(config.app[config_key])
        ]
        delete_index = st.selectbox(
            tr(f"Select {label.removesuffix('s')} to delete"),
            options=range(len(key_labels)),
            format_func=lambda index: key_labels[index],
            key=delete_key,
        )
        if st.button(tr(f"Delete Selected {label.removesuffix('s')}")):
            config.app[config_key].pop(delete_index)
            config.save_config()
            st.success(tr(f"{label.removesuffix('s')} deleted successfully"))


def render_api_key_management(tr: Translator) -> None:
    with st.expander(tr("Click to show API Key management"), expanded=False):
        st.subheader(tr("Manage Pexels, Pixabay and Coverr API Keys"))

        col1, col2, col3 = st.tabs([
            tr("Pexels API Keys"),
            tr("Pixabay API Keys"),
            tr("Coverr API Keys"),
        ])

        with col1:
            _render_api_key_tab(
                config_key="pexels_api_keys",
                label="Pexels API Keys",
                input_key="pexels_new_key",
                delete_key="pexels_delete_key",
                tr=tr,
            )
        with col2:
            _render_api_key_tab(
                config_key="pixabay_api_keys",
                label="Pixabay API Keys",
                input_key="pixabay_new_key",
                delete_key="pixabay_delete_key",
                tr=tr,
            )
        with col3:
            _render_api_key_tab(
                config_key="coverr_api_keys",
                label="Coverr API Keys",
                input_key="coverr_new_key",
                delete_key="coverr_delete_key",
                tr=tr,
            )
