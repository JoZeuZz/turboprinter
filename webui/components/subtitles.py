from collections.abc import Callable

import streamlit as st

from app.config import config
from webui.components.media import (
    centered_color_picker,
    centered_slider,
    get_all_fonts,
    render_font_gallery,
)


Translator = Callable[[str], str]


def render_subtitle_settings_section(params, font_dir: str, tr: Translator) -> None:
    with st.container(border=True):
        st.write(tr("Subtitle Settings"))
        params.subtitle_enabled = st.checkbox(tr("Enable Subtitles"), value=True)

        if st.session_state.get("layout_mode") == "slices":
            render_font_gallery(params, font_dir)
        else:
            font_names = get_all_fonts(font_dir)
            saved_font_name = config.ui.get("font_name", "Charm-Regular.ttf")
            saved_font_name_index = 0
            if saved_font_name in font_names:
                saved_font_name_index = font_names.index(saved_font_name)
            params.font_name = st.selectbox(
                tr("Font"), font_names, index=saved_font_name_index
            )
            config.ui["font_name"] = params.font_name

        st.divider()
        _render_position_controls(params, tr)
        _render_appearance_controls(params, tr)
        _render_background_controls(params, tr)


def _render_position_controls(params, tr: Translator) -> None:
    with st.container(border=True, key="subtitle_position_group"):
        subtitle_positions = [
            (tr("Top"), "top"),
            (tr("Center"), "center"),
            (tr("Bottom"), "bottom"),
            (tr("Custom"), "custom"),
        ]
        saved_subtitle_position = config.ui.get("subtitle_position", "bottom")
        saved_position_index = 2
        for index, (_, pos_value) in enumerate(subtitle_positions):
            if pos_value == saved_subtitle_position:
                saved_position_index = index
                break
        selected_index = st.selectbox(
            tr("Position"),
            index=saved_position_index,
            options=range(len(subtitle_positions)),
            format_func=lambda index: subtitle_positions[index][0],
        )
        params.subtitle_position = subtitle_positions[selected_index][1]
        config.ui["subtitle_position"] = params.subtitle_position

        if params.subtitle_position == "custom":
            saved_custom_position = config.ui.get("custom_position", 70.0)
            custom_position = st.text_input(
                tr("Custom Position (% from top)"),
                value=str(saved_custom_position),
                key="custom_position_input",
            )
            try:
                params.custom_position = float(custom_position)
                if params.custom_position < 0 or params.custom_position > 100:
                    st.error(tr("Please enter a value between 0 and 100"))
                else:
                    config.ui["custom_position"] = params.custom_position
            except ValueError:
                st.error(tr("Please enter a valid number"))


def _render_appearance_controls(params, tr: Translator) -> None:
    appearance_cols = st.columns(2, gap="large")
    with appearance_cols[0]:
        with st.container(border=True, key="subtitle_font_group"):
            st.markdown(f"**{tr('Font')}**")
            font_controls = st.columns([1, 3], vertical_alignment="bottom")
            with font_controls[0]:
                saved_text_fore_color = config.ui.get("text_fore_color", "#FFFFFF")
                params.text_fore_color = centered_color_picker(
                    tr("Font Color"),
                    saved_text_fore_color,
                    key="subtitle_font_color_picker",
                )
                config.ui["text_fore_color"] = params.text_fore_color
            with font_controls[1]:
                saved_font_size = config.ui.get("font_size", 60)
                params.font_size = centered_slider(
                    tr("Font Size"),
                    30,
                    100,
                    saved_font_size,
                    key="subtitle_font_size_slider",
                )
                config.ui["font_size"] = params.font_size

    with appearance_cols[1]:
        with st.container(border=True, key="subtitle_stroke_group"):
            st.markdown(f"**{tr('Stroke Color')}**")
            stroke_controls = st.columns([1, 3], vertical_alignment="bottom")
            with stroke_controls[0]:
                params.stroke_color = centered_color_picker(
                    tr("Stroke Color"),
                    "#000000",
                    key="subtitle_stroke_color_picker",
                )
            with stroke_controls[1]:
                params.stroke_width = centered_slider(
                    tr("Stroke Width"),
                    0.0,
                    10.0,
                    1.5,
                    key="subtitle_stroke_width_slider",
                )


def _render_background_controls(params, tr: Translator) -> None:
    saved_subtitle_background_enabled = config.ui.get(
        "subtitle_background_enabled", True
    )
    with st.container(border=True, key="subtitle_background_group"):
        saved_rounded_subtitle_background = config.ui.get(
            "rounded_subtitle_background", False
        )
        background_toggles = st.columns(2, gap="large")
        with background_toggles[0]:
            subtitle_background_enabled = st.checkbox(
                tr("Enable Subtitle Background"),
                value=saved_subtitle_background_enabled,
            )
        config.ui["subtitle_background_enabled"] = subtitle_background_enabled

        with background_toggles[1]:
            params.rounded_subtitle_background = st.checkbox(
                tr("Rounded Subtitle Background"),
                value=(
                    saved_rounded_subtitle_background
                    if subtitle_background_enabled
                    else False
                ),
                help=tr("Rounded Subtitle Background Help"),
                disabled=not subtitle_background_enabled,
            )

        saved_subtitle_background_color = config.ui.get(
            "subtitle_background_color", "#000000"
        )
        selected_background_color = centered_color_picker(
            tr("Subtitle Background Color"),
            saved_subtitle_background_color,
            key="subtitle_background_color_picker",
            disabled=not subtitle_background_enabled,
        )
        if subtitle_background_enabled:
            params.text_background_color = selected_background_color
            config.ui["subtitle_background_color"] = selected_background_color
            config.ui["rounded_subtitle_background"] = (
                params.rounded_subtitle_background
            )
        else:
            params.text_background_color = False
