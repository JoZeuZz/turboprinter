import base64
import html
import io
import os

from PIL import Image, ImageDraw, ImageFont

import streamlit as st

from app.config import config
from app.utils import utils


def get_all_fonts(font_dir: str) -> list[str]:
    fonts = []
    for root, _dirs, files in os.walk(font_dir):
        for file in files:
            if file.endswith((".ttf", ".ttc")):
                fonts.append(file)
    fonts.sort()
    return fonts


def get_all_songs(song_dir: str) -> list[str]:
    songs = []
    for root, _dirs, files in os.walk(song_dir):
        for file in files:
            if file.endswith(".mp3"):
                songs.append(file)
    songs.sort()
    return songs


def get_all_songs_with_path(song_dir: str) -> list[dict[str, str]]:
    songs = []
    for root, _dirs, files in os.walk(song_dir):
        for file in files:
            if file.endswith(".mp3"):
                songs.append({"name": file, "path": os.path.join(root, file)})
    songs.sort(key=lambda item: item["name"])
    return songs


def _render_font_preview_img(font_dir: str, font_name: str, preview_text: str):
    font_path = os.path.join(font_dir, font_name)
    if not os.path.isfile(font_path):
        return None
    try:
        img_w, img_h = 260, 90
        font_size = 48
        # Reducir el tamano de la fuente si el texto es demasiado largo.
        font = ImageFont.truetype(font_path, font_size)
        dummy_img = Image.new("RGB", (1, 1))
        draw = ImageDraw.Draw(dummy_img)
        bbox = draw.textbbox((0, 0), preview_text, font=font)
        text_w = bbox[2] - bbox[0]

        while text_w > (img_w - 20) and font_size > 18:
            font_size -= 4
            font = ImageFont.truetype(font_path, font_size)
            bbox = draw.textbbox((0, 0), preview_text, font=font)
            text_w = bbox[2] - bbox[0]

        img = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        bbox = draw.textbbox((0, 0), preview_text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x = (img_w - text_w) // 2
        y = (img_h - text_h) // 2
        draw.text((x, y), preview_text, font=font, fill=(235, 238, 242, 255))
        return img
    except Exception:
        return None


@st.cache_data(ttl=3600, show_spinner=False)
def get_font_preview_images(font_dir: str, cache_version: str) -> dict[str, bytes]:
    # The explicit version invalidates previews when their visual format changes.
    del cache_version
    fonts = [font for font in get_all_fonts(font_dir) if font.endswith(".ttf")]
    result = {}
    for font_name in fonts:
        family = os.path.splitext(font_name)[0]
        img = _render_font_preview_img(font_dir, font_name, family)
        if img:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            result[font_name] = buf.getvalue()
    return result


def font_card_html(font_name: str, img_bytes: bytes, selected: bool = False) -> str:
    del selected
    img_b64 = base64.b64encode(img_bytes).decode()
    display = font_name.replace(".ttf", "")
    return (
        '<div class="font-card-preview" style="width: 100%; text-align: center;">'
        f'<img src="data:image/png;base64,{img_b64}" style="width:100%; height:80px; object-fit:contain; border-radius:8px; display:block; margin:0 auto;">'
        f'<div class="font-label" style="font-size:11px; color:#aaa; margin-top:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center; font-weight:500;">{display}</div>'
        "</div>"
    )


def subtitle_control_label(label: str) -> None:
    st.markdown(
        f'<div class="subtitle-control-label">{html.escape(label)}</div>',
        unsafe_allow_html=True,
    )


def centered_color_picker(label: str, value: str, *, key: str, disabled: bool = False):
    subtitle_control_label(label)
    with st.container(horizontal=True, horizontal_alignment="center"):
        with st.container(width=48, horizontal_alignment="center"):
            return st.color_picker(
                label,
                value,
                key=key,
                label_visibility="collapsed",
                disabled=disabled,
            )


def centered_slider(label, min_value, max_value, value, *, key: str):
    subtitle_control_label(label)
    return st.slider(
        label,
        min_value,
        max_value,
        value,
        key=key,
        label_visibility="collapsed",
    )


def render_font_gallery(params, font_dir: str, tr=None) -> None:
    fonts = [font for font in get_all_fonts(font_dir) if font.endswith(".ttf")]
    if not fonts:
        params.font_name = ""
        return

    if "selected_font" not in st.session_state:
        st.session_state["selected_font"] = (
            config.ui.get("font_name") or params.font_name or fonts[0]
        )
    selected = st.session_state["selected_font"]
    if selected not in fonts:
        selected = fonts[0]
        st.session_state["selected_font"] = selected

    params.font_name = selected
    config.ui["font_name"] = selected
    total_pages = max(1, (len(fonts) + 2) // 3)
    if "font_page_initialized" not in st.session_state:
        st.session_state["font_page"] = fonts.index(selected) // 3
        st.session_state["font_page_initialized"] = True
    page = st.session_state.get("font_page", 0)
    if page >= total_pages:
        page = total_pages - 1
        st.session_state["font_page"] = page

    start = page * 3
    end = min(start + 3, len(fonts))
    page_fonts = fonts[start:end]
    previews = get_font_preview_images(font_dir, "transparent-v1")

    cols = st.columns([0.5, 3, 3, 3, 0.5], gap="small")

    with cols[0]:
        st.markdown(
            '<span class="font-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if page > 0:
            st.button(
                "◀",
                key="font_prev",
                on_click=lambda: st.session_state.update(font_page=page - 1),
            )

    for index in range(3):
        with cols[index + 1]:
            if index < len(page_fonts):
                font_name = page_fonts[index]
                is_selected = font_name == selected
                card_state = "selected" if is_selected else "idle"
                with st.container(
                    border=True,
                    key=f"font_card_{card_state}_{index}",
                ):
                    if font_name in previews:
                        st.markdown(
                            font_card_html(font_name, previews[font_name], is_selected),
                            unsafe_allow_html=True,
                        )
                    _, btn_col, _ = st.columns([0.5, 3, 0.5])
                    with btn_col:
                        button_label = (
                            tr("Selected") if is_selected else tr("Use")
                        ) if tr else ("Seleccionada" if is_selected else "Usar")
                        if st.button(
                            button_label,
                            key=f"font_use_{font_name}",
                            use_container_width=True,
                        ):
                            params.font_name = font_name
                            st.session_state["selected_font"] = font_name
                            config.ui["font_name"] = font_name
                            st.rerun()
            else:
                st.markdown(
                    "<div style='min-height:220px'></div>",
                    unsafe_allow_html=True,
                )

    with cols[4]:
        st.markdown(
            '<span class="font-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if page < total_pages - 1:
            st.button(
                "▶",
                key="font_next",
                on_click=lambda: st.session_state.update(font_page=page + 1),
            )

    if total_pages > 1:
        dots = " ".join("●" if index == page else "○" for index in range(total_pages))
        st.markdown(
            f'<div style="text-align:center;font-size:12px;color:#888;margin-top:4px;">{dots}</div>',
            unsafe_allow_html=True,
        )
