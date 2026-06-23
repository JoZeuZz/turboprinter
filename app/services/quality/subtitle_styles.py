"""Premium subtitle style presets, safe-area positioning and render resolution.

Pure/stdlib only (no PIL/moviepy/app.config), so presets, safe-area math and
the params resolver are unit testable in minimal environments. ``video.py``
consumes :func:`resolve_subtitle_render` to obtain effective subtitle settings;
when the quality stack is disabled the resolver mirrors ``VideoParams`` exactly,
guaranteeing upstream behaviour.

Presets: classic, clean, premium, karaoke, documentary.
"""

import os
from dataclasses import dataclass

from loguru import logger

# Fraction of the frame height reserved at the bottom for platform UI overlays
# (captions, action bars). Vertical short-form platforms hide more.
_SAFE_AREA_BOTTOM = {
    "shorts": 0.18,
    "reels": 0.20,
    "tiktok": 0.22,
    "landscape": 0.08,
}
_SAFE_AREA_DEFAULT = 0.15


@dataclass(frozen=True)
class SubtitleStyle:
    name: str
    font_size_scale: float
    stroke_width: float
    stroke_color: str
    fore_color: str
    background: str  # "none" | "solid" | "rounded"
    bg_color: str
    bg_alpha: int  # informational; renderer uses 140 (rounded) / 255 (solid)
    position: str  # "bottom" | "center" | "top"
    max_lines: int
    word_highlight: bool
    shadow: bool


_PRESETS = {
    # Close to upstream defaults: solid black box, thin stroke, bottom.
    "classic": SubtitleStyle(
        name="classic",
        font_size_scale=1.0,
        stroke_width=1.5,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background="solid",
        bg_color="#000000",
        bg_alpha=255,
        position="bottom",
        max_lines=2,
        word_highlight=False,
        shadow=False,
    ),
    # Minimalist: no background, rely on a strong stroke for legibility.
    "clean": SubtitleStyle(
        name="clean",
        font_size_scale=1.0,
        stroke_width=3.0,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background="none",
        bg_color="#000000",
        bg_alpha=0,
        position="bottom",
        max_lines=2,
        word_highlight=False,
        shadow=True,
    ),
    # Premium short-form look: larger text, rounded translucent backing.
    "premium": SubtitleStyle(
        name="premium",
        font_size_scale=1.1,
        stroke_width=2.0,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background="rounded",
        bg_color="#000000",
        bg_alpha=140,
        position="bottom",
        max_lines=2,
        word_highlight=False,
        shadow=True,
    ),
    # Like premium but flags word-level highlighting (render is a follow-up;
    # falls back cleanly to phrase subtitles when word timestamps are absent).
    "karaoke": SubtitleStyle(
        name="karaoke",
        font_size_scale=1.1,
        stroke_width=2.0,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background="rounded",
        bg_color="#000000",
        bg_alpha=140,
        position="bottom",
        max_lines=2,
        word_highlight=True,
        shadow=True,
    ),
    # Lower-third documentary style: smaller, subtle solid backing, bottom.
    "documentary": SubtitleStyle(
        name="documentary",
        font_size_scale=0.9,
        stroke_width=1.0,
        stroke_color="#000000",
        fore_color="#FFFFFF",
        background="solid",
        bg_color="#000000",
        bg_alpha=180,
        position="bottom",
        max_lines=2,
        word_highlight=False,
        shadow=False,
    ),
}

_DEFAULT_STYLE_NAME = "premium"


_DEFAULT_FONT = "STHeitiMedium.ttc"
_FONT_EXT = {".ttf", ".ttc", ".otf"}


def resolve_font_path(name: str | None, fonts_dir: str) -> str:
    """Return a validated font path, falling back to the default font.

    Logs a warning when the requested font is not found on disk so the caller
    always receives a usable path without raising at resolution time.
    """
    if os.name == "nt" and fonts_dir:
        fonts_dir = fonts_dir.replace("\\", "/")
    default_path = os.path.join(fonts_dir, _DEFAULT_FONT)
    if not name:
        return default_path
    candidate = os.path.join(fonts_dir, name)
    if os.name == "nt":
        candidate = candidate.replace("\\", "/")
    if os.path.isfile(candidate):
        return candidate
    logger.warning(f"font '{name}' not found in {fonts_dir}, falling back to {_DEFAULT_FONT}")
    return default_path


def list_available_fonts(fonts_dir: str) -> list[str]:
    """Return sorted basenames of font files in fonts_dir."""
    if not os.path.isdir(fonts_dir):
        return []
    return sorted(
        entry for entry in os.listdir(fonts_dir)
        if os.path.splitext(entry)[1].lower() in _FONT_EXT
    )


def list_subtitle_styles() -> list[str]:
    """Return the list of available subtitle preset names."""
    return list(_PRESETS.keys())


def get_subtitle_style(name) -> SubtitleStyle:
    """Return the named preset, falling back to ``premium`` for unknown names."""
    if isinstance(name, str):
        key = name.strip().lower()
        if key in _PRESETS:
            return _PRESETS[key]
    return _PRESETS[_DEFAULT_STYLE_NAME]


def safe_area_bottom_fraction(target_platform) -> float:
    """Fraction of frame height to keep clear at the bottom for the platform."""
    if isinstance(target_platform, str):
        return _SAFE_AREA_BOTTOM.get(target_platform.strip().lower(), _SAFE_AREA_DEFAULT)
    return _SAFE_AREA_DEFAULT


def safe_area_custom_position(target_platform) -> float:
    """Custom-position percentage (from top) that sits a bottom subtitle just
    above the reserved safe-area band."""
    return round((1.0 - safe_area_bottom_fraction(target_platform)) * 100.0, 1)


@dataclass(frozen=True)
class SubtitleRenderSettings:
    font_size: int
    stroke_width: float
    stroke_color: str
    fore_color: str
    # Same semantics as VideoParams.text_background_color: bool | color string.
    background_color: object
    rounded_background: bool
    position: str
    custom_position: float
    normalize: bool
    word_highlight: bool


def _mirror_params(params) -> SubtitleRenderSettings:
    """Effective settings identical to upstream (quality disabled)."""
    return SubtitleRenderSettings(
        font_size=int(getattr(params, "font_size", 60)),
        stroke_width=float(getattr(params, "stroke_width", 1.5)),
        stroke_color=getattr(params, "stroke_color", "#000000"),
        fore_color=getattr(params, "text_fore_color", "#FFFFFF"),
        background_color=getattr(params, "text_background_color", True),
        rounded_background=bool(getattr(params, "rounded_subtitle_background", False)),
        position=getattr(params, "subtitle_position", "bottom"),
        custom_position=float(getattr(params, "custom_position", 70.0)),
        normalize=False,
        word_highlight=False,
    )


def _background_color_for(style: SubtitleStyle):
    if style.background == "none":
        return False
    return style.bg_color


def resolve_subtitle_render(
    params, quality_settings, video_width: int, video_height: int
) -> SubtitleRenderSettings:
    """Resolve effective subtitle render settings.

    When the quality stack is disabled, mirrors ``params`` exactly so the
    renderer behaves like upstream. When enabled, applies the configured
    ``subtitle_style`` preset and, if ``safe_area_enabled`` and the target is a
    vertical platform, lifts a bottom subtitle inside the safe area.
    """
    if not getattr(quality_settings, "enabled", False):
        return _mirror_params(params)

    style = get_subtitle_style(getattr(quality_settings, "subtitle_style", "premium"))
    base_font = int(getattr(params, "font_size", 60))

    position = style.position
    custom_position = float(getattr(params, "custom_position", 70.0))
    platform = getattr(quality_settings, "target_platform", "shorts")
    safe_area_on = bool(getattr(quality_settings, "safe_area_enabled", True))
    is_vertical = platform in ("shorts", "reels", "tiktok")
    if safe_area_on and is_vertical and style.position == "bottom":
        position = "custom"
        custom_position = safe_area_custom_position(platform)

    return SubtitleRenderSettings(
        font_size=max(1, int(round(base_font * style.font_size_scale))),
        stroke_width=style.stroke_width,
        stroke_color=style.stroke_color,
        fore_color=style.fore_color,
        background_color=_background_color_for(style),
        rounded_background=(style.background == "rounded"),
        position=position,
        custom_position=custom_position,
        normalize=True,
        word_highlight=style.word_highlight,
    )


def _wt_span(word_timestamp):
    """Normalize a WordTimestamp dataclass / tuple / dict to (start, end)."""
    if isinstance(word_timestamp, dict):
        return float(word_timestamp.get("start", 0)), float(word_timestamp.get("end", 0))
    if isinstance(word_timestamp, (tuple, list)) and len(word_timestamp) >= 3:
        return float(word_timestamp[1]), float(word_timestamp[2])
    return float(getattr(word_timestamp, "start", 0)), float(getattr(word_timestamp, "end", 0))


def build_karaoke_segments(phrase, phrase_start, phrase_end, word_timestamps):
    """Map a subtitle phrase + its time window to per-word highlight segments.

    Returns a list of ``{word, index, start, end}`` covering
    ``[phrase_start, phrase_end]`` contiguously. When the per-word timestamps
    overlapping the window match the phrase's word count, they are used 1:1;
    otherwise the window is split evenly across the phrase words. Pure and
    deterministic so the karaoke timing is unit testable without rendering.
    """
    words = phrase.split()
    if not words:
        return []

    phrase_start = float(phrase_start)
    phrase_end = float(phrase_end)
    duration = max(0.0, phrase_end - phrase_start)
    n = len(words)

    within = []
    for wt in word_timestamps or []:
        start, end = _wt_span(wt)
        if end > phrase_start and start < phrase_end:
            within.append((max(start, phrase_start), min(end, phrase_end)))

    if len(within) == n:
        bounds = within
    else:
        step = duration / n if n else duration
        bounds = [
            (phrase_start + i * step, phrase_start + (i + 1) * step) for i in range(n)
        ]

    segments = []
    for index, word in enumerate(words):
        start, end = bounds[index]
        segments.append(
            {"word": word, "index": index, "start": float(start), "end": float(end)}
        )
    # Guarantee the segments span the whole phrase window.
    segments[0]["start"] = phrase_start
    segments[-1]["end"] = phrase_end
    return segments


def build_word_highlight_segments(words):
    """Build progressive word-highlight segments from per-word timestamps.

    ``words`` is a list of ``(word, start, end)`` tuples. Returns one segment per
    word carrying the full phrase plus the index to highlight and its time
    window, ready for a karaoke-style renderer. Pure helper; the actual render
    integration is a follow-up — until then ``karaoke`` falls back to normal
    phrase subtitles.
    """
    all_words = [w[0] for w in words]
    segments = []
    for index, (_, start, end) in enumerate(words):
        segments.append(
            {
                "highlight_index": index,
                "start": float(start),
                "end": float(end),
                "words": all_words,
            }
        )
    return segments
