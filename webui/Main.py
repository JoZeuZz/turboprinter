import base64
import html
import inspect
import io
import os
import sys
import webbrowser
from uuid import UUID, uuid4

from PIL import Image, ImageDraw, ImageFont

import requests
import streamlit as st
from loguru import logger

# Add the root directory of the project to the system path to allow importing modules from the project
root_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
if root_dir not in sys.path:
    sys.path.append(root_dir)
    print("******** sys.path ********")
    print(sys.path)
    print("")

from app.config import config
from app.models.schema import (
    MaterialInfo,
    VideoAspect,
    VideoConcatMode,
    VideoParams,
    VideoTransitionMode,
)
from app.services import llm, project_store, voice
from app.services import task as tm
from app.utils import file_security, utils

try:
    from app.services.quality import local_library as _local_lib
    _LOCAL_LIB_AVAILABLE = True
except Exception:
    _LOCAL_LIB_AVAILABLE = False


def _local_lib_db_path() -> str:
    return os.path.join(utils.storage_dir("local_library", create=True), "library.db")

st.set_page_config(
    page_title="MoneyPrinterTurbo",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="auto",
    menu_items={
        "Report a bug": "https://github.com/harry0703/MoneyPrinterTurbo/issues",
        "About": "# MoneyPrinterTurbo\nSimply provide a topic or keyword for a video, and it will "
        "automatically generate the video copy, video materials, video subtitles, "
        "and video background music before synthesizing a high-definition short "
        "video.\n\nhttps://github.com/harry0703/MoneyPrinterTurbo",
    },
)


streamlit_style = """
<style>
h1 {
    padding-top: 0 !important;
}

/* Font gallery: flechas centradas en el stVerticalBlock de la columna */
div[data-testid="stVerticalBlock"]:has(.font-gallery-arrow-col) {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 220px !important;
    height: 100% !important;
}

div[data-testid="stVerticalBlock"]:has(.voice-gallery-arrow-col) {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    min-height: 205px !important;
    height: 100% !important;
}

/* Font gallery: keyed containers expose stable st-key-* classes in Streamlit. */
[class*="st-key-font_card_"] {
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

[class*="st-key-font_card_selected_"] {
    border: 2px solid #39FF14 !important;
    box-shadow: 0 0 0 1px #39FF14, 0 0 18px rgba(57, 255, 20, 0.38) !important;
    background: rgba(57, 255, 20, 0.045) !important;
}

[class*="st-key-font_card_selected_"] button {

    box-shadow: 0 0 10px rgba(57, 255, 20, 0.18) !important;
}

.font-card-preview img {
    background: transparent !important;
}

[class*="st-key-voice_card_"] {
    min-height: 205px;
    transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

[class*="st-key-voice_card_selected_"] {
    border: 2px solid #39FF14 !important;
    box-shadow: 0 0 0 1px #39FF14, 0 0 18px rgba(57, 255, 20, 0.3) !important;
    background: rgba(57, 255, 20, 0.035) !important;
}

.voice-card-name {
    margin-bottom: 0.4rem;
    font-size: 1rem;
    font-weight: 650;
}

.voice-card-copy {
    min-height: 3.5rem;
    color: rgba(250, 250, 250, 0.72);
    font-size: 0.82rem;
    line-height: 1.35rem;
}

.voice-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.5rem 0 0.8rem;
}

.voice-card-badge {
    padding: 0.15rem 0.45rem;
    border: 1px solid rgba(250, 250, 250, 0.16);
    border-radius: 999px;
    background: rgba(250, 250, 250, 0.055);
    font-size: 0.72rem;
    line-height: 1rem;
}

.voice-gallery-page {
    margin-top: 0.6rem;
    color: rgba(250, 250, 250, 0.55);
    font-size: 0.78rem;
    text-align: center;
}

[class*="st-key-voice_preview_player"] {
    display: none !important;
}

.subtitle-control-label {
    margin-bottom: 0.35rem;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.25rem;
    text-align: center;
}
</style>
"""
st.markdown(streamlit_style, unsafe_allow_html=True)

# 定义资源目录
font_dir = os.path.join(root_dir, "resource", "fonts")
song_dir = os.path.join(root_dir, "resource", "songs")
i18n_dir = os.path.join(root_dir, "webui", "i18n")
config_file = os.path.join(root_dir, "webui", ".streamlit", "webui.toml")
system_locale = utils.get_system_locale()


if "video_subject" not in st.session_state:
    st.session_state["video_subject"] = config.app.get("video_subject", "")
if "video_script" not in st.session_state:
    st.session_state["video_script"] = config.app.get("video_script", "")
if "video_terms" not in st.session_state:
    st.session_state["video_terms"] = config.app.get("video_terms", "")
if "video_script_prompt" not in st.session_state:
    st.session_state["video_script_prompt"] = config.app.get("video_script_prompt", "")
if "custom_system_prompt" not in st.session_state:
    st.session_state["custom_system_prompt"] = llm.DEFAULT_SCRIPT_SYSTEM_PROMPT
if "use_custom_system_prompt" not in st.session_state:
    st.session_state["use_custom_system_prompt"] = False
if "match_materials_to_script" not in st.session_state:
    st.session_state["match_materials_to_script"] = bool(
        config.app.get("match_materials_to_script", False)
    )
if "ui_language" not in st.session_state:
    st.session_state["ui_language"] = config.ui.get("language", system_locale)
if "layout_mode" not in st.session_state:
    st.session_state["layout_mode"] = config.ui.get("layout_mode", "vertical")
if "slices_tab" not in st.session_state:
    st.session_state["slices_tab"] = 0
if "paragraph_number_input" not in st.session_state:
    st.session_state["paragraph_number_input"] = config.app.get("paragraph_number", 1)
if "font_preview_text" not in st.session_state:
    st.session_state["font_preview_text"] = "Hello World 123"
if "selected_folder_files" not in st.session_state:
    st.session_state["selected_folder_files"] = []
if "selected_song" not in st.session_state:
    st.session_state["selected_song"] = "random"
if "font_page" not in st.session_state:
    st.session_state["font_page"] = 0
if "local_video_materials" not in st.session_state:
    # 记住用户最近一次已经落盘的本地素材，避免仅修改文案后二次生成时丢失素材列表。
    st.session_state["local_video_materials"] = []
if "active_project_id" not in st.session_state:
    st.session_state["active_project_id"] = config.app.get("active_project_id", "")

# 加载语言文件
locales = utils.load_locales(i18n_dir)

# 创建一个顶部栏，包含标题和语言选择
title_col, lang_col = st.columns([3, 1])

with title_col:
    st.title(f"MoneyPrinterTurbo v{config.project_version}")

with lang_col:
    display_languages = []
    selected_index = 0
    for i, code in enumerate(locales.keys()):
        display_languages.append(f"{code} - {locales[code].get('Language')}")
        if code == st.session_state.get("ui_language", ""):
            selected_index = i

    selected_language = st.selectbox(
        "Language / 语言",
        options=display_languages,
        index=selected_index,
        key="top_language_selector",
        label_visibility="collapsed",
    )
    if selected_language:
        code = selected_language.split(" - ")[0].strip()
        st.session_state["ui_language"] = code
        config.ui["language"] = code

mode_col = st.columns([1, 1])
with mode_col[0]:
    layout_mode = st.radio(
        "Modo",
        options=["vertical", "slices"],
        format_func=lambda x: "📋 Vertical" if x == "vertical" else "📑 Slices",
        index=0 if st.session_state["layout_mode"] == "vertical" else 1,
        horizontal=True,
        label_visibility="collapsed",
        key="layout_mode_radio",
    )
    if layout_mode != st.session_state["layout_mode"]:
        st.session_state["layout_mode"] = layout_mode
        config.ui["layout_mode"] = layout_mode
        st.rerun()

support_locales = [
    "zh-CN",
    "zh-HK",
    "zh-TW",
    "de-DE",
    "en-US",
    "es-ES",   # <— añadido: español de España (foco del fork)
    "es-MX",   # <— añadido: español de México
    "fr-FR",
    "ru-RU",
    "vi-VN",
    "th-TH",
    "tr-TR",
]


def get_all_fonts():
    fonts = []
    for root, dirs, files in os.walk(font_dir):
        for file in files:
            if file.endswith(".ttf") or file.endswith(".ttc"):
                fonts.append(file)
    fonts.sort()
    return fonts


def get_all_songs():
    songs = []
    for root, dirs, files in os.walk(song_dir):
        for file in files:
            if file.endswith(".mp3"):
                songs.append(file)
    songs.sort()
    return songs


def get_all_songs_with_path():
    songs = []
    for root, dirs, files in os.walk(song_dir):
        for file in files:
            if file.endswith(".mp3"):
                songs.append({"name": file, "path": os.path.join(root, file)})
    songs.sort(key=lambda x: x["name"])
    return songs


def _render_font_preview_img(font_name, preview_text):
    font_path = os.path.join(font_dir, font_name)
    if not os.path.isfile(font_path):
        return None
    try:
        img_w, img_h = 260, 90
        font_size = 48
        # Reducir el tamaño de la fuente si el texto es demasiado largo para el lienzo
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

        # Transparent canvas lets the preview inherit the current Streamlit theme.
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
def _get_font_preview_images_v2(cache_version: str):
    # The explicit version invalidates previews when their visual format changes.
    del cache_version
    fonts = [f for f in get_all_fonts() if f.endswith(".ttf")]
    result = {}
    for f in fonts:
        family = os.path.splitext(f)[0]
        img = _render_font_preview_img(f, family)
        if img:
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            result[f] = buf.getvalue()
    return result


def _font_card_html(font_name, img_bytes, selected=False):
    img_b64 = base64.b64encode(img_bytes).decode()
    display = font_name.replace(".ttf", "")
    return (
        f'<div class="font-card-preview" style="width: 100%; text-align: center;">'
        f'<img src="data:image/png;base64,{img_b64}" style="width:100%; height:80px; object-fit:contain; border-radius:8px; display:block; margin:0 auto;">'
        f'<div class="font-label" style="font-size:11px; color:#aaa; margin-top:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center; font-weight:500;">{display}</div>'
        f'</div>'
    )


def _subtitle_control_label(label):
    st.markdown(
        f'<div class="subtitle-control-label">{html.escape(label)}</div>',
        unsafe_allow_html=True,
    )


def _centered_color_picker(label, value, *, key, disabled=False):
    _subtitle_control_label(label)
    with st.container(horizontal=True, horizontal_alignment="center"):
        with st.container(width=48, horizontal_alignment="center"):
            return st.color_picker(
                label,
                value,
                key=key,
                label_visibility="collapsed",
                disabled=disabled,
            )


def _centered_slider(label, min_value, max_value, value, *, key):
    _subtitle_control_label(label)
    return st.slider(
        label,
        min_value,
        max_value,
        value,
        key=key,
        label_visibility="collapsed",
    )


def _voice_metadata(voice_id):
    raw_voice = str(voice_id or "")
    gender = "unknown"
    if raw_voice.endswith("-Female"):
        gender = "female"
    elif raw_voice.endswith("-Male"):
        gender = "male"

    clean_voice = raw_voice.removesuffix("-Female").removesuffix("-Male")
    locale = ""
    language_code = "multilingual"

    if clean_voice.startswith("siliconflow:"):
        display_name = clean_voice.rsplit(":", 1)[-1].replace("_", " ").title()
    elif clean_voice.startswith(("gemini:", "mimo:")):
        display_name = clean_voice.split(":", 1)[1].replace("_", " ").title()
    elif clean_voice == voice.NO_VOICE_NAME:
        display_name = tr("No Voice")
        language_code = "none"
    else:
        parts = clean_voice.split("-")
        if len(parts) >= 3 and len(parts[0]) == 2:
            locale = "-".join(parts[:2])
            language_code = parts[0].lower()
            display_name = " ".join(parts[2:])
        else:
            display_name = clean_voice
        display_name = (
            display_name.replace("MultilingualNeural", "")
            .replace("Neural", "")
            .replace("-V2", "")
            .strip()
        )

    language_labels = {
        "ar": tr("Arabic"),
        "de": tr("German"),
        "en": tr("English"),
        "es": tr("Spanish"),
        "fr": tr("French"),
        "hi": tr("Hindi"),
        "it": tr("Italian"),
        "ja": tr("Japanese"),
        "ko": tr("Korean"),
        "pt": tr("Portuguese"),
        "ru": tr("Russian"),
        "tr": tr("Turkish"),
        "vi": tr("Vietnamese"),
        "zh": tr("Chinese"),
        "multilingual": tr("Multilingual"),
        "none": tr("Not applicable"),
    }
    language_label = language_labels.get(language_code, locale or tr("Unknown"))
    if locale:
        language_label = f"{language_label} · {locale}"

    return {
        "id": raw_voice,
        "name": display_name or raw_voice,
        "gender": gender,
        "language_code": language_code,
        "language": language_label,
    }


def _voice_preview_example(language_code):
    examples = {
        "ar": "هذا نص تجريبي لاختبار تحويل النص إلى كلام.",
        "de": "Dies ist ein Beispieltext zum Testen der Sprachsynthese.",
        "en": "This is an example text for testing speech synthesis.",
        "es": "Este es un texto de ejemplo para probar la síntesis de voz.",
        "fr": "Ceci est un exemple de texte pour tester la synthèse vocale.",
        "hi": "यह वाक् संश्लेषण का परीक्षण करने के लिए एक उदाहरण पाठ है।",
        "it": "Questo è un testo di esempio per provare la sintesi vocale.",
        "ja": "これは音声合成をテストするためのサンプルテキストです。",
        "ko": "음성 합성을 테스트하기 위한 예시 문장입니다.",
        "pt": "Este é um texto de exemplo para testar a síntese de voz.",
        "ru": "Это пример текста для проверки синтеза речи.",
        "tr": "Bu, konuşma sentezini test etmek için örnek bir metindir.",
        "vi": "Đây là văn bản mẫu để kiểm tra tính năng tổng hợp giọng nói.",
        "zh": "这是一段用于测试语音合成的示例文本。",
    }
    return examples.get(language_code, examples["en"])


def _sync_voice_preview_language():
    language_code = st.session_state.get("voice_language_filter", "all")
    if language_code == "all":
        language_code = st.session_state.get(
            "voice_gallery_selected_language", "en"
        )
    next_default = _voice_preview_example(language_code)
    current_text = st.session_state.get("voice_preview_text", "")
    previous_default = st.session_state.get("voice_preview_default_text", "")
    if not current_text or current_text == previous_default:
        st.session_state["voice_preview_text"] = next_default
    st.session_state["voice_preview_default_text"] = next_default


def _voice_card_html(metadata, preview_text):
    gender_labels = {
        "female": tr("Female"),
        "male": tr("Male"),
        "unknown": tr("Not specified"),
    }
    preview = (preview_text or tr("Voice Example")).strip()
    if len(preview) > 180:
        preview = preview[:177].rstrip() + "..."
    badges = [
        gender_labels.get(metadata["gender"], tr("Not specified")),
        metadata["language"],
    ]
    badges_html = "".join(
        f'<span class="voice-card-badge">{html.escape(label)}</span>'
        for label in badges
    )
    return (
        f'<div class="voice-card-name">{html.escape(metadata["name"])}</div>'
        f'<div class="voice-card-copy">{html.escape(preview)}</div>'
        f'<div class="voice-card-badges">{badges_html}</div>'
    )


def _synthesize_voice_preview(voice_name, preview_text, voice_rate, voice_volume):
    text = (preview_text or tr("Voice Example")).strip()
    temp_dir = utils.storage_dir("temp", create=True)
    audio_file = os.path.join(temp_dir, f"tmp-voice-{str(uuid4())}.mp3")
    try:
        sub_maker = voice.tts(
            text=text,
            voice_name=voice_name,
            voice_rate=voice_rate,
            voice_file=audio_file,
            voice_volume=voice_volume,
        )
        if sub_maker and os.path.exists(audio_file):
            with open(audio_file, "rb") as file:
                st.session_state["voice_preview_audio"] = file.read()
            st.session_state["voice_preview_audio_name"] = voice_name
        else:
            st.error(tr("Voice preview could not be generated"))
    except Exception as exc:
        logger.error(f"voice preview failed: {exc}")
        st.error(tr("Voice preview could not be generated"))
    finally:
        if os.path.exists(audio_file):
            os.remove(audio_file)


def render_voice_gallery(filtered_voices, params, selected_tts_server):
    metadata = [_voice_metadata(item) for item in filtered_voices]
    saved_voice = config.ui.get("voice_name", "")
    if (
        "voice_gallery_selected" not in st.session_state
        or st.session_state.get("voice_gallery_server") != selected_tts_server
    ):
        st.session_state["voice_gallery_selected"] = (
            saved_voice if saved_voice in filtered_voices else filtered_voices[0]
        )
        st.session_state["voice_gallery_server"] = selected_tts_server
        st.session_state["voice_gallery_page_initialized"] = False

    selected_metadata = next(
        (
            item
            for item in metadata
            if item["id"] == st.session_state["voice_gallery_selected"]
        ),
        metadata[0],
    )
    st.session_state["voice_gallery_selected_language"] = selected_metadata[
        "language_code"
    ]
    if "voice_preview_default_text" not in st.session_state:
        default_preview_text = _voice_preview_example(
            selected_metadata["language_code"]
        )
        st.session_state["voice_preview_default_text"] = default_preview_text
        st.session_state["voice_preview_text"] = default_preview_text
    preview_text = st.text_area(
        tr("Voice Preview Text"),
        key="voice_preview_text",
        height=100,
    )

    filter_cols = st.columns([2, 1, 1], gap="small")
    with filter_cols[0]:
        search = st.text_input(tr("Search Voice"), key="voice_search").strip().lower()
    language_codes = sorted({item["language_code"] for item in metadata})
    language_options = ["all", *language_codes]
    language_option_labels = {"all": tr("All")}
    for code in language_codes:
        language_option_labels[code] = next(
            item["language"].split(" · ", 1)[0]
            for item in metadata
            if item["language_code"] == code
        )
    preferred_language = st.session_state.get("ui_language", "").split("-", 1)[0]
    preferred_language_index = (
        language_options.index(preferred_language)
        if preferred_language in language_options
        else 0
    )
    with filter_cols[1]:
        language_filter = st.selectbox(
            tr("Language"),
            language_options,
            format_func=language_option_labels.get,
            index=preferred_language_index,
            key="voice_language_filter",
            on_change=_sync_voice_preview_language,
        )
    gender_option_labels = {
        "all": tr("All"),
        "female": tr("Female"),
        "male": tr("Male"),
    }
    with filter_cols[2]:
        gender_filter = st.selectbox(
            tr("Gender"),
            ["all", "female", "male"],
            format_func=gender_option_labels.get,
            key="voice_gender_filter",
        )
    visible = [
        item
        for item in metadata
        if (not search or search in item["name"].lower() or search in item["id"].lower())
        and (language_filter == "all" or item["language_code"] == language_filter)
        and (gender_filter == "all" or item["gender"] == gender_filter)
    ]
    if not visible:
        st.info(tr("No voices match the selected filters"))
        params.voice_name = st.session_state["voice_gallery_selected"]
        return params.voice_name

    selected_voice = st.session_state["voice_gallery_selected"]
    filter_signature = (search, language_filter, gender_filter)
    if st.session_state.get("voice_filter_signature") != filter_signature:
        selected_index = next(
            (i for i, item in enumerate(visible) if item["id"] == selected_voice), 0
        )
        st.session_state["voice_gallery_page"] = selected_index // 3
        st.session_state["voice_gallery_page_initialized"] = True
        st.session_state["voice_filter_signature"] = filter_signature
    page_size = 3
    total_pages = max(1, (len(visible) + page_size - 1) // page_size)
    if not st.session_state.get("voice_gallery_page_initialized", False):
        selected_index = next(
            (i for i, item in enumerate(visible) if item["id"] == selected_voice), 0
        )
        st.session_state["voice_gallery_page"] = selected_index // page_size
        st.session_state["voice_gallery_page_initialized"] = True
    page = min(st.session_state.get("voice_gallery_page", 0), total_pages - 1)
    st.session_state["voice_gallery_page"] = page
    page_items = visible[page * page_size : (page + 1) * page_size]

    nav_cols = st.columns([0.45, 3, 3, 3, 0.45], gap="small")
    with nav_cols[0]:
        st.markdown(
            '<span class="voice-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if page > 0 and st.button("◀", key="voice_page_prev", use_container_width=True):
            st.session_state["voice_gallery_page"] = page - 1
            st.rerun()
    preview_request = None
    for index in range(page_size):
        with nav_cols[index + 1]:
            if index >= len(page_items):
                st.empty()
                continue
            item = page_items[index]
            preview_is_custom = preview_text != st.session_state.get(
                "voice_preview_default_text", ""
            )
            card_preview_text = (
                preview_text
                if preview_is_custom
                else _voice_preview_example(item["language_code"])
            )
            is_selected = item["id"] == selected_voice
            card_token = utils.md5(item["id"])
            card_state = "selected" if is_selected else "idle"
            with st.container(
                border=True,
                key=f"voice_card_{card_state}_{card_token}",
            ):
                st.markdown(
                    _voice_card_html(item, card_preview_text),
                    unsafe_allow_html=True,
                )
                action_cols = st.columns(2, gap="small")
                with action_cols[0]:
                    select_label = tr("Selected") if is_selected else tr("Use")
                    if st.button(
                        select_label,
                        key=f"voice_select_{card_token}",
                        use_container_width=True,
                    ):
                        st.session_state["voice_gallery_selected"] = item["id"]
                        st.session_state["voice_gallery_selected_language"] = item[
                            "language_code"
                        ]
                        config.ui["voice_name"] = item["id"]
                        if language_filter == "all":
                            _sync_voice_preview_language()
                        st.rerun()
                with action_cols[1]:
                    if st.button(
                        tr("Listen"),
                        key=f"voice_listen_{card_token}",
                        use_container_width=True,
                    ):
                        preview_request = (item["id"], card_preview_text)
    with nav_cols[4]:
        st.markdown(
            '<span class="voice-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if (
            page < total_pages - 1
            and st.button("▶", key="voice_page_next", use_container_width=True)
        ):
            st.session_state["voice_gallery_page"] = page + 1
            st.rerun()

    st.markdown(
        f'<div class="voice-gallery-page">{page + 1} / {total_pages}</div>',
        unsafe_allow_html=True,
    )
    if preview_request:
        _synthesize_voice_preview(
            preview_request[0],
            preview_request[1],
            config.app.get("voice_rate", 1.0),
            config.app.get("voice_volume", 1.0),
        )
    preview_audio = st.session_state.get("voice_preview_audio")
    if preview_audio:
        with st.container(key="voice_preview_player"):
            st.audio(preview_audio, format="audio/mp3", autoplay=True)

    params.voice_name = st.session_state["voice_gallery_selected"]
    config.ui["voice_name"] = params.voice_name
    return params.voice_name


def render_font_gallery(params):
    fonts = [f for f in get_all_fonts() if f.endswith(".ttf")]
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
    # VideoParams is recreated on every Streamlit rerun. Keep the effective
    # render value aligned with the card that remains selected in the UI.
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

    previews = _get_font_preview_images_v2("transparent-v1")

    cols = st.columns([0.5, 3, 3, 3, 0.5], gap="small")

    with cols[0]:
        st.markdown(
            '<span class="font-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if page > 0:
            st.button("◀", key="font_prev",
                       on_click=lambda: st.session_state.update(font_page=page - 1))

    for i in range(3):
        with cols[i + 1]:
            if i < len(page_fonts):
                font_name = page_fonts[i]
                is_sel = font_name == selected
                card_state = "selected" if is_sel else "idle"
                with st.container(
                    border=True,
                    key=f"font_card_{card_state}_{i}",
                ):
                    if font_name in previews:
                        st.markdown(
                            _font_card_html(font_name, previews[font_name], is_sel),
                            unsafe_allow_html=True,
                        )
                    _, btn_col, _ = st.columns([0.5, 3, 0.5])
                    with btn_col:
                        button_label = "Seleccionada" if is_sel else "Usar"
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
                st.markdown("<div style='min-height:220px'></div>", unsafe_allow_html=True)

    with cols[4]:
        st.markdown(
            '<span class="font-gallery-arrow-col" style="display:none"></span>',
            unsafe_allow_html=True,
        )
        if page < total_pages - 1:
            st.button("▶", key="font_next",
                       on_click=lambda: st.session_state.update(font_page=page + 1))

    if total_pages > 1:
        dots = " ".join("●" if i == page else "○" for i in range(total_pages))
        st.markdown(
            f'<div style="text-align:center;font-size:12px;color:#888;margin-top:4px;">{dots}</div>',
            unsafe_allow_html=True,
        )

def open_task_folder(task_id):
    try:
        # task_id 应始终是服务端生成的 UUID。这里先做格式校验，避免异常值
        # 通过路径拼接访问任务目录之外的位置，也避免后续打开目录时触发
        # 平台 shell 对特殊字符的解释。
        normalized_task_id = str(UUID(str(task_id)))
        tasks_root = os.path.abspath(os.path.join(root_dir, "storage", "tasks"))
        path = os.path.abspath(os.path.join(tasks_root, normalized_task_id))

        # 即使 UUID 校验通过，也再次确认最终路径仍在任务根目录内，避免
        # 未来调用方调整 task_id 来源时引入路径穿越风险。
        if not path.startswith(tasks_root + os.sep):
            logger.warning(f"invalid task folder path: {path}")
            return

        if os.path.isdir(path):
            webbrowser.open(f"file://{path}")
    except Exception as e:
        logger.error(e)


def scroll_to_bottom():
    js = """
    <script>
        console.log("scroll_to_bottom");
        function scroll(dummy_var_to_force_repeat_execution){
            var sections = parent.document.querySelectorAll('section.main');
            console.log(sections);
            for(let index = 0; index<sections.length; index++) {
                sections[index].scrollTop = sections[index].scrollHeight;
            }
        }
        scroll(1);
    </script>
    """
    st.components.v1.html(js, height=0, width=0)


def init_log():
    logger.remove()
    _lvl = "DEBUG"

    def format_record(record):
        # 获取日志记录中的文件全路径
        file_path = record["file"].path
        # 将绝对路径转换为相对于项目根目录的路径
        relative_path = os.path.relpath(file_path, root_dir)
        # 更新记录中的文件路径
        record["file"].path = f"./{relative_path}"
        # 返回修改后的格式字符串
        # 您可以根据需要调整这里的格式
        record["message"] = record["message"].replace(root_dir, ".")

        _format = (
            "<green>{time:%Y-%m-%d %H:%M:%S}</> | "
            + "<level>{level}</> | "
            + '"{file.path}:{line}":<blue> {function}</> '
            + "- <level>{message}</>"
            + "\n"
        )
        return _format

    logger.add(
        sys.stdout,
        level=_lvl,
        format=format_record,
        colorize=True,
    )


init_log()

locales = utils.load_locales(i18n_dir)


def tr(key):
    loc = locales.get(st.session_state["ui_language"], {})
    return loc.get("Translation", {}).get(key, key)


def _is_llm_provider_enabled(provider_id: str) -> bool:
    if provider_id == "g4f":
        return bool(config.app.get("allow_g4f_provider", False))
    return True


def _project_status_label(status: str) -> str:
    labels = {
        "draft": tr("Draft"),
        "generating": tr("Generating"),
        "completed": tr("Completed"),
        "failed": tr("Failed"),
    }
    return labels.get(status, status)


def _ensure_active_project_id() -> str:
    project_id = st.session_state.get("active_project_id", "")
    if not project_id:
        project_id = str(uuid4())
        st.session_state["active_project_id"] = project_id
        config.app["active_project_id"] = project_id
    return project_id


def _set_project_id(params, project_id: str | None) -> None:
    # Streamlit can hot-reload Main.py while retaining an older imported
    # VideoParams class. Bypass that stale model only until the process restarts.
    if "project_id" in getattr(type(params), "model_fields", {}):
        params.project_id = project_id
    else:
        object.__setattr__(params, "project_id", project_id)


def _generate_script_with_history(*, previous_scripts=None, **kwargs) -> str:
    # During Streamlit hot reload, the imported llm module may still expose the
    # pre-project signature. Keep the page usable until the process restarts.
    parameters = inspect.signature(llm.generate_script).parameters
    if "previous_scripts" in parameters:
        kwargs["previous_scripts"] = previous_scripts or []
    return llm.generate_script(**kwargs)


def _save_project_snapshot(params=None, *, status="draft", artifacts=None, task_id=""):
    project_id = _ensure_active_project_id()
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


def render_project_control() -> None:
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
                        f"{_project_status_label(project_by_id[project_id].status)} · "
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


@st.cache_data(ttl=300, show_spinner=False)
def get_groq_model_ids(api_key: str, base_url: str) -> list[str]:
    if not api_key:
        return []

    normalized_base_url = (base_url or "https://api.groq.com/openai/v1").strip().rstrip("/")
    models_url = f"{normalized_base_url}/models"

    try:
        response = requests.get(
            models_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data", [])

        model_ids = []
        for item in data:
            if isinstance(item, dict):
                model_id = item.get("id")
                if isinstance(model_id, str) and model_id.strip():
                    model_ids.append(model_id.strip())

        return sorted(set(model_ids))
    except Exception as e:
        logger.warning(f"failed to fetch groq models: {e}")
        return []

# 创建基础设置折叠框
if not config.app.get("hide_config", False):
    with st.expander(tr("Basic Settings"), expanded=False):
        config_panels = st.columns(3)
        left_config_panel = config_panels[0]
        middle_config_panel = config_panels[1]
        right_config_panel = config_panels[2]

        # 左侧面板 - 日志设置
        with left_config_panel:
            # 是否隐藏配置面板
            hide_config = st.checkbox(
                tr("Hide Basic Settings"), value=config.app.get("hide_config", False)
            )
            config.app["hide_config"] = hide_config

            # 是否禁用日志显示
            hide_log = st.checkbox(
                tr("Hide Log"), value=config.ui.get("hide_log", False)
            )
            config.ui["hide_log"] = hide_log

        # 中间面板 - LLM 设置

        with middle_config_panel:
            st.write(tr("LLM Settings"))
            # 下拉框需要展示“AIHubMix（推荐）”这类面向用户的文案，
            # 但配置文件和后端逻辑必须继续使用稳定的小写 provider id。
            # 因此这里显式维护 display label 和 provider id 的映射，避免
            # UI 文案变化污染 `config.app["llm_provider"]`。
            aihubmix_label = f"AIHubMix ({tr('Recommended')})"
            if config.ui.get("language") == "zh":
                aihubmix_label = "AIHubMix（推荐）"
            llm_provider_options = [
                ("OpenAI", "openai"),
                (aihubmix_label, "aihubmix"),
                ("AIML API", "aimlapi"),
                ("Moonshot", "moonshot"),
                ("Azure", "azure"),
                ("Qwen", "qwen"),
                ("DeepSeek", "deepseek"),
                ("ModelScope", "modelscope"),
                ("Gemini", "gemini"),
                ("Grok", "grok"),
                ("Groq", "groq"),
                ("Ollama", "ollama"),
                ("G4f", "g4f"),
                ("OneAPI", "oneapi"),
                ("Cloudflare", "cloudflare"),
                ("ERNIE", "ernie"),
                ("MiniMax", "minimax"),
                ("MiMo", "mimo"),
                ("Pollinations", "pollinations"),
                ("LiteLLM", "litellm"),
            ]
            enabled_llm_provider_options = [
                option
                for option in llm_provider_options
                if _is_llm_provider_enabled(option[1])
            ]
            disabled_llm_provider_options = [
                option
                for option in llm_provider_options
                if not _is_llm_provider_enabled(option[1])
            ]
            llm_provider_labels = [
                label for label, _ in enabled_llm_provider_options
            ]
            llm_provider_values = {
                label: provider_id
                for label, provider_id in enabled_llm_provider_options
            }
            saved_llm_provider = config.app.get("llm_provider", "openai").lower()
            saved_llm_provider_index = 0
            for i, (_, provider_id) in enumerate(enabled_llm_provider_options):
                if provider_id == saved_llm_provider:
                    saved_llm_provider_index = i
                    break

            llm_provider_label = st.selectbox(
                tr("LLM Provider"),
                options=llm_provider_labels,
                index=saved_llm_provider_index,
            )
            llm_helper = st.container()
            llm_provider = llm_provider_values[llm_provider_label]
            config.app["llm_provider"] = llm_provider

            if disabled_llm_provider_options:
                st.caption(tr("Unavailable providers"))
                for label, provider_id in disabled_llm_provider_options:
                    st.button(
                        f"{label} ({tr('Disabled')})",
                        key=f"disabled_llm_provider_{provider_id}",
                        disabled=True,
                        use_container_width=True,
                    )

            # Panel avanzado de proveedores LLM. Se mantiene en un expander para no
            # sobrecargar la interfaz principal. Usa literales (sin tr()) a propósito
            # para no afectar la paridad de claves i18n de este fork personal.
            with st.expander("AI Provider (avanzado)", expanded=False):
                st.markdown(
                    "**Recomendaciones de proveedor**\n"
                    "- **DeepSeek**: bajo costo / proveedor principal sugerido\n"
                    "- **Gemini**: comparación de calidad / fallback\n"
                    "- **Ollama**: local / offline\n"
                    "- **LiteLLM**: gateway avanzado (100+ proveedores)\n\n"
                    "Precios y disponibilidad de modelos deben verificarse en la "
                    "documentación oficial antes de uso intensivo."
                )
                st.warning(
                    "No pegues API keys reales en el repositorio ni en `config.toml` "
                    "versionado. Las claves no se muestran completas en logs ni UI."
                )

                fallback_candidates = [
                    pid
                    for _, pid in enabled_llm_provider_options
                    if pid != llm_provider
                ]
                saved_fallback = config.app.get("llm_fallback_providers", []) or []
                if isinstance(saved_fallback, str):
                    saved_fallback = [
                        item.strip()
                        for item in saved_fallback.split(",")
                        if item.strip()
                    ]
                default_fallback = [
                    pid for pid in saved_fallback if pid in fallback_candidates
                ]
                selected_fallback = st.multiselect(
                    "Fallback providers (orden de intento si el principal falla)",
                    options=fallback_candidates,
                    default=default_fallback,
                    help="Vacío = sin fallback (comportamiento idéntico al actual).",
                )
                config.app["llm_fallback_providers"] = selected_fallback

            llm_api_key = config.app.get(f"{llm_provider}_api_key", "")
            llm_secret_key = config.app.get(
                f"{llm_provider}_secret_key", ""
            )  # only for baidu ernie
            llm_base_url = config.app.get(f"{llm_provider}_base_url", "")
            llm_model_name = config.app.get(f"{llm_provider}_model_name", "")
            llm_account_id = config.app.get(f"{llm_provider}_account_id", "")

            tips = ""
            if llm_provider == "ollama":
                if not llm_model_name:
                    llm_model_name = "qwen:7b"
                if not llm_base_url:
                    llm_base_url = config.get_default_ollama_base_url()

                with llm_helper:
                    docker_hint = ""
                    if config.is_running_in_container():
                        docker_hint = "\n                            > 检测到容器环境，未配置 Base Url 时会默认使用 `http://host.docker.internal:11434/v1`\n"
                    tips = f"""
                            ##### Ollama配置说明
                            - **API Key**: 随便填写，比如 123
                            - **Base Url**: 一般为 http://localhost:11434/v1
                                - 如果 `MoneyPrinterTurbo` 和 `Ollama` **不在同一台机器上**，需要填写 `Ollama` 机器的IP地址
                                - 如果 `MoneyPrinterTurbo` 是 `Docker` 部署，建议填写 `http://host.docker.internal:11434/v1`{docker_hint}
                            - **Model Name**: 使用 `ollama list` 查看，比如 `qwen:7b`
                            """

            if llm_provider == "openai":
                if not llm_model_name:
                    llm_model_name = "gpt-3.5-turbo"
                with llm_helper:
                    tips = """
                            ##### OpenAI 配置说明
                            > 需要VPN开启全局流量模式
                            - **API Key**: [点击到官网申请](https://platform.openai.com/api-keys)
                            - **Base Url**: 官方 OpenAI 可留空；如果使用 OpenAI 兼容供应商（例如 OpenRouter），请填写对应的兼容接口地址
                            - **Model Name**: 填写**有权限**的模型；如果使用兼容供应商，请填写该平台支持的模型 ID
                            """

            if llm_provider == "aihubmix":
                if not llm_model_name:
                    llm_model_name = "gpt-5.4-mini"
                if not llm_base_url:
                    llm_base_url = "https://aihubmix.com/v1"
                with llm_helper:
                    tips = """
                            ##### AIHubMix 配置说明
                            - **注册链接**: [点击注册 AIHubMix](https://aihubmix.com/?aff=CEve)
                            - **Base Url**: 预填 https://aihubmix.com/v1
                            - **推荐模型**: 默认 gpt-5.4-mini，也可以填写 AIHubMix 支持的免费模型或其它模型 ID

                            推荐理由：
                            - **模型全**: Claude、GPT、Gemini、Grok、DeepSeek、通义等 700+ 模型一站覆盖
                            - **稳定**: 无限并发，永远在线，集群部署于谷歌云，长期为众多知名应用提供高并发服务
                            - **能力完整**: 文本、图片生成、视频生成、TTS、STT、向量嵌入、Rerank，多模态场景全搞定
                            - **计费透明**: 按量付费，无会员无包月，免费模型可使用
                            """

            if llm_provider == "aimlapi":
                if not llm_model_name:
                    llm_model_name = "openai/gpt-4o-mini"
                if not llm_base_url:
                    llm_base_url = "https://api.aimlapi.com/v1"
                with llm_helper:
                    tips = """
                            ##### AIML API Configuration
                            - **API Key**: create one at https://aimlapi.com/app/keys
                            - **Base Url**: https://api.aimlapi.com/v1
                            - **Model Name**: for example `openai/gpt-4o-mini`, `openai/gpt-4o`, `anthropic/claude-sonnet-4.5`, or `google/gemini-3-flash-preview`
                            """

            if llm_provider == "moonshot":
                if not llm_model_name:
                    llm_model_name = "moonshot-v1-8k"
                with llm_helper:
                    tips = """
                            ##### Moonshot 配置说明
                            - **API Key**: [点击到官网申请](https://platform.moonshot.cn/console/api-keys)
                            - **Base Url**: 固定为 https://api.moonshot.cn/v1
                            - **Model Name**: 比如 moonshot-v1-8k，[点击查看模型列表](https://platform.moonshot.cn/docs/intro#%E6%A8%A1%E5%9E%8B%E5%88%97%E8%A1%A8)
                            """
            if llm_provider == "oneapi":
                if not llm_model_name:
                    llm_model_name = (
                        "claude-3-5-sonnet-20240620"  # 默认模型，可以根据需要调整
                    )
                with llm_helper:
                    tips = """
                        ##### OneAPI 配置说明
                        - **API Key**: 填写您的 OneAPI 密钥
                        - **Base Url**: 填写 OneAPI 的基础 URL
                        - **Model Name**: 填写您要使用的模型名称，例如 claude-3-5-sonnet-20240620
                        """

            if llm_provider == "qwen":
                if not llm_model_name:
                    llm_model_name = "qwen-max"
                with llm_helper:
                    tips = """
                            ##### 通义千问Qwen 配置说明
                            - **API Key**: [点击到官网申请](https://dashscope.console.aliyun.com/apiKey)
                            - **Base Url**: 留空
                            - **Model Name**: 比如 qwen-max，[点击查看模型列表](https://help.aliyun.com/zh/dashscope/developer-reference/model-introduction#3ef6d0bcf91wy)
                            """

            if llm_provider == "g4f":
                if not llm_model_name:
                    llm_model_name = "gpt-3.5-turbo"
                with llm_helper:
                    tips = """
                            ##### gpt4free 配置说明
                            > [GitHub开源项目](https://github.com/xtekky/gpt4free)，可以免费使用GPT模型，但是**稳定性较差**
                            - **API Key**: 随便填写，比如 123
                            - **Base Url**: 留空
                            - **Model Name**: 比如 gpt-3.5-turbo，[点击查看模型列表](https://github.com/xtekky/gpt4free/blob/main/g4f/models.py#L308)
                            """
            if llm_provider == "azure":
                with llm_helper:
                    tips = """
                            ##### Azure 配置说明
                            > [点击查看如何部署模型](https://learn.microsoft.com/zh-cn/azure/ai-services/openai/how-to/create-resource)
                            - **API Key**: [点击到Azure后台创建](https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI)
                            - **Base Url**: 留空
                            - **Model Name**: 填写你实际的部署名
                            """

            if llm_provider == "gemini":
                if not llm_model_name:
                    llm_model_name = "gemini-3.1-flash-lite"

                with llm_helper:
                    tips = """
                            ##### Gemini 配置说明
                            > 需要VPN开启全局流量模式
                            - **API Key**: [点击到官网申请](https://ai.google.dev/)
                            - **Base Url**: 留空
                            - **Model Name**: 比如 gemini-2.5-flash（gemini-1.0-pro 已下线）
                            - 推荐作为对比/兜底（fallback）provider，而不是首选低成本 provider
                            """

            if llm_provider == "grok":
                if not llm_model_name:
                    llm_model_name = "grok-4.3"
                if not llm_base_url:
                    llm_base_url = "https://api.x.ai/v1"

                with llm_helper:
                    tips = """
                            ##### Grok 配置说明
                            - **API Key**: 填写您的 GrokAPI 密钥
                            - **Base Url**: 填写 GrokAPI 的基础 URL
                            - **Model Name**: 比如 grok-4.3
                            """

            if llm_provider == "groq":
                if not llm_model_name:
                    llm_model_name = "llama-3.3-70b-versatile"
                if not llm_base_url:
                    llm_base_url = "https://api.groq.com/openai/v1"

                with llm_helper:
                    tips = """
                            ##### Groq 配置说明
                            - **API Key**: [点击到官网申请](https://console.groq.com/keys)
                            - **Base Url**: 固定为 https://api.groq.com/openai/v1
                            - **Model Name**: 比如 llama-3.3-70b-versatile
                            """

            if llm_provider == "deepseek":
                if not llm_model_name:
                    llm_model_name = "deepseek-v4-flash"
                if not llm_base_url:
                    llm_base_url = "https://api.deepseek.com"
                with llm_helper:
                    tips = """
                            ##### DeepSeek 配置说明
                            - **API Key**: [点击到官网申请](https://platform.deepseek.com/api_keys)
                            - **Base Url**: 固定为 https://api.deepseek.com
                            - **Model Name**: 推荐 deepseek-v4-flash（deepseek-chat / deepseek-reasoner 仍可用，请到官方文档确认时效）
                            - 推荐作为低成本首选 provider；视频旁白默认关闭 thinking
                            """

            if llm_provider == "mimo":
                if not llm_model_name:
                    llm_model_name = "mimo-v2.5-pro"
                if not llm_base_url:
                    llm_base_url = "https://api.xiaomimimo.com/v1"
                with llm_helper:
                    tips = """
                            ##### Xiaomi MiMo 配置说明
                            - **API Key**: [点击到官网申请](https://platform.xiaomimimo.com/docs/zh-CN/quick-start/first-api-call)
                            - **Base Url**: 固定为 https://api.xiaomimimo.com/v1
                            - **Model Name**: 默认 mimo-v2.5-pro，也可以按官方文档填写其它可用模型
                            """

            if llm_provider == "modelscope":
                if not llm_model_name:
                    llm_model_name = "Qwen/Qwen3-32B"
                if not llm_base_url:
                    llm_base_url = "https://api-inference.modelscope.cn/v1/"
                with llm_helper:
                    tips = """
                            ##### ModelScope 配置说明
                            - **API Key**: [点击到官网申请](https://modelscope.cn/docs/model-service/API-Inference/intro)
                            - **Base Url**: 固定为 https://api-inference.modelscope.cn/v1/
                            - **Model Name**: 比如 Qwen/Qwen3-32B，[点击查看模型列表](https://modelscope.cn/models?filter=inference_type&page=1)
                            """

            if llm_provider == "ernie":
                with llm_helper:
                    tips = """
                            ##### 百度文心一言 配置说明
                            - **API Key**: [点击到官网申请](https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application)
                            - **Secret Key**: [点击到官网申请](https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application)
                            - **Base Url**: 填写 **请求地址** [点击查看文档](https://cloud.baidu.com/doc/WENXINWORKSHOP/s/jlil56u11#%E8%AF%B7%E6%B1%82%E8%AF%B4%E6%98%8E)
                            """

            if llm_provider == "pollinations":
                if not llm_model_name:
                    llm_model_name = "default"
                with llm_helper:
                    tips = """
                            ##### Pollinations AI Configuration
                            - **API Key**: Optional - Leave empty for public access
                            - **Base Url**: Default is https://text.pollinations.ai/openai
                            - **Model Name**: Use 'openai-fast' or specify a model name
                            """

            if llm_provider == "litellm":
                if not llm_model_name:
                    llm_model_name = "openai/gpt-4o-mini"
                with llm_helper:
                    tips = """
                            ##### LiteLLM Configuration
                            > [LiteLLM](https://github.com/BerriAI/litellm) routes to 100+ LLM providers via a unified interface.
                            > Set your provider's API key as an env var: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, etc.
                            - **Model Name**: LiteLLM format — `openai/gpt-4o`, `anthropic/claude-sonnet-4-20250514`, `bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0`, `gemini/gemini-2.5-flash`. See [full provider list](https://docs.litellm.ai/docs/providers)
                            """

            if tips and config.ui["language"] == "zh":
                # AIHubMix 自身就是 OpenAI-compatible 聚合平台；用户主动选择
                # 该 provider 时，再显示 DeepSeek/Moonshot 的通用推荐会造成
                # 信息干扰，也不利于保持合作入口的轻量、清晰。
                if llm_provider != "aihubmix":
                    st.warning(
                        "中国用户建议使用 **DeepSeek** 或 **Moonshot** 作为大模型提供商\n- 国内可直接访问，不需要VPN \n- 注册就送额度，基本够用"
                    )
                st.info(tips)

            st_llm_api_key = st.text_input(
                tr("API Key"), value=llm_api_key, type="password"
            )
            st_llm_base_url = st.text_input(tr("Base Url"), value=llm_base_url)
            st_llm_model_name = ""
            if llm_provider != "ernie":
                if llm_provider == "groq":
                    effective_api_key = st_llm_api_key or llm_api_key
                    effective_base_url = st_llm_base_url or llm_base_url
                    groq_models = get_groq_model_ids(
                        api_key=effective_api_key,
                        base_url=effective_base_url,
                    )

                    if groq_models:
                        selected_index = 0
                        if llm_model_name in groq_models:
                            selected_index = groq_models.index(llm_model_name)

                        st_llm_model_name = st.selectbox(
                            tr("Model Name"),
                            options=groq_models,
                            index=selected_index,
                            key="groq_model_name_select",
                        )
                    else:
                        st_llm_model_name = st.text_input(
                            tr("Model Name"),
                            value=llm_model_name,
                            key="groq_model_name_input",
                        )
                        if effective_api_key:
                            st.caption(
                                "Unable to load Groq model list right now. You can still enter a model name manually — note it won't be validated until generation."
                            )
                        else:
                            st.caption(
                                "Add a Groq API key to load available models automatically."
                            )
                else:
                    st_llm_model_name = st.text_input(
                        tr("Model Name"),
                        value=llm_model_name,
                        key=f"{llm_provider}_model_name_input",
                    )
                if st_llm_model_name:
                    config.app[f"{llm_provider}_model_name"] = st_llm_model_name
            else:
                st_llm_model_name = None

            if st_llm_api_key:
                config.app[f"{llm_provider}_api_key"] = st_llm_api_key
            if st_llm_base_url:
                config.app[f"{llm_provider}_base_url"] = st_llm_base_url
            if st_llm_model_name:
                config.app[f"{llm_provider}_model_name"] = st_llm_model_name
            if llm_provider == "ernie":
                st_llm_secret_key = st.text_input(
                    tr("Secret Key"), value=llm_secret_key, type="password"
                )
                config.app[f"{llm_provider}_secret_key"] = st_llm_secret_key

            if llm_provider == "cloudflare":
                st_llm_account_id = st.text_input(
                    tr("Account ID"), value=llm_account_id
                )
                if st_llm_account_id:
                    config.app[f"{llm_provider}_account_id"] = st_llm_account_id

        # 右侧面板 - API 密钥设置
        with right_config_panel:

            def get_keys_from_config(cfg_key):
                api_keys = config.app.get(cfg_key, [])
                if isinstance(api_keys, str):
                    api_keys = [api_keys]
                api_key = ", ".join(api_keys)
                return api_key

            def save_keys_to_config(cfg_key, value):
                value = value.replace(" ", "")
                if value:
                    config.app[cfg_key] = value.split(",")

            st.write(tr("Video Source Settings"))

            pexels_api_key = get_keys_from_config("pexels_api_keys")
            pexels_api_key = st.text_input(
                tr("Pexels API Key"), value=pexels_api_key, type="password"
            )
            save_keys_to_config("pexels_api_keys", pexels_api_key)

            pixabay_api_key = get_keys_from_config("pixabay_api_keys")
            pixabay_api_key = st.text_input(
                tr("Pixabay API Key"), value=pixabay_api_key, type="password"
            )
            save_keys_to_config("pixabay_api_keys", pixabay_api_key)

            coverr_api_key = get_keys_from_config("coverr_api_keys")
            coverr_api_key = st.text_input(
                tr("Coverr API Key"), value=coverr_api_key, type="password"
            )
            save_keys_to_config("coverr_api_keys", coverr_api_key)

params = VideoParams(video_subject="")
params.match_materials_to_script = bool(
    st.session_state.get("match_materials_to_script", False)
)
uploaded_files = []
uploaded_audio_file = None
render_project_control()
_set_project_id(params, st.session_state.get("active_project_id") or None)


def render_script_section(params):
    with st.container(border=True):
        st.write(tr("Video Script Settings"))
        params.video_subject = st.text_input(
            tr("Video Subject"),
            key="video_subject",
        ).strip()

        video_languages = [
            (tr("Auto Detect"), ""),
        ]
        for code in support_locales:
            video_languages.append((code, code))

        selected_index = st.selectbox(
            tr("Script Language"),
            index=0,
            options=range(len(video_languages)),
            format_func=lambda x: video_languages[x][0],
        )
        params.video_language = video_languages[selected_index][1]

        with st.expander(tr("Advanced Script Settings"), expanded=False):
            params.paragraph_number = st.slider(
                tr("Script Paragraph Number"),
                min_value=llm.MIN_SCRIPT_PARAGRAPH_NUMBER,
                max_value=llm.MAX_SCRIPT_PARAGRAPH_NUMBER,
                value=st.session_state.get("paragraph_number_input", 1),
                key="paragraph_number_input",
            )
            params.video_script_prompt = st.text_area(
                tr("Custom Script Requirements"),
                height=100,
                max_chars=llm.MAX_SCRIPT_PROMPT_LENGTH,
                placeholder=tr("Custom Script Requirements Placeholder"),
                key="video_script_prompt",
            ).strip()

            use_custom_system_prompt = st.checkbox(
                tr("Use Custom System Prompt"),
                help=tr("Use Custom System Prompt Help"),
                key="use_custom_system_prompt",
            )

            if use_custom_system_prompt:
                custom_system_prompt = st.text_area(
                    tr("Custom System Prompt"),
                    height=240,
                    max_chars=llm.MAX_SCRIPT_SYSTEM_PROMPT_LENGTH,
                    key="custom_system_prompt",
                ).strip()
                params.custom_system_prompt = custom_system_prompt
            else:
                params.custom_system_prompt = ""

        if st.button(
            tr("Generate Video Script and Keywords"), key="auto_generate_script"
        ):
            with st.spinner(tr("Generating Video Script and Keywords")):
                project_id = _ensure_active_project_id()
                conn = project_store.connect()
                try:
                    prior_scripts = project_store.previous_scripts(
                        conn,
                        params.video_subject,
                        exclude_project_id=project_id,
                    )
                    current_script = st.session_state.get("video_script", "").strip()
                    if current_script and current_script not in prior_scripts:
                        prior_scripts.insert(0, current_script)
                finally:
                    conn.close()
                script = _generate_script_with_history(
                    video_subject=params.video_subject,
                    language=params.video_language,
                    paragraph_number=params.paragraph_number,
                    video_script_prompt=params.video_script_prompt,
                    custom_system_prompt=params.custom_system_prompt,
                    previous_scripts=prior_scripts,
                )
                terms = llm.generate_terms(
                    params.video_subject,
                    script,
                    amount=8 if params.match_materials_to_script else 5,
                    match_script_order=params.match_materials_to_script,
                )
                if "Error: " in script:
                    st.error(tr(script))
                elif "Error: " in terms:
                    st.error(tr(terms))
                else:
                    st.session_state["video_script"] = script
                    st.session_state["video_terms"] = ", ".join(terms)
                    _set_project_id(params, project_id)
                    params.video_script = script
                    params.video_terms = terms
                    _save_project_snapshot(params, status="draft")
        params.video_script = st.text_area(
            tr("Video Script"), key="video_script", height=280
        )
        if st.button(tr("Generate Video Keywords"), key="auto_generate_terms"):
            if not params.video_script:
                st.error(tr("Please Enter the Video Subject"))
                st.stop()

            with st.spinner(tr("Generating Video Keywords")):
                terms = llm.generate_terms(
                    params.video_subject,
                    params.video_script,
                    amount=8 if params.match_materials_to_script else 5,
                    match_script_order=params.match_materials_to_script,
                )
                if "Error: " in terms:
                    st.error(tr(terms))
                else:
                    st.session_state["video_terms"] = ", ".join(terms)

        params.video_terms = st.text_area(
            tr("Video Keywords"), key="video_terms"
        )


def render_video_settings_section(params):
    global uploaded_files
    with st.container(border=True):
        st.write(tr("Video Settings"))
        video_concat_modes = [
            (tr("Sequential"), "sequential"),
            (tr("Random"), "random"),
        ]
        video_sources = [
            (tr("Pexels"), "pexels"),
            (tr("Pixabay"), "pixabay"),
            (tr("Coverr"), "coverr"),
            (tr("Local file"), "local"),
            (tr("Local Folder"), "local_folder"),
        ]

        saved_video_source_name = config.app.get("video_source", "pexels")
        saved_video_source_names = [v[1] for v in video_sources]
        if saved_video_source_name not in saved_video_source_names:
            saved_video_source_name = "pexels"
        saved_video_source_index = saved_video_source_names.index(
            saved_video_source_name
        )

        selected_index = st.selectbox(
            tr("Video Source"),
            options=range(len(video_sources)),
            format_func=lambda x: video_sources[x][0],
            index=saved_video_source_index,
        )
        params.video_source = video_sources[selected_index][1]
        config.app["video_source"] = params.video_source

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
            for f in os.listdir(local_folder_path):
                ext = os.path.splitext(f)[1].lower()
                if ext in [".mp4", ".mov", ".avi", ".flv", ".mkv", ".jpg", ".jpeg", ".png"]:
                    folder_files.append(f)
            folder_files.sort()
            if folder_files:
                selected_folder = st.multiselect(
                    tr("Select from Local Videos"),
                    options=folder_files,
                    default=st.session_state.get("selected_folder_files", []),
                    key="selected_folder_files",
                )
            else:
                st.info(tr("No videos found in local directory. Upload files first using 'Local file' source."))
                selected_folder = []

        selected_index = st.selectbox(
            tr("Video Concat Mode"),
            index=1,
            options=range(len(video_concat_modes)),
            format_func=lambda x: video_concat_modes[x][0],
        )
        params.video_concat_mode = VideoConcatMode(
            video_concat_modes[selected_index][1]
        )

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
            format_func=lambda x: video_transition_modes[x][0],
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
            format_func=lambda x: video_aspect_ratios[x][0],
            index=default_aspect_index,
            key=f"video_aspect_for_{params.video_source}",
        )
        params.video_aspect = VideoAspect(video_aspect_ratios[selected_index][1])

        saved_clip_dur = config.app.get("video_clip_duration", 5)
        clip_dur_options = [2, 3, 4, 5, 6, 7, 8, 9, 10]
        clip_dur_index = 1
        if saved_clip_dur in clip_dur_options:
            clip_dur_index = clip_dur_options.index(saved_clip_dur)
        params.video_clip_duration = st.selectbox(
            tr("Clip Duration"), options=clip_dur_options, index=clip_dur_index
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
                format_func=lambda x: video_codec_options[x][0],
                help=tr("Video Encoder Help"),
            )
            config.app["video_codec"] = video_codec_options[selected_codec_index][1]


def render_audio_settings_section(params, show_bgm_preview=False):
    global uploaded_audio_file
    with st.container(border=True):
        st.write(tr("Audio Settings"))

        tts_servers = [
            (voice.NO_VOICE_NAME, tr("No Voice")),
            ("azure-tts-v1", "Azure TTS V1"),
            ("azure-tts-v2", "Azure TTS V2"),
            ("siliconflow", "SiliconFlow TTS"),
            ("gemini-tts", "Google Gemini TTS"),
            ("mimo-tts", "Xiaomi MiMo TTS"),
        ]

        # 获取保存的TTS服务器，默认为v1
        saved_tts_server = config.ui.get("tts_server", "azure-tts-v1")
        saved_tts_server_index = 0
        for i, (server_value, _) in enumerate(tts_servers):
            if server_value == saved_tts_server:
                saved_tts_server_index = i
                break

        selected_tts_server_index = st.selectbox(
            tr("TTS Servers"),
            options=range(len(tts_servers)),
            format_func=lambda x: tts_servers[x][1],
            index=saved_tts_server_index,
        )

        selected_tts_server = tts_servers[selected_tts_server_index][0]
        config.ui["tts_server"] = selected_tts_server

        # 根据选择的TTS服务器获取声音列表
        filtered_voices = []

        if selected_tts_server == voice.NO_VOICE_NAME:
            # 无配音是显式模式，只提供一个稳定 sentinel。这样普通 TTS 的空配置
            # 不会被误判为静音，后端也能继续通过同一条音频/字幕流程生成视频。
            filtered_voices = [voice.NO_VOICE_NAME]
        elif selected_tts_server == "siliconflow":
            # 获取硅基流动的声音列表
            filtered_voices = voice.get_siliconflow_voices()
        elif selected_tts_server == "gemini-tts":
            # 获取Gemini TTS的声音列表
            filtered_voices = voice.get_gemini_voices()
        elif selected_tts_server == "mimo-tts":
            # 获取 Xiaomi MiMo TTS 的预置音色列表
            filtered_voices = voice.get_mimo_voices()
        else:
            # 获取Azure的声音列表
            all_voices = voice.get_all_azure_voices(filter_locals=None)

            # 根据选择的TTS服务器筛选声音
            for v in all_voices:
                if selected_tts_server == "azure-tts-v2":
                    # V2版本的声音名称中包含"v2"
                    if "V2" in v:
                        filtered_voices.append(v)
                else:
                    # V1版本的声音名称中不包含"v2"
                    if "V2" not in v:
                        filtered_voices.append(v)

        if selected_tts_server == voice.NO_VOICE_NAME:
            friendly_names = {voice.NO_VOICE_NAME: tr("No Voice")}
        else:
            friendly_names = {
                v: v.replace("Female", tr("Female"))
                .replace("Male", tr("Male"))
                .replace("Neural", "")
                for v in filtered_voices
            }

        saved_voice_name = config.ui.get("voice_name", "")
        saved_voice_name_index = 0

        # 检查保存的声音是否在当前筛选的声音列表中
        if saved_voice_name in friendly_names:
            saved_voice_name_index = list(friendly_names.keys()).index(saved_voice_name)
        else:
            # 如果不在，则根据当前UI语言选择一个默认声音
            for i, v in enumerate(filtered_voices):
                if v.lower().startswith(st.session_state["ui_language"].lower()):
                    saved_voice_name_index = i
                    break

        # 如果没有找到匹配的声音，使用第一个声音
        if saved_voice_name_index >= len(friendly_names) and friendly_names:
            saved_voice_name_index = 0

        # 确保有声音可选
        voice_name = ""
        if friendly_names:
            if (
                st.session_state.get("layout_mode") == "slices"
                and selected_tts_server != voice.NO_VOICE_NAME
            ):
                voice_name = render_voice_gallery(
                    filtered_voices,
                    params,
                    selected_tts_server,
                )
            else:
                selected_friendly_name = st.selectbox(
                    tr("Speech Synthesis"),
                    options=list(friendly_names.values()),
                    index=min(saved_voice_name_index, len(friendly_names) - 1),
                )
                voice_name = list(friendly_names.keys())[
                    list(friendly_names.values()).index(selected_friendly_name)
                ]
                params.voice_name = voice_name
                config.ui["voice_name"] = voice_name
        else:
            # 如果没有声音可选，显示提示信息
            st.warning(
                tr(
                    "No voices available for the selected TTS server. Please select another server."
                )
            )
            params.voice_name = ""
            config.ui["voice_name"] = ""

        # 无配音模式会生成静音占位音频，不展示试听按钮，避免用户误以为需要测试声音。
        if (
            friendly_names
            and st.session_state.get("layout_mode") != "slices"
            and selected_tts_server != voice.NO_VOICE_NAME
            and st.button(tr("Play Voice"))
        ):
            play_content = params.video_subject or params.video_script or tr("Voice Example")
            _synthesize_voice_preview(
                voice_name,
                play_content,
                config.app.get("voice_rate", 1.0),
                config.app.get("voice_volume", 1.0),
            )
            preview_audio = st.session_state.get("voice_preview_audio")
            if preview_audio:
                st.audio(preview_audio, format="audio/mp3")

        # 当选择V2版本或者声音是V2声音时，显示服务区域和API key输入框
        if selected_tts_server == "azure-tts-v2" or (
            voice_name and voice.is_azure_v2_voice(voice_name)
        ):
            saved_azure_speech_region = config.azure.get("speech_region", "")
            saved_azure_speech_key = config.azure.get("speech_key", "")
            azure_speech_region = st.text_input(
                tr("Speech Region"),
                value=saved_azure_speech_region,
                key="azure_speech_region_input",
            )
            azure_speech_key = st.text_input(
                tr("Speech Key"),
                value=saved_azure_speech_key,
                type="password",
                key="azure_speech_key_input",
            )
            config.azure["speech_region"] = azure_speech_region
            config.azure["speech_key"] = azure_speech_key

        # 当选择硅基流动时，显示API key输入框和说明信息
        if selected_tts_server == "siliconflow" or (
            voice_name and voice.is_siliconflow_voice(voice_name)
        ):
            saved_siliconflow_api_key = config.siliconflow.get("api_key", "")

            siliconflow_api_key = st.text_input(
                tr("SiliconFlow API Key"),
                value=saved_siliconflow_api_key,
                type="password",
                key="siliconflow_api_key_input",
            )

            # 显示硅基流动的说明信息
            st.info(
                tr("SiliconFlow TTS Settings")
                + ":\n"
                + "- "
                + tr("Speed: Range [0.25, 4.0], default is 1.0")
                + "\n"
                + "- "
                + tr("Volume: Uses Speech Volume setting, default 1.0 maps to gain 0")
            )

            config.siliconflow["api_key"] = siliconflow_api_key

        # 当选择 Xiaomi MiMo TTS 时，复用 MiMo LLM provider 的 API Key。
        # 这样用户如果同时使用 MiMo 生成文案和语音，只需要维护一份密钥。
        if selected_tts_server == "mimo-tts" or (
            voice_name and voice.is_mimo_voice(voice_name)
        ):
            saved_mimo_api_key = config.app.get("mimo_api_key", "")

            mimo_api_key = st.text_input(
                tr("MiMo API Key"),
                value=saved_mimo_api_key,
                type="password",
                key="mimo_tts_api_key_input",
            )

            st.info(
                tr("MiMo TTS Settings")
                + ":\n"
                + "- "
                + tr("Uses Xiaomi MiMo V2.5 TTS preset voices")
                + "\n"
                + "- "
                + tr("Speed and volume are currently handled by the provider defaults")
            )

            config.app["mimo_api_key"] = mimo_api_key

        saved_voice_volume = config.app.get("voice_volume", 1.0)
        volume_options = [0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 4.0, 5.0]
        volume_index = 2
        if saved_voice_volume in volume_options:
            volume_index = volume_options.index(saved_voice_volume)
        params.voice_volume = st.selectbox(
            tr("Speech Volume"),
            options=volume_options,
            index=volume_index,
        )

        saved_voice_rate = config.app.get("voice_rate", 1.0)
        rate_options = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.5, 1.8, 2.0]
        rate_index = 2
        if saved_voice_rate in rate_options:
            rate_index = rate_options.index(saved_voice_rate)
        params.voice_rate = st.selectbox(
            tr("Speech Rate"),
            options=rate_options,
            index=rate_index,
        )

        custom_audio_file_types = ["mp3", "wav", "m4a", "aac", "flac", "ogg"]
        uploaded_audio_file = st.file_uploader(
            tr("Custom Audio File"),
            type=custom_audio_file_types
            + [file_type.upper() for file_type in custom_audio_file_types],
            accept_multiple_files=False,
            key="custom_audio_file_uploader",
        )
        if uploaded_audio_file:
            st.audio(uploaded_audio_file, format="audio/mp3")
            st.info(
                tr(
                    "Custom audio will be used directly. TTS synthesis will be skipped for this task."
                )
            )

        saved_bgm_type = config.ui.get("bgm_type", "random")
        song_list = get_all_songs_with_path()
        song_names = [s["name"] for s in song_list]
        bgm_dropdown_options = [tr("None"), tr("Random")] + song_names
        saved_bgm_index = 1
        if saved_bgm_type == "none":
            saved_bgm_index = 0
        elif saved_bgm_type == "random":
            saved_bgm_index = 1
        elif saved_bgm_type in song_names:
            saved_bgm_index = bgm_dropdown_options.index(saved_bgm_type)
        selected_bgm = st.selectbox(
            tr("Background Music"),
            options=bgm_dropdown_options,
            index=saved_bgm_index,
            key="bgm_song_select",
        )
        if selected_bgm == tr("None"):
            params.bgm_type = "none"
            params.bgm_file = ""
        elif selected_bgm == tr("Random"):
            params.bgm_type = "random"
            params.bgm_file = ""
        else:
            params.bgm_type = "custom"
            params.bgm_file = selected_bgm
            selected_song_path = None
            for s in song_list:
                if s["name"] == selected_bgm:
                    selected_song_path = s["path"]
                    break
            if selected_song_path and os.path.isfile(selected_song_path):
                st.audio(selected_song_path, format="audio/mp3")
        config.ui["bgm_type"] = params.bgm_type
        saved_bgm_volume = config.app.get("bgm_volume", 0.2)
        bgm_vol_options = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        bgm_vol_index = 2
        if saved_bgm_volume in bgm_vol_options:
            bgm_vol_index = bgm_vol_options.index(saved_bgm_volume)
        params.bgm_volume = st.selectbox(
            tr("Background Music Volume"),
            options=bgm_vol_options,
            index=bgm_vol_index,
        )

def render_subtitle_settings_section(params):
    with st.container(border=True):
        st.write(tr("Subtitle Settings"))
        params.subtitle_enabled = st.checkbox(tr("Enable Subtitles"), value=True)

        if st.session_state.get("layout_mode") == "slices":
            render_font_gallery(params)
        else:
            font_names = get_all_fonts()
            saved_font_name = config.ui.get("font_name", "Charm-Regular.ttf")
            saved_font_name_index = 0
            if saved_font_name in font_names:
                saved_font_name_index = font_names.index(saved_font_name)
            params.font_name = st.selectbox(
                tr("Font"), font_names, index=saved_font_name_index
            )
            config.ui["font_name"] = params.font_name

        st.divider()

        with st.container(border=True, key="subtitle_position_group"):
            subtitle_positions = [
                (tr("Top"), "top"),
                (tr("Center"), "center"),
                (tr("Bottom"), "bottom"),
                (tr("Custom"), "custom"),
            ]
            saved_subtitle_position = config.ui.get("subtitle_position", "bottom")
            saved_position_index = 2
            for i, (_, pos_value) in enumerate(subtitle_positions):
                if pos_value == saved_subtitle_position:
                    saved_position_index = i
                    break
            selected_index = st.selectbox(
                tr("Position"),
                index=saved_position_index,
                options=range(len(subtitle_positions)),
                format_func=lambda x: subtitle_positions[x][0],
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

        appearance_cols = st.columns(2, gap="large")
        with appearance_cols[0]:
            with st.container(border=True, key="subtitle_font_group"):
                st.markdown(f"**{tr('Font')}**")
                font_controls = st.columns([1, 3], vertical_alignment="bottom")
                with font_controls[0]:
                    saved_text_fore_color = config.ui.get(
                        "text_fore_color", "#FFFFFF"
                    )
                    params.text_fore_color = _centered_color_picker(
                        tr("Font Color"),
                        saved_text_fore_color,
                        key="subtitle_font_color_picker",
                    )
                    config.ui["text_fore_color"] = params.text_fore_color
                with font_controls[1]:
                    saved_font_size = config.ui.get("font_size", 60)
                    params.font_size = _centered_slider(
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
                    params.stroke_color = _centered_color_picker(
                        tr("Stroke Color"),
                        "#000000",
                        key="subtitle_stroke_color_picker",
                    )
                with stroke_controls[1]:
                    params.stroke_width = _centered_slider(
                        tr("Stroke Width"),
                        0.0,
                        10.0,
                        1.5,
                        key="subtitle_stroke_width_slider",
                    )

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
            selected_background_color = _centered_color_picker(
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


def render_publish_section(params):
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


def render_quality_section(params):
    with st.expander(tr("Personal Quality"), expanded=False):
        quality_enabled = st.checkbox(
            tr("Enable quality enhancements"),
            value=bool(config.quality.get("enabled", False)),
            help=tr("Optional. When off, the video is generated exactly as before."),
        )
        params.quality_enabled = quality_enabled
        if quality_enabled:
            _q_profiles = ["fast", "balanced", "high", "archival"]
            _q_platforms = ["shorts", "reels", "tiktok", "landscape"]
            _q_styles = ["classic", "clean", "premium", "karaoke", "documentary"]

            def _q_index(options, value, fallback):
                return options.index(value) if value in options else fallback

            q_cols = st.columns(3)
            with q_cols[0]:
                st.markdown(f"**{tr('Render')}**")
                params.quality_profile = st.selectbox(
                    tr("Quality Profile"),
                    options=_q_profiles,
                    index=_q_index(_q_profiles, str(config.quality.get("profile", "balanced")), 1),
                    help=tr("Higher quality renders slower (high/archival use a lower CRF)."),
                )
                params.quality_target_platform = st.selectbox(
                    tr("Target Platform"),
                    options=_q_platforms,
                    index=_q_index(_q_platforms, str(config.quality.get("target_platform", "shorts")), 0),
                    help=tr("Sets the subtitle safe-area for the destination format."),
                )
            with q_cols[1]:
                st.markdown(f"**{tr('Subtitles')}**")
                params.quality_subtitle_style = st.selectbox(
                    tr("Subtitle Style"),
                    options=_q_styles,
                    index=_q_index(_q_styles, str(config.quality.get("subtitle_style", "premium")), 2),
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
            st.markdown("---")
            st.markdown(f"**{tr('Local Material Library')}**")
            _lib_conn = None
            try:
                _lib_conn = _local_lib.connect(_local_lib_db_path())
                _lib_entries = _local_lib.all_entries(_lib_conn)
                _lib_total = len(_lib_entries)
                _lib_videos = sum(1 for e in _lib_entries if e.media_type == "video")
                _lib_images = sum(1 for e in _lib_entries if e.media_type == "image")
                _lib_duration = sum(e.duration for e in _lib_entries)
                if _lib_total == 0:
                    st.info(
                        "La biblioteca esta vacia. Agrega videos para poder usarlos en tus proyectos."
                    )
                else:
                    st.markdown(
                        f"**{_lib_total} entries** — "
                        f"{_lib_videos} video(s), {_lib_images} image(s) — "
                        f"{_lib_duration:.0f}s total duration"
                    )
                    _lib_rows = [
                        {
                            "path": e.path,
                            "type": e.media_type,
                            "duration": f"{e.duration:.1f}s",
                            "source": e.source or "",
                            "tags": ",".join(e.tags),
                        }
                        for e in _lib_entries[:50]
                    ]
                    st.dataframe(_lib_rows, use_container_width=True)

                st.markdown(f"**{tr('Index a directory:')}**")
                _idx_col1, _idx_col2 = st.columns([3, 1])
                with _idx_col1:
                    _index_dir = st.text_input(
                        tr("Directory path"),
                        key="lib_index_dir",
                        placeholder="/path/to/your/videos",
                    )
                with _idx_col2:
                    _index_source = st.text_input(
                        tr("Source label"),
                        value="user",
                        key="lib_index_source",
                    )
                if st.button(tr("Index directory"), key="lib_index_btn"):
                    if _index_dir and os.path.isdir(_index_dir):
                        try:
                            _idx_tags = []
                            _idx_stats = _local_lib.index_directory(
                                _lib_conn,
                                _index_dir,
                                source=_index_source,
                                tags=_idx_tags,
                            )
                            st.success(
                                f"scanned={_idx_stats['scanned']} "
                                f"added={_idx_stats['added']} "
                                f"updated={_idx_stats['updated']} "
                                f"skipped={_idx_stats['skipped']}"
                            )
                        except Exception as _idx_exc:
                            st.error(str(_idx_exc))
                    else:
                        st.error(tr("Directory not found or invalid path."))
            except Exception as _lib_exc:
                st.error(f"Local library error: {_lib_exc}")
            finally:
                if _lib_conn is not None:
                    _lib_conn.close()


def _mask_api_key(key: str) -> str:
    if not key:
        return ""
    suffix = key[-4:] if len(key) >= 4 else key
    return f"****{suffix}"


def render_api_key_management():
    with st.expander(tr("Click to show API Key management"), expanded=False):
        st.subheader(tr("Manage Pexels, Pixabay and Coverr API Keys"))

        col1, col2, col3 = st.tabs([
            tr("Pexels API Keys"),
            tr("Pixabay API Keys"),
            tr("Coverr API Keys"),
        ])

        with col1:
            st.subheader(tr("Pexels API Keys"))
            if config.app["pexels_api_keys"]:
                st.write(tr("Current Keys:"))
                for key in config.app["pexels_api_keys"]:
                    st.code(_mask_api_key(key))
            else:
                st.info(tr("No Pexels API Keys currently"))

            new_key = st.text_input(tr("Add Pexels API Key"), key="pexels_new_key")
            if st.button(tr("Add Pexels API Key")):
                if new_key and new_key not in config.app["pexels_api_keys"]:
                    config.app["pexels_api_keys"].append(new_key)
                    config.save_config()
                    st.success(tr("Pexels API Key added successfully"))
                elif new_key in config.app["pexels_api_keys"]:
                    st.warning(tr("This API Key already exists"))
                else:
                    st.error(tr("Please enter a valid API Key"))

            if config.app["pexels_api_keys"]:
                pexels_key_labels = [
                    f"{_mask_api_key(k)} (#{i+1})"
                    for i, k in enumerate(config.app["pexels_api_keys"])
                ]
                delete_index = st.selectbox(
                    tr("Select Pexels API Key to delete"),
                    options=range(len(pexels_key_labels)),
                    format_func=lambda i: pexels_key_labels[i],
                    key="pexels_delete_key",
                )
                if st.button(tr("Delete Selected Pexels API Key")):
                    config.app["pexels_api_keys"].pop(delete_index)
                    config.save_config()
                    st.success(tr("Pexels API Key deleted successfully"))

        with col2:
            st.subheader(tr("Pixabay API Keys"))
            if config.app["pixabay_api_keys"]:
                st.write(tr("Current Keys:"))
                for key in config.app["pixabay_api_keys"]:
                    st.code(_mask_api_key(key))
            else:
                st.info(tr("No Pixabay API Keys currently"))

            new_key = st.text_input(tr("Add Pixabay API Key"), key="pixabay_new_key")
            if st.button(tr("Add Pixabay API Key")):
                if new_key and new_key not in config.app["pixabay_api_keys"]:
                    config.app["pixabay_api_keys"].append(new_key)
                    config.save_config()
                    st.success(tr("Pixabay API Key added successfully"))
                elif new_key in config.app["pixabay_api_keys"]:
                    st.warning(tr("This API Key already exists"))
                else:
                    st.error(tr("Please enter a valid API Key"))

            if config.app["pixabay_api_keys"]:
                pixabay_key_labels = [
                    f"{_mask_api_key(k)} (#{i+1})"
                    for i, k in enumerate(config.app["pixabay_api_keys"])
                ]
                delete_index = st.selectbox(
                    tr("Select Pixabay API Key to delete"),
                    options=range(len(pixabay_key_labels)),
                    format_func=lambda i: pixabay_key_labels[i],
                    key="pixabay_delete_key",
                )
                if st.button(tr("Delete Selected Pixabay API Key")):
                    config.app["pixabay_api_keys"].pop(delete_index)
                    config.save_config()
                    st.success(tr("Pixabay API Key deleted successfully"))

        with col3:
            st.subheader(tr("Coverr API Keys"))
            if "coverr_api_keys" not in config.app or config.app["coverr_api_keys"] is None:
                config.app["coverr_api_keys"] = []

            if config.app["coverr_api_keys"]:
                st.write(tr("Current Keys:"))
                for key in config.app["coverr_api_keys"]:
                    st.code(_mask_api_key(key))
            else:
                st.info(tr("No Coverr API Keys currently"))

            new_key = st.text_input(tr("Add Coverr API Key"), key="coverr_new_key")
            if st.button(tr("Add Coverr API Key")):
                if new_key and new_key not in config.app["coverr_api_keys"]:
                    config.app["coverr_api_keys"].append(new_key)
                    config.save_config()
                    st.success(tr("Coverr API Key added successfully"))
                elif new_key in config.app["coverr_api_keys"]:
                    st.warning(tr("This API Key already exists"))
                else:
                    st.error(tr("Please enter a valid API Key"))

            if config.app["coverr_api_keys"]:
                coverr_key_labels = [
                    f"{_mask_api_key(k)} (#{i+1})"
                    for i, k in enumerate(config.app["coverr_api_keys"])
                ]
                delete_index = st.selectbox(
                    tr("Select Coverr API Key to delete"),
                    options=range(len(coverr_key_labels)),
                    format_func=lambda i: coverr_key_labels[i],
                    key="coverr_delete_key",
                )
                if st.button(tr("Delete Selected Coverr API Key")):
                    config.app["coverr_api_keys"].pop(delete_index)
                    config.save_config()
                    st.success(tr("Coverr API Key deleted successfully"))


# ── Layout mode dispatch ────────────────────────────────────────────────────
if st.session_state["layout_mode"] == "vertical":
    panel = st.columns(3)
    with panel[0]:
        render_script_section(params)
    with panel[1]:
        render_video_settings_section(params)
        render_audio_settings_section(params)
    with panel[2]:
        render_subtitle_settings_section(params)
        render_publish_section(params)
    render_quality_section(params)
    render_api_key_management()
else:
    tab_labels = [
        tr("Script"),
        tr("Video"),
        tr("Audio"),
        tr("Subtitles"),
        tr("Publish"),
        tr("Quality"),
    ]
    tab_script, tab_video, tab_audio, tab_subtitles, tab_publish, tab_quality = st.tabs(tab_labels)
    with tab_script:
        render_script_section(params)
    with tab_video:
        render_video_settings_section(params)
    with tab_audio:
        render_audio_settings_section(params)
    with tab_subtitles:
        render_subtitle_settings_section(params)
    with tab_publish:
        render_publish_section(params)
    with tab_quality:
        render_quality_section(params)
    render_api_key_management()

# ── Persist all settings to config ──────────────────────────────────────────
config.app["video_subject"] = st.session_state.get("video_subject", "")
config.app["video_script"] = st.session_state.get("video_script", "")
config.app["video_terms"] = st.session_state.get("video_terms", "")
config.app["video_script_prompt"] = st.session_state.get("video_script_prompt", "")
config.app["paragraph_number"] = st.session_state.get("paragraph_number_input", 1)
config.app["voice_volume"] = params.voice_volume
config.app["voice_rate"] = params.voice_rate
config.app["bgm_volume"] = params.bgm_volume
config.app["video_clip_duration"] = params.video_clip_duration
config.app["video_count"] = params.video_count

if st.session_state.pop("save_project_requested", False):
    _save_project_snapshot(params, status="draft")
    st.success(tr("Draft saved"))

start_button = st.button(tr("Generate Video"), use_container_width=True, type="primary")
if start_button:
    task_id = str(uuid4())
    _set_project_id(params, _ensure_active_project_id())
    _save_project_snapshot(params, status="generating", task_id=task_id)
    config.save_config()
    if not params.video_subject and not params.video_script:
        st.error(tr("Video Script and Subject Cannot Both Be Empty"))
        scroll_to_bottom()
        st.stop()

    if params.video_source not in ["pexels", "pixabay", "coverr", "local", "local_folder"]:
        st.error(tr("Please Select a Valid Video Source"))
        scroll_to_bottom()
        st.stop()

    if params.video_source == "pexels" and not config.app.get("pexels_api_keys", ""):
        st.error(tr("Please Enter the Pexels API Key"))
        scroll_to_bottom()
        st.stop()

    if params.video_source == "pixabay" and not config.app.get("pixabay_api_keys", ""):
        st.error(tr("Please Enter the Pixabay API Key"))
        scroll_to_bottom()
        st.stop()

    if params.video_source == "coverr" and not config.app.get("coverr_api_keys", ""):
        st.error(tr("Please Enter the Coverr API Key"))
        scroll_to_bottom()
        st.stop()

    if uploaded_audio_file:
        task_dir = utils.task_dir(task_id)
        # 上传文件名来自浏览器，不能直接拼到磁盘路径里；这里只保留扩展名，
        # 并使用固定文件名保存到当前任务目录，避免路径穿越或特殊字符问题。
        _, audio_ext = os.path.splitext(os.path.basename(uploaded_audio_file.name))
        audio_ext = audio_ext.lower() or ".mp3"
        custom_audio_path = os.path.join(task_dir, f"custom-audio{audio_ext}")
        with open(custom_audio_path, "wb") as f:
            f.write(uploaded_audio_file.getbuffer())
        params.custom_audio_file = custom_audio_path

    if uploaded_files:
        local_videos_dir = utils.storage_dir("local_videos", create=True)
        # 每次重新上传时都以本次选择的素材为准，避免旧素材不断重复追加。
        params.video_materials = []
        persisted_local_materials = []
        for sequence, file in enumerate(uploaded_files, start=1):
            safe_filename = file_security.build_local_media_filename(
                params.video_subject,
                file.name,
                task_id,
                sequence,
            )
            file_path = file_security.resolve_path_within_directory(
                local_videos_dir,
                safe_filename,
                require_file=False,
            )
            with open(file_path, "wb") as f:
                f.write(file.getbuffer())
                m = MaterialInfo()
                m.provider = "local"
                m.url = file_path
                params.video_materials.append(m)
                persisted_local_materials.append(
                    {
                        "provider": m.provider,
                        "url": m.url,
                        "duration": m.duration,
                    }
                )
        # 将已上传并保存到本地的视频素材写入会话，供后续只改文案时直接复用。
        st.session_state["local_video_materials"] = persisted_local_materials
    elif params.video_source == "local" and st.session_state["local_video_materials"]:
        # 当用户没有重新上传文件时，复用最近一次已经保存到磁盘的本地素材列表。
        params.video_materials = []
        for material in st.session_state["local_video_materials"]:
            m = MaterialInfo()
            m.provider = material.get("provider", "local")
            m.url = material.get("url", "")
            m.duration = material.get("duration", 0)
            if m.url:
                params.video_materials.append(m)

    if params.video_source == "local_folder":
        local_folder_path = utils.storage_dir("local_videos", create=True)
        selected = st.session_state.get("selected_folder_files", [])
        params.video_materials = []
        for fname in selected:
            fpath = os.path.join(local_folder_path, fname)
            if os.path.isfile(fpath):
                m = MaterialInfo()
                m.provider = "local"
                m.url = fpath
                params.video_materials.append(m)

    log_container = st.empty()
    log_records = []

    def log_received(msg):
        if config.ui["hide_log"]:
            return
        with log_container:
            log_records.append(msg)
            st.code("\n".join(log_records))

    logger.add(log_received)

    st.toast(tr("Generating Video"))
    logger.info(tr("Start Generating Video"))
    logger.info(utils.to_json(params))
    scroll_to_bottom()

    result = tm.start(task_id=task_id, params=params)
    if not result or "videos" not in result:
        _save_project_snapshot(params, status="failed", task_id=task_id)
        st.error(tr("Video Generation Failed"))
        logger.error(tr("Video Generation Failed"))
        scroll_to_bottom()
        st.stop()

    video_files = result.get("videos", [])
    _save_project_snapshot(
        params,
        status="completed",
        artifacts=result,
        task_id=task_id,
    )
    st.success(tr("Video Generation Completed"))
    try:
        if video_files:
            player_cols = st.columns(len(video_files) * 2 + 1)
            for i, url in enumerate(video_files):
                player_cols[i * 2 + 1].video(url)
    except Exception:
        pass

    # Show quality stack sidecar download links if present
    sidecar_items = []
    for key, label in [
        ("content_package", tr("Content Package (JSON)")),
        ("manifest", tr("Render Manifest")),
        ("word_timestamps", tr("Word Timestamps")),
    ]:
        path_val = result.get(key)
        if path_val and isinstance(path_val, str) and os.path.isfile(path_val):
            try:
                task_root = utils.task_dir()
                rel = os.path.relpath(path_val, task_root).replace("\\", "/")
                url = f"/tasks/{rel}"
            except Exception:
                url = None
            sidecar_items.append((label, url, path_val))

    if sidecar_items:
        st.markdown("---")
        st.markdown(f"**{tr('Generated files (Quality Stack):')}**")
        for label, url, local_path in sidecar_items:
            if url:
                st.markdown(f"- [{label}]({url})")
            else:
                st.markdown(f"- {label}: `{local_path}`")

    open_task_folder(task_id)
    logger.info(tr("Video Generation Completed"))
    scroll_to_bottom()

config.save_config()
