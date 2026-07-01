import html
import os
from collections.abc import Callable
from uuid import uuid4

import streamlit as st
from loguru import logger

from app.config import config
from app.services import voice
from app.utils import utils


Translator = Callable[[str], str]


def voice_metadata(voice_id, tr: Translator) -> dict[str, str]:
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


def voice_preview_example(language_code: str) -> str:
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


def sync_voice_preview_language() -> None:
    language_code = st.session_state.get("voice_language_filter", "all")
    if language_code == "all":
        language_code = st.session_state.get("voice_gallery_selected_language", "en")
    next_default = voice_preview_example(language_code)
    current_text = st.session_state.get("voice_preview_text", "")
    previous_default = st.session_state.get("voice_preview_default_text", "")
    if not current_text or current_text == previous_default:
        st.session_state["voice_preview_text"] = next_default
    st.session_state["voice_preview_default_text"] = next_default


def voice_card_html(metadata: dict[str, str], preview_text: str, tr: Translator) -> str:
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


def synthesize_voice_preview(
    voice_name: str,
    preview_text: str,
    voice_rate: float,
    voice_volume: float,
    tr: Translator,
) -> None:
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


def render_voice_gallery(filtered_voices, params, selected_tts_server, tr: Translator):
    metadata = [voice_metadata(item, tr) for item in filtered_voices]
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
        default_preview_text = voice_preview_example(selected_metadata["language_code"])
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
            on_change=sync_voice_preview_language,
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
            (index for index, item in enumerate(visible) if item["id"] == selected_voice),
            0,
        )
        st.session_state["voice_gallery_page"] = selected_index // 3
        st.session_state["voice_gallery_page_initialized"] = True
        st.session_state["voice_filter_signature"] = filter_signature
    page_size = 3
    total_pages = max(1, (len(visible) + page_size - 1) // page_size)
    if not st.session_state.get("voice_gallery_page_initialized", False):
        selected_index = next(
            (index for index, item in enumerate(visible) if item["id"] == selected_voice),
            0,
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
                else voice_preview_example(item["language_code"])
            )
            is_selected = item["id"] == selected_voice
            card_token = utils.md5(item["id"])
            card_state = "selected" if is_selected else "idle"
            with st.container(
                border=True,
                key=f"voice_card_{card_state}_{card_token}",
            ):
                st.markdown(
                    voice_card_html(item, card_preview_text, tr),
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
                            sync_voice_preview_language()
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
        synthesize_voice_preview(
            preview_request[0],
            preview_request[1],
            config.app.get("voice_rate", 1.0),
            config.app.get("voice_volume", 1.0),
            tr,
        )
    preview_audio = st.session_state.get("voice_preview_audio")
    if preview_audio:
        with st.container(key="voice_preview_player"):
            st.audio(preview_audio, format="audio/mp3", autoplay=True)

    params.voice_name = st.session_state["voice_gallery_selected"]
    config.ui["voice_name"] = params.voice_name
    return params.voice_name
