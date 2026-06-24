import os
from collections.abc import Callable

import streamlit as st

from app.config import config
from app.services import voice
from webui.components.media import get_all_songs_with_path
from webui.components.voice_gallery import (
    render_voice_gallery,
    synthesize_voice_preview,
)


Translator = Callable[[str], str]


def render_audio_settings_section(params, song_dir: str, tr: Translator):
    uploaded_audio_file = None
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
        selected_tts_server = _render_tts_server_selector(tts_servers)
        filtered_voices = _voices_for_server(selected_tts_server)
        voice_name = _render_voice_selector(
            filtered_voices,
            params,
            selected_tts_server,
            tr,
        )
        _render_provider_settings(selected_tts_server, voice_name, tr)
        _render_voice_tuning(params, tr)
        uploaded_audio_file = _render_custom_audio_uploader(tr)
        _render_background_music(params, song_dir, tr)
    return uploaded_audio_file


def _render_tts_server_selector(tts_servers):
    saved_tts_server = config.ui.get("tts_server", "azure-tts-v1")
    saved_tts_server_index = 0
    for index, (server_value, _) in enumerate(tts_servers):
        if server_value == saved_tts_server:
            saved_tts_server_index = index
            break

    selected_tts_server_index = st.selectbox(
        "TTS Servers",
        options=range(len(tts_servers)),
        format_func=lambda index: tts_servers[index][1],
        index=saved_tts_server_index,
    )

    selected_tts_server = tts_servers[selected_tts_server_index][0]
    config.ui["tts_server"] = selected_tts_server
    return selected_tts_server


def _voices_for_server(selected_tts_server: str) -> list[str]:
    if selected_tts_server == voice.NO_VOICE_NAME:
        return [voice.NO_VOICE_NAME]
    if selected_tts_server == "siliconflow":
        return voice.get_siliconflow_voices()
    if selected_tts_server == "gemini-tts":
        return voice.get_gemini_voices()
    if selected_tts_server == "mimo-tts":
        return voice.get_mimo_voices()

    all_voices = voice.get_all_azure_voices(filter_locals=None)
    filtered_voices = []
    for item in all_voices:
        if selected_tts_server == "azure-tts-v2":
            if "V2" in item:
                filtered_voices.append(item)
        elif "V2" not in item:
            filtered_voices.append(item)
    return filtered_voices


def _render_voice_selector(filtered_voices, params, selected_tts_server: str, tr: Translator):
    if selected_tts_server == voice.NO_VOICE_NAME:
        friendly_names = {voice.NO_VOICE_NAME: tr("No Voice")}
    else:
        friendly_names = {
            item: item.replace("Female", tr("Female"))
            .replace("Male", tr("Male"))
            .replace("Neural", "")
            for item in filtered_voices
        }

    saved_voice_name = config.ui.get("voice_name", "")
    saved_voice_name_index = 0
    if saved_voice_name in friendly_names:
        saved_voice_name_index = list(friendly_names.keys()).index(saved_voice_name)
    else:
        for index, item in enumerate(filtered_voices):
            if item.lower().startswith(st.session_state["ui_language"].lower()):
                saved_voice_name_index = index
                break
    if saved_voice_name_index >= len(friendly_names) and friendly_names:
        saved_voice_name_index = 0

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
                tr,
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
        st.warning(
            tr(
                "No voices available for the selected TTS server. Please select another server."
            )
        )
        params.voice_name = ""
        config.ui["voice_name"] = ""

    if (
        friendly_names
        and st.session_state.get("layout_mode") != "slices"
        and selected_tts_server != voice.NO_VOICE_NAME
        and st.button(tr("Play Voice"))
    ):
        play_content = params.video_subject or params.video_script or tr("Voice Example")
        synthesize_voice_preview(
            voice_name,
            play_content,
            config.app.get("voice_rate", 1.0),
            config.app.get("voice_volume", 1.0),
            tr,
        )
        preview_audio = st.session_state.get("voice_preview_audio")
        if preview_audio:
            st.audio(preview_audio, format="audio/mp3")

    return voice_name


def _render_provider_settings(selected_tts_server: str, voice_name: str, tr: Translator) -> None:
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


def _render_voice_tuning(params, tr: Translator) -> None:
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


def _render_custom_audio_uploader(tr: Translator):
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
    return uploaded_audio_file


def _render_background_music(params, song_dir: str, tr: Translator) -> None:
    saved_bgm_type = config.ui.get("bgm_type", "random")
    song_list = get_all_songs_with_path(song_dir)
    song_names = [song["name"] for song in song_list]
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
        for song in song_list:
            if song["name"] == selected_bgm:
                selected_song_path = song["path"]
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
