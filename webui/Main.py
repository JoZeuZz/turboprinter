import inspect
import os
import sys
import webbrowser
from uuid import UUID, uuid4

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
    VideoParams,
)
from app.services import llm, project_store
from app.services import task as tm
from app.utils import file_security, utils
from webui.components.api_keys import render_api_key_management
from webui.components.audio import render_audio_settings_section
from webui.components.projects import (
    ensure_active_project_id as _ensure_active_project_id,
    render_project_control,
    save_project_snapshot as _save_project_snapshot,
)
from webui.components.publish import render_publish_section
from webui.components.quality import render_quality_section
from webui.components.subtitles import render_subtitle_settings_section
from webui.components.video import render_video_settings_section
from webui.styles import STREAMLIT_STYLE

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


st.markdown(STREAMLIT_STYLE, unsafe_allow_html=True)

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
render_project_control(tr)
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


# ── Layout mode dispatch ────────────────────────────────────────────────────
if st.session_state["layout_mode"] == "vertical":
    panel = st.columns(3)
    with panel[0]:
        render_script_section(params)
    with panel[1]:
        uploaded_files = render_video_settings_section(params, tr)
        uploaded_audio_file = render_audio_settings_section(params, song_dir, tr)
    with panel[2]:
        render_subtitle_settings_section(params, font_dir, tr)
        render_publish_section(params, tr)
    render_quality_section(params, tr)
    render_api_key_management(tr)
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
        uploaded_files = render_video_settings_section(params, tr)
    with tab_audio:
        uploaded_audio_file = render_audio_settings_section(params, song_dir, tr)
    with tab_subtitles:
        render_subtitle_settings_section(params, font_dir, tr)
    with tab_publish:
        render_publish_section(params, tr)
    with tab_quality:
        render_quality_section(params, tr)
    render_api_key_management(tr)

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
