import json
import logging
import re
import requests
from typing import List

import httpx
from loguru import logger
from openai import AzureOpenAI, OpenAI
from openai.types.chat import ChatCompletion

from app.config import config

_max_retries = 5
_DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
_DEPRECATED_GEMINI_MODELS = {"gemini-pro", "gemini-1.0-pro"}

# DeepSeek 是本 fork 推荐的低成本主力 provider。官方文档（api-docs.deepseek.com）
# 的示例当前使用 deepseek-v4 系列，因此这里把推荐默认模型设为 deepseek-v4-flash。
# deepseek-chat / deepseek-reasoner 仍然可用（对应 V3.2 的非思考/思考模式），
# 但为了避免用户长期沿用旧别名，命中时会提示去官方文档确认时效并建议迁移。
_DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash"
_DEEPSEEK_LEGACY_MODELS = {"deepseek-chat", "deepseek-reasoner"}
# 默认全局 LLM provider，保持与 upstream 一致；个人 fork 想用 DeepSeek 时，
# 需要在 config.toml 里显式设置 llm_provider = "deepseek"。
_DEFAULT_LLM_PROVIDER = "openai"
MIN_SCRIPT_PARAGRAPH_NUMBER = 1
MAX_SCRIPT_PARAGRAPH_NUMBER = 10
MAX_SCRIPT_PROMPT_LENGTH = 2000
MAX_SCRIPT_SYSTEM_PROMPT_LENGTH = 8000
_THINK_BLOCK_RE = re.compile(r"<think\b[^>]*>.*?</think>", re.IGNORECASE | re.DOTALL)
_UNCLOSED_THINK_BLOCK_RE = re.compile(r"<think\b[^>]*>.*$", re.IGNORECASE | re.DOTALL)
_URL_USERINFO_RE = re.compile(r"((?:https?|wss?)://)([^/\s?#@]*:[^/\s?#@]*@)", re.IGNORECASE)
_SENSITIVE_QUERY_RE = re.compile(
    r"([?&](?:api[_-]?key|access[_-]?token|token|key|secret|password)=)([^&#\s]+)",
    re.IGNORECASE,
)

DEFAULT_SCRIPT_SYSTEM_PROMPT = """
# Role: Video Script Generator

## Goals:
Generate a script for a video, depending on the subject of the video.

## Constrains:
1. the script is to be returned as a string with the specified number of paragraphs.
2. do not under any circumstance reference this prompt in your response.
3. get straight to the point, don't start with unnecessary things like, "welcome to this video".
4. you must not include any type of markdown or formatting in the script, never use a title.
5. only return the raw content of the script.
6. do not include "voiceover", "narrator" or similar indicators of what should be spoken at the beginning of each paragraph or line.
7. you must not mention the prompt, or anything about the script itself. also, never talk about the amount of paragraphs or lines. just write the script.
8. respond in the same language as the video subject.
""".strip()


def _normalize_text_response(content, llm_provider: str) -> str:
    # 不同 LLM SDK 在异常或被拦截场景下，可能返回 None、空字符串，
    # 甚至返回非字符串对象。这里统一做兜底校验，避免后续直接调用
    # `.replace()` 时抛出 `NoneType` 之类的属性错误。
    if content is None:
        raise ValueError(f"[{llm_provider}] returned empty text content")

    if not isinstance(content, str):
        raise TypeError(
            f"[{llm_provider}] returned non-text content: {type(content).__name__}"
        )

    # MiniMax M3、DeepSeek R1 这类 reasoning 模型可能会把内部推理包在
    # `<think>...</think>` 中返回。视频脚本和关键词只需要最终可朗读文本，
    # 如果不在服务层统一清理，WebUI、字幕和配音都会把思考过程当正文处理。
    content = _THINK_BLOCK_RE.sub("", content)
    content = _UNCLOSED_THINK_BLOCK_RE.sub("", content).strip()
    if not content:
        raise ValueError(f"[{llm_provider}] returned empty text content")

    return content.replace("\n", "")


def _sanitize_error_message(error: object) -> str:
    """
    清理返回给 WebUI/API 的错误信息，避免自定义 base_url 中的凭据泄露。

    一些 OpenAI-compatible SDK 会把请求 URL 原样拼进异常信息。如果用户为了
    代理网关配置了 `https://user:pass@example.com/v1`，直接返回 `str(e)`
    就会把密码暴露给页面、API 调用方或后续日志。这里仅处理错误文案，不改变
    实际请求地址，避免影响正常调用链路。
    """
    message = str(error)
    message = _URL_USERINFO_RE.sub(r"\1***:***@", message)
    message = _SENSITIVE_QUERY_RE.sub(r"\1***", message)
    return message


def _extract_chat_completion_text(response, llm_provider: str) -> str:
    # OpenAI 兼容接口在异常场景下，可能返回没有 choices、
    # 或者 choices/message/content 为空的响应对象。
    # 这里统一做结构校验，避免出现 `NoneType is not subscriptable`
    # 这类底层属性访问错误。
    choices = getattr(response, "choices", None)
    if not choices:
        raise ValueError(f"[{llm_provider}] returned empty choices")

    first_choice = choices[0]
    message = getattr(first_choice, "message", None)
    if message is None:
        raise ValueError(f"[{llm_provider}] returned empty message")

    content = getattr(message, "content", None)
    return _normalize_text_response(content, llm_provider)


def _get_llm_timeout():
    """
    返回可选的 LLM 请求超时配置。

    没有配置任何超时时返回 None，保持与现有行为完全一致；配置了连接或
    请求超时时返回 httpx.Timeout，避免某个 provider 卡死整条生成链路。
    config 缺键时全部走默认，符合“配置容错”的要求。
    """
    request_timeout = config.app.get("llm_request_timeout_seconds")
    connect_timeout = config.app.get("llm_connect_timeout_seconds")
    if not request_timeout and not connect_timeout:
        return None

    try:
        total = float(request_timeout) if request_timeout else 120.0
        connect = float(connect_timeout) if connect_timeout else min(total, 30.0)
    except (TypeError, ValueError):
        logger.warning(
            "invalid llm timeout config, falling back to default SDK timeout"
        )
        return None

    return httpx.Timeout(total, connect=connect)


def _create_openai_compatible_client(api_key: str, base_url: str, timeout=None):
    """
    创建 OpenAI 兼容客户端。

    单独封装是为了让 DeepSeek 等 OpenAI 兼容 provider 复用同一套构造逻辑
    （含可选超时），避免在巨大的分支里重复 `OpenAI(...)` 初始化，也方便单测
    通过 patch `OpenAI` 注入 fake client。
    """
    kwargs = {"api_key": api_key, "base_url": base_url}
    if timeout is not None:
        kwargs["timeout"] = timeout
    return OpenAI(**kwargs)


def _warn_if_deprecated_deepseek_model(model_name: str) -> None:
    """命中 DeepSeek 旧模型别名时提示用户确认时效并建议迁移到推荐模型。"""
    if model_name in _DEEPSEEK_LEGACY_MODELS:
        logger.warning(
            f"deepseek model '{model_name}' is a legacy alias; verify it is still "
            "current in the official docs (https://api-docs.deepseek.com) and "
            f"consider migrating to '{_DEFAULT_DEEPSEEK_MODEL}'."
        )


def _build_deepseek_extra_body(thinking_enabled: bool) -> dict:
    """
    构造 DeepSeek chat completions 的 extra_body。

    生成视频旁白时默认关闭 thinking，避免把推理过程（reasoning_content）
    计费进来，也保证旁白文本干净。参数形态参考官方文档：
    `extra_body={"thinking": {"type": "enabled" | "disabled"}}`。
    """
    return {"thinking": {"type": "enabled" if thinking_enabled else "disabled"}}


def _extract_gemini_text(response, llm_provider: str) -> str:
    """
    从 Gemini SDK 响应中稳健地提取文本。

    Gemini 在被安全策略拦截、返回空 candidate 或结构异常时，直接访问
    `candidates[0].content.parts[0].text` 会抛出难以诊断的 AttributeError/
    IndexError。这里集中处理拦截原因和空响应，返回可读错误，便于 fallback
    或 WebUI 给出明确提示，同时不改变现有 safety_settings。
    """
    feedback = getattr(response, "prompt_feedback", None)
    block_reason = getattr(feedback, "block_reason", None) if feedback else None
    if block_reason:
        raise ValueError(
            f"[{llm_provider}] prompt was blocked by safety filters: {block_reason}"
        )

    candidates = getattr(response, "candidates", None)
    if not candidates:
        raise ValueError(
            f"[{llm_provider}] returned no candidates (possibly blocked or empty)"
        )

    first = candidates[0]
    content = getattr(first, "content", None)
    parts = getattr(content, "parts", None) if content is not None else None
    if not parts:
        finish_reason = getattr(first, "finish_reason", None)
        raise ValueError(
            f"[{llm_provider}] returned empty content (finish_reason={finish_reason})"
        )

    text = getattr(parts[0], "text", None)
    return _normalize_text_response(text, llm_provider)


def _get_response_field(value, key: str):
    """兼容 dict 和 SDK 响应对象的字段读取。"""
    if isinstance(value, dict):
        return value.get(key)

    try:
        return value[key]
    except (KeyError, TypeError, AttributeError):
        return getattr(value, key, None)


def _extract_qwen_generation_text(response) -> str:
    """
    从 DashScope Generation 响应中提取文本。

    Qwen 使用 `messages` 调用时返回的是 chat 结构：
    `output.choices[0].message.content`；旧 completion 形态才会返回
    `output.text`。这里两个路径都兼容，避免 `output.text` 为 None 时
    继续 `.replace()` 触发不可诊断的 AttributeError。
    """
    output = _get_response_field(response, "output")
    choices = _get_response_field(output, "choices") if output else None
    if choices is not None:
        if not choices:
            logger.warning("Qwen returned an empty choices list")
            raise ValueError("[qwen] returned empty choices")

        first_choice = choices[0]
        message = _get_response_field(first_choice, "message")
        content = _get_response_field(message, "content") if message else None
        if content is not None:
            return _normalize_text_response(content, "qwen")

    text = _get_response_field(output, "text") if output else None
    return _normalize_text_response(text, "qwen")


def _resolve_fallback_chain(primary_provider: str) -> list:
    """
    构造 provider 尝试顺序：主 provider 在前，随后是配置的 fallback。

    去重并保持顺序，避免主 provider 同时出现在 fallback 列表里时被重复尝试，
    也避免 fallback 内部重复项造成多余请求。fallback 关闭（空列表）时只返回
    主 provider，行为与现状完全一致。
    """
    chain = [primary_provider]
    raw = config.app.get("llm_fallback_providers", []) or []
    if isinstance(raw, str):
        # 容错：用户可能把 TOML 列表写成逗号分隔字符串。
        raw = [item.strip() for item in raw.split(",") if item.strip()]
    for provider in raw:
        provider = str(provider).strip()
        if provider and provider not in chain:
            chain.append(provider)
    return chain


def _generate_response(prompt: str) -> str:
    """
    生成文本入口（带可选 fallback）。

    默认 fallback 为空时，等价于直接调用主 provider，保持向后兼容。配置了
    `llm_fallback_providers` 时，按顺序尝试主 provider 和各 fallback：某个
    provider 配置不全或调用失败（返回 `Error:` 或抛异常）就记录并尝试下一个，
    全部失败时返回最后一个 provider 的可诊断错误。永远不会打印 API key。
    """
    primary_provider = config.app.get("llm_provider", _DEFAULT_LLM_PROVIDER)
    chain = _resolve_fallback_chain(primary_provider)
    if len(chain) == 1:
        return _generate_response_single(prompt, provider_override=primary_provider)

    last_result = ""
    for index, provider in enumerate(chain):
        logger.info(
            f"llm attempt {index + 1}/{len(chain)} using provider: {provider}"
        )
        try:
            result = _generate_response_single(prompt, provider_override=provider)
        except Exception as e:  # 兜底：single 内部已捕获，这里防御未预期异常
            last_result = f"Error: {_sanitize_error_message(e)}"
            logger.warning(f"provider '{provider}' raised, trying next if available")
            continue

        if isinstance(result, str) and result.startswith("Error:"):
            last_result = result
            logger.warning(
                f"provider '{provider}' failed, trying next if available"
            )
            continue

        if index > 0:
            logger.info(f"fallback provider '{provider}' produced a response")
        return result

    logger.error("all llm providers failed (primary + fallback)")
    return last_result or "Error: all llm providers failed"


def _generate_response_single(prompt: str, provider_override: str | None = None) -> str:
    from app.services.quality.llm_providers import LLMConfigError, LLMProviderError, get_provider

    llm_provider = provider_override or config.app.get("llm_provider", _DEFAULT_LLM_PROVIDER)
    logger.info(f"llm provider: {llm_provider}")

    # Providers with inline implementations below — legacy providers with custom
    # protocols (g4f, qwen, cloudflare, ernie, pollinations, litellm) plus the
    # upstream OpenAI-compatible providers that have test coverage in test_llm.py.
    _inline = {
        "g4f", "qwen", "cloudflare", "ernie", "pollinations", "litellm",
        "moonshot", "ollama", "openai", "aihubmix", "aimlapi", "oneapi",
        "azure", "gemini", "grok", "groq", "minimax", "mimo", "deepseek",
        "modelscope",
    }

    # Unknown / future providers: delegate to the Quality Stack registry.
    if llm_provider not in _inline:
        try:
            provider = get_provider(llm_provider)
            return provider.generate(prompt)
        except LLMConfigError as e:
            logger.error(f"provider config error [{llm_provider}]: {e}")
            return f"Error: {_sanitize_error_message(e)}"
        except LLMProviderError as e:
            logger.error(f"provider call failed [{llm_provider}]: {e}")
            return f"Error: {_sanitize_error_message(e)}"

    # ---- inline provider implementations (upstream-compatible) ----
    try:
        content = ""
        if llm_provider == "g4f":
            if not config.app.get("enable_g4f", False):
                raise ValueError(
                    "g4f provider is disabled by default because it relies on "
                    "reverse-engineered third-party endpoints. Set enable_g4f=true "
                    "in config.toml only if you understand and accept the security, "
                    "reliability, and legal risks."
                )

            logger.warning(
                "g4f provider is enabled. This provider may be unstable and carries "
                "supply-chain and terms-of-service risks. Prefer official providers, "
                "OpenAI-compatible APIs, LiteLLM, Ollama, or local inference for production."
            )
            try:
                import g4f
            except ImportError as e:
                raise ValueError(
                    "g4f package is not installed by default. Install the optional "
                    "dependency with `uv sync --extra g4f` only if you understand "
                    "and accept the provider risks."
                ) from e

            model_name = config.app.get("g4f_model_name", "")
            if not model_name:
                model_name = "gpt-3.5-turbo-16k-0613"
            content = g4f.ChatCompletion.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
            )
        else:
            api_version = ""  # for azure
            if llm_provider == "moonshot":
                api_key = config.app.get("moonshot_api_key")
                model_name = config.app.get("moonshot_model_name")
                base_url = "https://api.moonshot.cn/v1"
            elif llm_provider == "ollama":
                # api_key = config.app.get("openai_api_key")
                api_key = "ollama"  # any string works but you are required to have one
                model_name = config.app.get("ollama_model_name")
                base_url = config.app.get("ollama_base_url", "")
                if not base_url:
                    base_url = config.get_default_ollama_base_url()
            elif llm_provider == "openai":
                api_key = config.app.get("openai_api_key")
                model_name = config.app.get("openai_model_name")
                base_url = config.app.get("openai_base_url", "")
                if not base_url:
                    base_url = "https://api.openai.com/v1"
            elif llm_provider == "aihubmix":
                api_key = config.app.get("aihubmix_api_key")
                model_name = config.app.get("aihubmix_model_name")
                base_url = config.app.get("aihubmix_base_url", "")
                # AIHubMix 兼容 OpenAI Chat Completions 协议。这里使用独立
                # provider 保存合作方的默认网关和推荐模型，避免把推广链接、
                # 默认模型等合作配置混进普通 OpenAI provider，影响现有用户。
                if not base_url:
                    base_url = "https://aihubmix.com/v1"
                if not model_name:
                    model_name = "gpt-5.4-mini"
            elif llm_provider == "aimlapi":
                api_key = config.app.get("aimlapi_api_key")
                model_name = config.app.get("aimlapi_model_name")
                base_url = config.app.get("aimlapi_base_url", "")
                if not base_url:
                    base_url = "https://api.aimlapi.com/v1"
                if not model_name:
                    model_name = "openai/gpt-4o-mini"
            elif llm_provider == "oneapi":
                api_key = config.app.get("oneapi_api_key")
                model_name = config.app.get("oneapi_model_name")
                base_url = config.app.get("oneapi_base_url", "")
            elif llm_provider == "azure":
                api_key = config.app.get("azure_api_key")
                model_name = config.app.get("azure_model_name")
                base_url = config.app.get("azure_base_url", "")
                api_version = config.app.get("azure_api_version", "2024-02-15-preview")
            elif llm_provider == "gemini":
                api_key = config.app.get("gemini_api_key")
                model_name = config.app.get("gemini_model_name")
                base_url = config.app.get("gemini_base_url", "")
                # Gemini 旧模型名已经陆续下线，这里自动兼容历史配置，
                # 避免用户沿用旧值时直接收到 404。
                if not model_name:
                    model_name = _DEFAULT_GEMINI_MODEL
                elif model_name in _DEPRECATED_GEMINI_MODELS:
                    logger.warning(
                        f"gemini model '{model_name}' is deprecated, fallback to '{_DEFAULT_GEMINI_MODEL}'"
                    )
                    model_name = _DEFAULT_GEMINI_MODEL
            elif llm_provider == "grok":
                api_key = config.app.get("grok_api_key")
                model_name = config.app.get("grok_model_name")
                base_url = config.app.get("grok_base_url", "")
                if not base_url:
                    base_url = "https://api.x.ai/v1"
            elif llm_provider == "groq":
                api_key = config.app.get("groq_api_key")
                model_name = config.app.get("groq_model_name")
                if not model_name:
                    model_name = "llama-3.3-70b-versatile"
                base_url = config.app.get("groq_base_url", "")
                if not base_url:
                    base_url = "https://api.groq.com/openai/v1"
            elif llm_provider == "qwen":
                api_key = config.app.get("qwen_api_key")
                model_name = config.app.get("qwen_model_name")
                base_url = "***"
            elif llm_provider == "cloudflare":
                api_key = config.app.get("cloudflare_api_key")
                model_name = config.app.get("cloudflare_model_name")
                account_id = config.app.get("cloudflare_account_id")
                base_url = "***"
            elif llm_provider == "minimax":
                api_key = config.app.get("minimax_api_key")
                model_name = config.app.get("minimax_model_name")
                base_url = config.app.get("minimax_base_url", "")
                if not base_url:
                    base_url = "https://api.minimax.io/v1"
            elif llm_provider == "mimo":
                api_key = config.app.get("mimo_api_key")
                model_name = config.app.get("mimo_model_name")
                base_url = config.app.get("mimo_base_url", "")
                # Xiaomi MiMo 官方文档说明其兼容 OpenAI Chat Completions 协议。
                # 这里使用独立 provider 保存默认地址和模型名，用户不用把 MiMo
                # 当作 OpenAI 自定义 base_url 配置，也便于后续继续接入 MiMo
                # 多模态或 TTS 能力时保持边界清晰。
                if not base_url:
                    base_url = "https://api.xiaomimimo.com/v1"
                if not model_name:
                    model_name = "mimo-v2.5-pro"
            elif llm_provider == "deepseek":
                api_key = config.app.get("deepseek_api_key")
                model_name = config.app.get("deepseek_model_name")
                base_url = config.app.get("deepseek_base_url")
                if not base_url:
                    base_url = "https://api.deepseek.com"
                if not model_name:
                    model_name = _DEFAULT_DEEPSEEK_MODEL
            elif llm_provider == "modelscope":
                api_key = config.app.get("modelscope_api_key")
                model_name = config.app.get("modelscope_model_name")
                base_url = config.app.get("modelscope_base_url")
                if not base_url:
                    base_url = "https://api-inference.modelscope.cn/v1/"
            elif llm_provider == "ernie":
                api_key = config.app.get("ernie_api_key")
                secret_key = config.app.get("ernie_secret_key")
                base_url = config.app.get("ernie_base_url")
                model_name = "***"
                if not secret_key:
                    raise ValueError(
                        f"{llm_provider}: secret_key is not set, please set it in the config.toml file."
                    )
            elif llm_provider == "pollinations":
                try:
                    base_url = config.app.get("pollinations_base_url", "")
                    if not base_url:
                        base_url = "https://text.pollinations.ai/openai"
                    model_name = config.app.get("pollinations_model_name", "openai-fast")

                    # Prepare the payload
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "seed": 101  # Optional but helps with reproducibility
                    }

                    # Optional parameters if configured
                    if config.app.get("pollinations_private"):
                        payload["private"] = True
                    if config.app.get("pollinations_referrer"):
                        payload["referrer"] = config.app.get("pollinations_referrer")

                    headers = {
                        "Content-Type": "application/json"
                    }

                    # Make the API request
                    response = requests.post(
                        base_url, headers=headers, json=payload, timeout=(30, 120)
                    )
                    response.raise_for_status()
                    result = response.json()

                    if result and "choices" in result and len(result["choices"]) > 0:
                        content = result["choices"][0]["message"]["content"]
                        return _normalize_text_response(content, llm_provider)
                    else:
                        raise Exception(f"[{llm_provider}] returned an invalid response format")

                except requests.exceptions.RequestException as e:
                    raise Exception(f"[{llm_provider}] request failed: {str(e)}")
                except Exception as e:
                    raise Exception(f"[{llm_provider}] error: {str(e)}")

            elif llm_provider == "litellm":
                model_name = config.app.get("litellm_model_name")

            if llm_provider not in ["pollinations", "ollama", "litellm"]:  # Skip validation for providers that don't require API key
                if not api_key:
                    raise ValueError(
                        f"{llm_provider}: api_key is not set, please set it in the config.toml file."
                    )
                if not model_name:
                    raise ValueError(
                        f"{llm_provider}: model_name is not set, please set it in the config.toml file."
                    )
                if not base_url and llm_provider not in ["gemini"]:
                    raise ValueError(
                        f"{llm_provider}: base_url is not set, please set it in the config.toml file."
                    )

            if llm_provider == "qwen":
                import dashscope
                from dashscope.api_entities.dashscope_response import GenerationResponse

                dashscope.api_key = api_key
                response = dashscope.Generation.call(
                    model=model_name, messages=[{"role": "user", "content": prompt}]
                )
                if response:
                    if isinstance(response, GenerationResponse):
                        status_code = response.status_code
                        if status_code != 200:
                            raise Exception(
                                f'[{llm_provider}] returned an error response: "{response}"'
                            )

                        return _extract_qwen_generation_text(response)
                    else:
                        raise Exception(
                            f'[{llm_provider}] returned an invalid response: "{response}"'
                        )
                else:
                    raise Exception(f"[{llm_provider}] returned an empty response")

            if llm_provider == "gemini":
                from google import genai
                from google.genai import types as genai_types

                if not base_url:
                    gemini_client = genai.Client(api_key=api_key)
                else:
                    gemini_client = genai.Client(
                        api_key=api_key,
                        http_options={"base_url": base_url},
                    )

                try:
                    response = gemini_client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=genai_types.GenerateContentConfig(
                            temperature=0.5,
                            top_p=1,
                            top_k=1,
                            max_output_tokens=2048,
                            safety_settings=[
                                genai_types.SafetySetting(
                                    category="HARM_CATEGORY_HARASSMENT",
                                    threshold="BLOCK_ONLY_HIGH",
                                ),
                                genai_types.SafetySetting(
                                    category="HARM_CATEGORY_HATE_SPEECH",
                                    threshold="BLOCK_ONLY_HIGH",
                                ),
                                genai_types.SafetySetting(
                                    category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
                                    threshold="BLOCK_ONLY_HIGH",
                                ),
                                genai_types.SafetySetting(
                                    category="HARM_CATEGORY_DANGEROUS_CONTENT",
                                    threshold="BLOCK_ONLY_HIGH",
                                ),
                            ],
                        ),
                    )
                except Exception as e:
                    logger.warning(f"gemini request failed: {str(e)}")
                    raise ValueError(
                        f"[{llm_provider}] request failed: {_sanitize_error_message(e)}"
                    )

                return _extract_gemini_text(response, llm_provider)

            if llm_provider == "deepseek":
                # DeepSeek 兼容 OpenAI Chat Completions 协议，但额外支持 thinking
                # 开关和 reasoning_effort。这里用独立分支隔离这些参数，避免污染
                # 其它 OpenAI 兼容 provider 的通用调用路径。
                _warn_if_deprecated_deepseek_model(model_name)
                thinking_enabled = bool(
                    config.app.get("deepseek_thinking_enabled", False)
                )
                client = _create_openai_compatible_client(
                    api_key=api_key,
                    base_url=base_url,
                    timeout=_get_llm_timeout(),
                )
                create_kwargs = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "extra_body": _build_deepseek_extra_body(thinking_enabled),
                }
                if thinking_enabled:
                    reasoning_effort = config.app.get(
                        "deepseek_reasoning_effort", "high"
                    )
                    if reasoning_effort:
                        create_kwargs["reasoning_effort"] = reasoning_effort

                try:
                    response = client.chat.completions.create(**create_kwargs)
                except Exception as e:
                    # 某些 DeepSeek 模型/网关可能不接受 thinking 或 reasoning_effort
                    # 参数。这里给出明确的可操作提示，而不是把底层 400 直接抛回。
                    message = _sanitize_error_message(e)
                    if "thinking" in message.lower() or "reasoning" in message.lower():
                        raise ValueError(
                            f"[{llm_provider}] request rejected thinking/reasoning "
                            "options. Set deepseek_thinking_enabled = false or verify "
                            f"the model name in config.toml. Original error: {message}"
                        )
                    raise
                return _extract_chat_completion_text(response, llm_provider)

            if llm_provider == "cloudflare":
                response = requests.post(
                    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model_name}",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a friendly assistant",
                            },
                            {"role": "user", "content": prompt},
                        ]
                    },
                    timeout=(30, 120),
                )
                result = response.json()
                logger.info(result)
                return _normalize_text_response(result["result"]["response"], llm_provider)

            if llm_provider == "ernie":
                response = requests.post(
                    "https://aip.baidubce.com/oauth/2.0/token",
                    params={
                        "grant_type": "client_credentials",
                        "client_id": api_key,
                        "client_secret": secret_key,
                    },
                    timeout=(10, 30),
                )
                access_token = response.json().get("access_token")
                url = f"{base_url}?access_token={access_token}"

                payload = json.dumps(
                    {
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.5,
                        "top_p": 0.8,
                        "penalty_score": 1,
                        "disable_search": False,
                        "enable_citation": False,
                        "response_format": "text",
                    }
                )
                headers = {"Content-Type": "application/json"}

                response = requests.request(
                    "POST", url, headers=headers, data=payload, timeout=(30, 120)
                ).json()
                return _normalize_text_response(response.get("result"), llm_provider)

            if llm_provider == "litellm":
                import litellm

                if not model_name:
                    raise ValueError(
                        f"{llm_provider}: model_name is not set, please set it in the config.toml file."
                    )

                response = litellm.completion(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    drop_params=True,
                )

                if not response:
                    raise ValueError(f"[{llm_provider}] returned empty response")
                if not getattr(response, "choices", None):
                    raise ValueError(f"[{llm_provider}] returned empty response")

                return _extract_chat_completion_text(response, llm_provider)

            if llm_provider == "azure":
                # Azure OpenAI SDK 使用 `azure_endpoint` 和 `api_version` 生成专用请求地址，
                # 不能继续复用下面普通 OpenAI-compatible 的 `base_url` 初始化逻辑。
                # 这里在 Azure 分支内完成请求并立即返回，避免客户端被后续 fallback
                # 覆盖，导致用户配置的 Azure 凭证通过校验但实际请求没有被使用。
                logger.info(f"requesting azure chat completion, model: {model_name}")
                _timeout = _get_llm_timeout()
                azure_kwargs = {
                    "api_key": api_key,
                    "api_version": api_version,
                    "azure_endpoint": base_url,
                }
                if _timeout is not None:
                    azure_kwargs["timeout"] = _timeout
                client = AzureOpenAI(**azure_kwargs)
                response = client.chat.completions.create(
                    model=model_name, messages=[{"role": "user", "content": prompt}]
                )
                if response:
                    if isinstance(response, ChatCompletion):
                        return _extract_chat_completion_text(response, llm_provider)
                    else:
                        raise Exception(
                            f'[{llm_provider}] returned an invalid response: "{response}", please check your network '
                            f"connection and try again."
                        )
                else:
                    raise Exception(
                        f"[{llm_provider}] returned an empty response, please check your network connection and try again."
                    )

            if llm_provider == "modelscope":
                content = ''
                client = _create_openai_compatible_client(
                    api_key=api_key,
                    base_url=base_url,
                    timeout=_get_llm_timeout(),
                )
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    extra_body={"enable_thinking": False},
                    stream=True
                )
                if response:
                    for chunk in response:
                        if not chunk.choices:
                            continue
                        delta = chunk.choices[0].delta
                        if delta and delta.content:
                            content += delta.content

                    if not content.strip():
                        raise ValueError("Empty content in stream response")

                    return _normalize_text_response(content, llm_provider)
                else:
                    raise Exception(f"[{llm_provider}] returned an empty response")

            else:
                client = _create_openai_compatible_client(
                    api_key=api_key,
                    base_url=base_url,
                    timeout=_get_llm_timeout(),
                )

            response = client.chat.completions.create(
                model=model_name, messages=[{"role": "user", "content": prompt}]
            )
            if response:
                if isinstance(response, ChatCompletion):
                    return _extract_chat_completion_text(response, llm_provider)
                else:
                    raise Exception(
                        f'[{llm_provider}] returned an invalid response: "{response}", please check your network '
                        f"connection and try again."
                    )
            else:
                raise Exception(
                    f"[{llm_provider}] returned an empty response, please check your network connection and try again."
                )

        return _normalize_text_response(content, llm_provider)
    except Exception as e:
        return f"Error: {_sanitize_error_message(e)}"


def _limit_script_text(text: str | None, max_length: int, field_name: str) -> str:
    value = (text or "").strip()
    if len(value) <= max_length:
        return value

    # API 层已经用 Pydantic 做长度校验；这里继续兜底，是为了保护
    # WebUI 或内部服务直接调用 generate_script 时不会把超长提示词发送给模型，
    # 避免 token 成本异常和请求失败。
    logger.warning(
        f"{field_name} is too long and will be truncated to {max_length} characters."
    )
    return value[:max_length]


def _normalize_script_paragraph_number(paragraph_number: int | None) -> int:
    try:
        value = int(paragraph_number or MIN_SCRIPT_PARAGRAPH_NUMBER)
    except (TypeError, ValueError):
        value = MIN_SCRIPT_PARAGRAPH_NUMBER

    if value < MIN_SCRIPT_PARAGRAPH_NUMBER or value > MAX_SCRIPT_PARAGRAPH_NUMBER:
        # WebUI 和 API 都会限制范围；这里兜底处理内部调用，避免异常参数直接扩大
        # LLM 生成成本或生成空结果。
        logger.warning(
            "script paragraph_number is out of range and will be clamped: "
            f"{value}"
        )
        return max(MIN_SCRIPT_PARAGRAPH_NUMBER, min(value, MAX_SCRIPT_PARAGRAPH_NUMBER))

    return value


# =============================================================================
# LLM intent profiles (Fase 5)
#
# 轻量级意图配置层：为不同生成场景（脚本/关键词/元数据/内容包/改写）提供推荐
# 的采样参数。这里只暴露默认值和合并 helper，作为后续按 provider 细化的扩展点，
# 默认不改变现有生成链路的行为（generate_* 仍走稳定默认）。用户可在 config.toml
# 的 [llm_profiles.<name>] 表里覆盖任意字段，缺键时回落到这里的默认值。
# =============================================================================
LLM_PROFILES = {
    # 叙事旁白：中等温度，关闭 thinking，保证朗读文本干净。
    "script": {"temperature": 0.7, "max_tokens": 2048, "top_p": 1.0, "thinking": False},
    # 视觉检索词：低温度，输出稳定、干净。
    "keywords": {"temperature": 0.2, "max_tokens": 512, "top_p": 1.0, "thinking": False},
    # 标题/描述/标签：中等温度，兼顾吸引力与稳定结构。
    "metadata": {"temperature": 0.6, "max_tokens": 1024, "top_p": 1.0, "thinking": False},
    # 完整内容包（供人工复核）：中等温度。
    "content_package": {"temperature": 0.6, "max_tokens": 3072, "top_p": 1.0, "thinking": False},
    # 改写手动粘贴的脚本：中低温度，保持原意。
    "rewrite": {"temperature": 0.4, "max_tokens": 2048, "top_p": 1.0, "thinking": False},
}
DEFAULT_LLM_PROFILE = "script"


def get_llm_profile(profile: str = DEFAULT_LLM_PROFILE) -> dict:
    """
    返回某个意图 profile 的生成参数（默认值 + config 覆盖）。

    未知 profile 名回落到 script。config 中 `[llm_profiles.<name>]` 表里的字段
    会覆盖默认值，缺失时使用内置默认，符合“配置容错”。返回的是新 dict，
    调用方可安全修改。这是一个供未来按 provider 细化调用参数的扩展点。
    """
    name = profile if profile in LLM_PROFILES else DEFAULT_LLM_PROFILE
    merged = dict(LLM_PROFILES[name])
    overrides = getattr(config, "llm_profiles", {})
    if isinstance(overrides, dict):
        profile_overrides = overrides.get(name, {})
        if isinstance(profile_overrides, dict):
            merged.update(profile_overrides)
    return merged


def build_script_prompt(
    video_subject: str,
    language: str = "",
    paragraph_number: int = 1,
    video_script_prompt: str = "",
    custom_system_prompt: str = "",
) -> str:
    paragraph_number = _normalize_script_paragraph_number(paragraph_number)
    video_script_prompt = _limit_script_text(
        video_script_prompt, MAX_SCRIPT_PROMPT_LENGTH, "video_script_prompt"
    )
    custom_system_prompt = _limit_script_text(
        custom_system_prompt, MAX_SCRIPT_SYSTEM_PROMPT_LENGTH, "custom_system_prompt"
    )

    # 将“脚本生成规则”和“运行时上下文”分开拼接。这样高级用户即使覆盖默认
    # system prompt，也不会漏掉视频主题、语言、段落数这些每次生成都必须带上的参数。
    prompt = custom_system_prompt or DEFAULT_SCRIPT_SYSTEM_PROMPT
    prompt += f"""

# Initialization:
- video subject: {video_subject}
- number of paragraphs: {paragraph_number}
""".rstrip()
    if language:
        prompt += f"\n- language: {language}"
    if video_script_prompt:
        prompt += f"""

# Additional User Requirements:
{video_script_prompt}
""".rstrip()

    return prompt


def generate_script(
    video_subject: str,
    language: str = "",
    paragraph_number: int = 1,
    video_script_prompt: str = "",
    custom_system_prompt: str = "",
) -> str:
    paragraph_number = _normalize_script_paragraph_number(paragraph_number)
    video_script_prompt = _limit_script_text(
        video_script_prompt, MAX_SCRIPT_PROMPT_LENGTH, "video_script_prompt"
    )
    custom_system_prompt = _limit_script_text(
        custom_system_prompt, MAX_SCRIPT_SYSTEM_PROMPT_LENGTH, "custom_system_prompt"
    )
    prompt = build_script_prompt(
        video_subject=video_subject,
        language=language,
        paragraph_number=paragraph_number,
        video_script_prompt=video_script_prompt,
        custom_system_prompt=custom_system_prompt,
    )
    final_script = ""
    logger.info(
        "generating video script: "
        f"subject={video_subject}, paragraph_number={paragraph_number}, "
        f"has_custom_prompt={bool(video_script_prompt.strip())}, "
        f"has_custom_system_prompt={bool(custom_system_prompt.strip())}"
    )

    def format_response(response):
        # Clean the script
        # Remove asterisks, hashes
        response = response.replace("*", "")
        response = response.replace("#", "")

        # Remove markdown syntax
        response = re.sub(r"\[.*\]", "", response)
        response = re.sub(r"\(.*\)", "", response)

        # Split the script into paragraphs
        paragraphs = response.split("\n\n")

        # Select the specified number of paragraphs
        # selected_paragraphs = paragraphs[:paragraph_number]

        # Join the selected paragraphs into a single string
        return "\n\n".join(paragraphs)

    for i in range(_max_retries):
        try:
            response = _generate_response(prompt=prompt)
            if response:
                final_script = format_response(response)
            else:
                logging.error("gpt returned an empty response")

            # g4f may return an error message
            if final_script and "当日额度已消耗完" in final_script:
                raise ValueError(final_script)

            if final_script:
                break
        except Exception as e:
            logger.error(f"failed to generate script: {e}")

        if i < _max_retries:
            logger.warning(f"failed to generate video script, trying again... {i + 1}")
    if "Error: " in final_script:
        logger.error(f"failed to generate video script: {final_script}")
    else:
        logger.success(f"completed: \n{final_script}")
    return final_script.strip()


def _strip_code_fence(text: str) -> str:
    """Strip a surrounding markdown code fence from an LLM response.

    Non-OpenAI providers (Claude, Gemini, …) frequently wrap JSON output in a
    ```json … ``` fence even when asked to return raw JSON. Removing it lets the
    first json.loads() succeed instead of falling through to the regex recovery
    path (and spuriously logging a warning). Mirrors the DOTALL handling already
    used in _parse_social_metadata().
    """
    t = (text or "").strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z0-9]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    return t.strip()


def generate_terms(
    video_subject: str,
    video_script: str,
    amount: int = 5,
    match_script_order: bool = False,
) -> List[str]:
    if match_script_order:
        goal = (
            f"Generate {amount} chronological stock-video search terms that follow "
            "the order of topics in the video script."
        )
        ordering_rule = (
            "6. keep the terms in the same order as the script narration; "
            "earlier terms must describe earlier visual moments."
        )
        # 有序关键词模式下，示例数量要和 amount 保持一致，避免模型被固定
        # 的 4 个示例误导，导致长文案只返回少量关键词，影响素材覆盖度。
        example_terms = [
            "opening visual topic",
            *[
                f"script visual topic {index}"
                for index in range(2, max(amount, 1))
            ],
            "final visual topic",
        ]
        output_example = json.dumps(example_terms[:amount], ensure_ascii=False)
    else:
        goal = (
            f"Generate {amount} search terms for stock videos, depending on the "
            "subject of a video."
        )
        ordering_rule = ""
        output_example = (
            '["search term 1", "search term 2", "search term 3",'
            '"search term 4", "search term 5"]'
        )

    prompt = f"""
# Role: Video Search Terms Generator

## Goals:
{goal}

## Constrains:
1. the search terms are to be returned as a json-array of strings.
2. each search term should consist of 1-3 words, always add the main subject of the video.
3. you must only return the json-array of strings. you must not return anything else. you must not return the script.
4. the search terms must be related to the subject of the video.
5. reply with english search terms only.
{ordering_rule}

## Output Example:
{output_example}

## Context:
### Video Subject
{video_subject}

### Video Script
{video_script}

Please note that you must use English for generating video search terms; Chinese is not accepted.
""".strip()

    logger.info(
        f"subject: {video_subject}, match_script_order: {match_script_order}"
    )

    search_terms = []
    response = ""
    for i in range(_max_retries):
        try:
            response = _generate_response(prompt)
            if "Error: " in response:
                logger.error(f"failed to generate video terms: {response}")
                return response

            # Try TermsResponse (structured JSON from json_mode providers),
            # then fall back to plain JSON array (legacy behaviour).
            try:
                from app.services.quality.llm_providers.base import TermsResponse
                parsed = TermsResponse.model_validate_json(_strip_code_fence(response))
                search_terms = parsed.terms
            except Exception:
                search_terms = json.loads(_strip_code_fence(response))

            if not isinstance(search_terms, list) or not all(
                isinstance(term, str) for term in search_terms
            ):
                logger.error("response is not a list of strings.")
                continue

        except Exception as e:
            logger.warning(f"failed to generate video terms: {str(e)}")
            if response:
                match = re.search(r"\[.*]", response, re.DOTALL)
                if match:
                    try:
                        search_terms = json.loads(match.group())
                    except Exception as e:
                        # 这里保留重试流程，但必须记录 LLM 返回的非标准 JSON，
                        # 否则后续排查搜索词为空时无法定位
                        # 是模型格式问题还是解析逻辑问题。
                        logger.warning(f"failed to generate video terms: {str(e)}")

        if search_terms and len(search_terms) > 0:
            break
        if i < _max_retries:
            logger.warning(f"failed to generate video terms, trying again... {i + 1}")

    logger.success(f"completed: \n{search_terms}")
    return search_terms


# =============================================================================
# Social publishing metadata
#
# 根据视频主题和脚本生成发布到短视频平台时常用的 title、caption 和 hashtags。
# 这块能力只复用现有 LLM provider，不接入任何外部发布服务，也不影响视频生成主链路。
# =============================================================================

# 不同平台的文案长度和 hashtag 数量偏好不同。这里使用保守上限，避免模型返回
# 过长内容后调用方还需要二次裁剪。
SOCIAL_PLATFORMS = {
    "tiktok": {"title_max": 100, "caption_max": 2200, "hashtag_count": 5},
    "youtube_shorts": {"title_max": 100, "caption_max": 5000, "hashtag_count": 3},
    "instagram_reels": {"title_max": 125, "caption_max": 2200, "hashtag_count": 8},
    "facebook_reels": {"title_max": 125, "caption_max": 2200, "hashtag_count": 5},
}
DEFAULT_SOCIAL_PLATFORM = "tiktok"
DEFAULT_SOCIAL_LANGUAGE = "auto"
MAX_SOCIAL_SUBJECT_LENGTH = 500
MAX_SOCIAL_SCRIPT_LENGTH = 8000
MAX_SOCIAL_LANGUAGE_LENGTH = 64

SOCIAL_PLATFORM_LABELS = {
    "tiktok": "TikTok",
    "youtube_shorts": "YouTube Shorts",
    "instagram_reels": "Instagram Reels",
    "facebook_reels": "Facebook Reels",
}

# LLM 不可用时的通用兜底标签。这里故意不绑定某个国家或语种，保证 API
# 对中文、英文、越南语等不同场景都能返回可用结构。
DEFAULT_SOCIAL_HASHTAGS = [
    "#shorts",
    "#viral",
    "#trending",
    "#fyp",
    "#video",
    "#reels",
    "#creator",
    "#content",
]


def _resolve_social_platform(platform: str | None) -> str:
    value = (platform or "").strip().lower()
    return value if value in SOCIAL_PLATFORMS else DEFAULT_SOCIAL_PLATFORM


def _normalize_social_language(language: str | None) -> str:
    value = (language or DEFAULT_SOCIAL_LANGUAGE).strip()
    if len(value) > MAX_SOCIAL_LANGUAGE_LENGTH:
        logger.warning(
            "social metadata language is too long and will be truncated to "
            f"{MAX_SOCIAL_LANGUAGE_LENGTH} characters."
        )
        value = value[:MAX_SOCIAL_LANGUAGE_LENGTH]
    return value or DEFAULT_SOCIAL_LANGUAGE


def _limit_social_text(text: str | None, max_length: int, field_name: str) -> str:
    value = (text or "").strip()
    if len(value) <= max_length:
        return value

    # API 层会限制长度；这里继续兜底，是为了保护内部调用或未来 WebUI
    # 直接调用时不会把超长内容发送给模型，避免 token 成本异常。
    logger.warning(
        f"{field_name} is too long and will be truncated to {max_length} characters."
    )
    return value[:max_length]


def _social_language_instruction(language: str | None) -> str:
    language = _normalize_social_language(language)
    if language.lower() == DEFAULT_SOCIAL_LANGUAGE:
        return (
            "Use the same language as the video subject and script. If the subject "
            "and script use different languages, prefer the script language."
        )

    return f'Write "title" and "caption" in this language: {language}.'


def _clamp_text(text, max_length: int) -> str:
    value = ("" if text is None else str(text)).strip()
    if max_length and len(value) > max_length:
        return value[:max_length].rstrip()
    return value


def _normalize_hashtags(raw, count: int) -> List[str]:
    """
    将 LLM 返回的 hashtag 统一整理成 `#tag` 格式。

    LLM 可能返回字符串、数组、带空格的词组、重复标签或包含标点的内容。
    这里集中清洗，可以让接口响应结构稳定，也避免平台发布时出现空标签、
    重复标签或不符合常见格式的 hashtag。
    """
    if isinstance(raw, str):
        candidates = re.split(r"[\s,]+", raw)
    elif isinstance(raw, (list, tuple)):
        # 数组里的每一项视为一个完整标签，因此 "du lich" 会变成
        # "#dulich"，而不是拆成两个标签。
        candidates = [str(entry) for entry in raw]
    else:
        candidates = []

    seen = set()
    result: List[str] = []
    for item in candidates:
        tag = re.sub(r"[^\w]", "", item, flags=re.UNICODE)
        if not tag:
            continue
        key = tag.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(f"#{tag}")
        if count and len(result) >= count:
            break
    return result


def build_social_metadata_prompt(
    video_subject: str,
    video_script: str = "",
    language: str = DEFAULT_SOCIAL_LANGUAGE,
    platform: str = DEFAULT_SOCIAL_PLATFORM,
) -> str:
    video_subject = _limit_social_text(
        video_subject, MAX_SOCIAL_SUBJECT_LENGTH, "video_subject"
    )
    video_script = _limit_social_text(
        video_script, MAX_SOCIAL_SCRIPT_LENGTH, "video_script"
    )
    platform = _resolve_social_platform(platform)
    spec = SOCIAL_PLATFORMS[platform]
    label = SOCIAL_PLATFORM_LABELS.get(platform, platform)
    language_instruction = _social_language_instruction(language)

    prompt = f"""
# Role: Short-Video Social Media Copywriter

## Goal
Write engaging publishing metadata for a short video that will be posted on {label}.

## Constraints
1. Respond ONLY with a single valid minified JSON object. No markdown, no code fences, no commentary.
2. The JSON must contain exactly these keys: "title", "caption", "hashtags".
3. "title": a catchy hook, at most {spec['title_max']} characters.
4. "caption": an engaging description that ends with a call to action, at most {spec['caption_max']} characters. Do not put hashtags inside the caption.
5. "hashtags": a JSON array of exactly {spec['hashtag_count']} strings. Each must start with "#", contain no spaces, and be relevant to the topic and to {label}.
6. {language_instruction}

## Output Example
{{"title":"...","caption":"...","hashtags":["#example","#video"]}}

## Context
### Video Subject
{video_subject}

### Video Script
{video_script}
""".strip()
    return prompt


def _parse_social_metadata(response: str, platform: str) -> dict:
    spec = SOCIAL_PLATFORMS[_resolve_social_platform(platform)]

    data = None
    try:
        data = json.loads(_strip_code_fence(response))
    except Exception:
        # 部分模型会在 JSON 外层包一段说明文字或 markdown fence。
        # API 调用方只需要稳定结构，所以这里尝试提取第一个 JSON object。
        match = re.search(r"\{.*\}", response or "", re.DOTALL)
        if match:
            data = json.loads(match.group())

    if not isinstance(data, dict):
        raise ValueError("social metadata response is not a JSON object")

    title = _clamp_text(data.get("title", ""), spec["title_max"])
    caption = _clamp_text(data.get("caption", ""), spec["caption_max"])
    hashtags = _normalize_hashtags(data.get("hashtags", []), spec["hashtag_count"])

    if not title and not caption:
        raise ValueError("social metadata response is missing both title and caption")

    return {"title": title, "caption": caption, "hashtags": hashtags}


def _fallback_social_metadata(
    video_subject: str, video_script: str, platform: str
) -> dict:
    spec = SOCIAL_PLATFORMS[_resolve_social_platform(platform)]
    subject = (video_subject or "").strip()
    script = (video_script or "").strip()

    title = subject
    if not title and script:
        # 没有主题时，用脚本第一句兜底生成 title，避免接口返回空标题。
        title = re.split(r"(?<=[.!?。！？])\s+", script)[0]

    return {
        "title": _clamp_text(title, spec["title_max"]),
        "caption": _clamp_text(script or subject, spec["caption_max"]),
        "hashtags": _normalize_hashtags(
            DEFAULT_SOCIAL_HASHTAGS, spec["hashtag_count"]
        ),
    }


def generate_social_metadata(
    video_subject: str,
    video_script: str = "",
    language: str = DEFAULT_SOCIAL_LANGUAGE,
    platform: str = DEFAULT_SOCIAL_PLATFORM,
) -> dict:
    """
    生成短视频发布文案元数据。

    返回结构固定为 `{"title": str, "caption": str, "hashtags": List[str]}`。
    如果 LLM 不可用或返回格式异常，会降级为通用启发式结果，保证 API
    调用方始终拿到可展示、可发布前编辑的数据结构。
    """
    platform = _resolve_social_platform(platform)
    language = _normalize_social_language(language)
    video_subject = _limit_social_text(
        video_subject, MAX_SOCIAL_SUBJECT_LENGTH, "video_subject"
    )
    video_script = _limit_social_text(
        video_script, MAX_SOCIAL_SCRIPT_LENGTH, "video_script"
    )
    prompt = build_social_metadata_prompt(
        video_subject=video_subject,
        video_script=video_script,
        language=language,
        platform=platform,
    )
    logger.info(
        f"generating social metadata: platform={platform}, language={language}"
    )

    response = ""
    for i in range(_max_retries):
        try:
            response = _generate_response(prompt)
            if isinstance(response, str) and "Error: " in response:
                logger.error(f"failed to generate social metadata: {response}")
                break
            metadata = _parse_social_metadata(response, platform)
            logger.success(f"completed: \n{metadata}")
            return metadata
        except Exception as e:
            logger.warning(f"failed to parse social metadata: {str(e)}")

        if i < _max_retries - 1:
            logger.warning(
                f"failed to generate social metadata, trying again... {i + 1}"
            )

    logger.warning("falling back to heuristic social metadata")
    return _fallback_social_metadata(video_subject, video_script, platform)


if __name__ == "__main__":
    video_subject = "生命的意义是什么"
    script = generate_script(
        video_subject=video_subject, language="zh-CN", paragraph_number=1
    )
    print("######################")
    print(script)
    search_terms = generate_terms(
        video_subject=video_subject, video_script=script, amount=5
    )
    print("######################")
    print(search_terms)

