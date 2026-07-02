from typing import Any

from fastapi import Request

from app.controllers.v1.base import new_router
from app.config import config
from app.utils import utils

router = new_router()

_VIDEO_SOURCES = ["pexels", "pixabay", "coverr", "local"]

_EDITABLE_FIELDS: dict[str, dict[str, type | tuple[type, ...]]] = {
    "app": {
        "video_source": str,
        "tls_verify": bool,
        "pexels_api_keys": list,
        "pixabay_api_keys": list,
        "coverr_api_keys": list,
        "llm_provider": str,
        "llm_fallback_providers": list,
        "llm_request_timeout_seconds": int,
        "llm_connect_timeout_seconds": int,
        "gemini_api_key": str,
        "gemini_model_name": str,
        "subtitle_provider": str,
        "endpoint": str,
        "material_directory": str,
        "enable_redis": bool,
        "redis_host": str,
        "redis_port": int,
        "redis_db": int,
        "redis_password": str,
        "max_concurrent_tasks": int,
        "max_queued_tasks": int,
        "max_upload_size_mb": int,
        "video_codec": str,
        "match_materials_to_script": bool,
        "upload_post_enabled": bool,
        "upload_post_api_key": str,
        "upload_post_username": str,
        "upload_post_platforms": list,
        "upload_post_auto_upload": bool,
        "n_threads": int,
        "custom_system_prompt": str,
    },
    "whisper": {
        "model_size": str,
        "device": str,
        "compute_type": str,
    },
    "azure": {
        "speech_key": str,
        "speech_region": str,
    },
    "siliconflow": {
        "api_key": str,
    },
    "ui": {
        "hide_log": bool,
        "language": str,
        "subtitle_position": str,
        "custom_position": (int, float),
        "layout_mode": str,
        "bgm_type": str,
        "tts_server": str,
        "voice_name": str,
        "font_name": str,
        "text_fore_color": str,
        "font_size": int,
        "subtitle_background_enabled": bool,
        "subtitle_background_color": str,
        "rounded_subtitle_background": bool,
        "stroke_width": (int, float),
        "stroke_color": str,
        "text_background_color": str,
    },
    "quality": {
        "enabled": bool,
        "profile": str,
        "target_platform": str,
        "language": str,
        "prefer_local_assets": bool,
        "prefer_licensed_assets": bool,
        "avoid_reencode_intermediates": bool,
        "normalize_audio": bool,
        "subtitle_style": str,
        "word_highlight": bool,
        "safe_area_enabled": bool,
        "content_package": bool,
        "use_two_pass": bool,
    },
}

_SECTION_ATTRS = {
    "app": config.app,
    "whisper": config.whisper,
    "azure": config.azure,
    "siliconflow": config.siliconflow,
    "ui": config.ui,
    "quality": config.quality,
}

_SECRET_FIELDS = {
    ("app", "pexels_api_keys"),
    ("app", "pixabay_api_keys"),
    ("app", "coverr_api_keys"),
    ("app", "gemini_api_key"),
    ("app", "redis_password"),
    ("app", "upload_post_api_key"),
    ("azure", "speech_key"),
    ("siliconflow", "api_key"),
}


def _section_data(section: str) -> dict[str, Any]:
    source = _SECTION_ATTRS[section]
    data = {}
    for key, expected in _EDITABLE_FIELDS[section].items():
        if (section, key) in _SECRET_FIELDS:
            data[key] = [] if expected is list else ""
            continue
        data[key] = source.get(key)
    return data


def _coerce_value(section: str, key: str, value: Any):
    expected = _EDITABLE_FIELDS[section][key]
    if expected is list:
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise ValueError(f"{section}.{key} must be a list of strings")
        return [item.strip() for item in value if item.strip()]

    if expected is bool:
        if not isinstance(value, bool):
            raise ValueError(f"{section}.{key} must be a boolean")
        return value

    if expected is int:
        if isinstance(value, bool):
            raise ValueError(f"{section}.{key} must be an integer")
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{section}.{key} must be an integer") from exc

    if expected == (int, float):
        if isinstance(value, bool):
            raise ValueError(f"{section}.{key} must be a number")
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{section}.{key} must be a number") from exc

    if expected is str:
        if value is None:
            return ""
        if not isinstance(value, str):
            raise ValueError(f"{section}.{key} must be a string")
        return value.strip()

    return value


def _ui_config_response():
    return {
        "video_sources": _VIDEO_SOURCES,
        "subtitle_position_default": config.ui.get("subtitle_position", "bottom"),
        "custom_position_default": float(config.ui.get("custom_position", 70.0)),
        "settings": {section: _section_data(section) for section in _EDITABLE_FIELDS},
        "options": {
            "video_sources": _VIDEO_SOURCES,
            "video_codecs": ["libx264", "h264_nvenc", "h264_qsv", "h264_videotoolbox", "hevc_nvenc"],
            "llm_providers": ["gemini", "pollinations", "openai", "azure", "ollama", "moonshot", "oneapi"],
            "quality_profiles": ["fast", "balanced", "high"],
            "subtitle_positions": ["top", "center", "bottom", "custom"],
            "whisper_devices": ["CPU", "CUDA", "auto"],
        },
    }


@router.get("/config", summary="Get safe UI configuration")
def get_ui_config(request: Request):
    return utils.get_response(200, _ui_config_response())


@router.put("/config", summary="Update UI-editable configuration")
def update_ui_config(payload: dict[str, Any]):
    try:
        for section, values in payload.items():
            if section not in _EDITABLE_FIELDS:
                raise ValueError(f"unknown config section: {section}")
            if not isinstance(values, dict):
                raise ValueError(f"{section} must be an object")

            target = _SECTION_ATTRS[section]
            for key, value in values.items():
                if key not in _EDITABLE_FIELDS[section]:
                    raise ValueError(f"unknown config field: {section}.{key}")
                target[key] = _coerce_value(section, key, value)

        config.save_config()
    except ValueError as exc:
        return utils.get_response(400, None, str(exc))

    return utils.get_response(200, _ui_config_response())
