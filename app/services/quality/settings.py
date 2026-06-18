"""Tolerant reader for the optional ``[quality]`` configuration section.

The Personal Quality Stack is configured globally via ``config.toml``'s
``[quality]`` table and may be overridden per request (from the API/WebUI/CLI)
through a small set of fields on ``VideoParams``.

This module is intentionally **pure**: it takes plain dictionaries and returns a
frozen :class:`QualitySettings`. It does not import ``app.config``, moviepy or
any third-party package, so it can be unit tested in minimal environments. A
thin runtime helper that reads ``config.quality`` lives in
:func:`current_quality_settings` and imports the config lazily.

Tolerance guarantees (so upstream behaviour is preserved):
- A missing/empty/``None`` section yields ``enabled = False`` with safe defaults.
- Unknown enum values fall back to a conservative default instead of raising.
- ``None`` overrides never clobber configured values.
"""

from dataclasses import dataclass
from typing import Optional

VALID_PROFILES = ("fast", "balanced", "high", "archival")
VALID_PLATFORMS = ("shorts", "reels", "tiktok", "landscape")
VALID_SUBTITLE_STYLES = ("classic", "clean", "premium", "karaoke", "documentary")

_CRF_MIN = 0
_CRF_MAX = 51

# Keys that VideoParams may expose as per-request overrides. Only these are
# honoured from the ``overrides`` mapping so a request cannot, for example,
# silently change global asset-licensing preferences.
OVERRIDE_KEYS = (
    "enabled",
    "profile",
    "target_platform",
    "word_highlight",
    "content_package",
)


@dataclass(frozen=True)
class QualitySettings:
    enabled: bool
    profile: str
    target_platform: str
    language: str
    prefer_local_assets: bool
    prefer_licensed_assets: bool
    avoid_reencode_intermediates: bool
    normalize_audio: bool
    subtitle_style: str
    word_highlight: bool
    safe_area_enabled: bool
    use_two_pass: bool
    # Generate the Spanish Content Package sidecar (title/description/hashtags/
    # hook/scene keywords/thumbnail prompt/review checklist). Deterministic, no
    # LLM required.
    content_package: bool
    # Explicit render overrides. ``None`` means "use the selected profile's
    # value"; a concrete value overrides the profile.
    render_crf: Optional[int]
    render_preset: Optional[str]
    audio_bitrate: Optional[str]


_TRUE_STRINGS = ("1", "true", "yes", "on")
_FALSE_STRINGS = ("0", "false", "no", "off", "")


def _coerce_bool(value, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in _TRUE_STRINGS:
            return True
        if normalized in _FALSE_STRINGS:
            return False
    return default


def _coerce_choice(value, allowed, default: str) -> str:
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in allowed:
            return normalized
    return default


def _coerce_optional_crf(value) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    try:
        crf = int(value)
    except (TypeError, ValueError):
        return None
    return max(_CRF_MIN, min(_CRF_MAX, crf))


def _coerce_optional_str(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _merged_section(global_cfg, overrides) -> dict:
    """Merge the global ``[quality]`` table with per-request overrides.

    Only :data:`OVERRIDE_KEYS` are honoured from ``overrides``, and ``None``
    override values are ignored so they cannot wipe configured defaults.
    """
    section: dict = dict(global_cfg or {})
    if overrides:
        for key in OVERRIDE_KEYS:
            if key in overrides and overrides[key] is not None:
                section[key] = overrides[key]
    return section


def load_quality_settings(global_cfg, overrides=None) -> QualitySettings:
    section = _merged_section(global_cfg, overrides)

    return QualitySettings(
        enabled=_coerce_bool(section.get("enabled"), False),
        profile=_coerce_choice(section.get("profile"), VALID_PROFILES, "balanced"),
        target_platform=_coerce_choice(
            section.get("target_platform"), VALID_PLATFORMS, "shorts"
        ),
        language=_coerce_optional_str(section.get("language")) or "es",
        prefer_local_assets=_coerce_bool(section.get("prefer_local_assets"), True),
        prefer_licensed_assets=_coerce_bool(section.get("prefer_licensed_assets"), True),
        avoid_reencode_intermediates=_coerce_bool(
            section.get("avoid_reencode_intermediates"), True
        ),
        normalize_audio=_coerce_bool(section.get("normalize_audio"), True),
        subtitle_style=_coerce_choice(
            section.get("subtitle_style"), VALID_SUBTITLE_STYLES, "premium"
        ),
        word_highlight=_coerce_bool(section.get("word_highlight"), False),
        safe_area_enabled=_coerce_bool(section.get("safe_area_enabled"), True),
        use_two_pass=_coerce_bool(section.get("use_two_pass"), False),
        content_package=_coerce_bool(section.get("content_package"), False),
        render_crf=_coerce_optional_crf(section.get("render_crf")),
        render_preset=_coerce_optional_str(section.get("render_preset")),
        audio_bitrate=_coerce_optional_str(section.get("audio_bitrate")),
    )


def overrides_from_params(params) -> dict:
    """Extract per-request quality overrides from a ``VideoParams``-like object.

    Returns a mapping limited to :data:`OVERRIDE_KEYS`. Missing attributes are
    simply skipped, so this stays compatible with the lighter request models
    (Audio/Subtitle) that do not carry quality fields.
    """
    overrides: dict = {}
    for key in OVERRIDE_KEYS:
        value = getattr(params, f"quality_{key}", None)
        if value is not None:
            overrides[key] = value
    return overrides


def current_quality_settings(params=None) -> QualitySettings:
    """Runtime convenience: read ``config.quality`` and apply request overrides.

    Imports ``app.config`` lazily so the pure helpers above remain importable in
    environments without the third-party config dependencies.
    """
    from app.config import config

    global_cfg = getattr(config, "quality", {})
    overrides = overrides_from_params(params) if params is not None else None
    return load_quality_settings(global_cfg, overrides)
