"""Tests for subtitle premium improvements:
- resolve_font_path (font validation + fallback)
- karaoke edge cases (pure logic)
- list_available_fonts / list_subtitle_styles UI helpers
- RenderRequest subtitle_style / font_name fields
"""
from __future__ import annotations

import importlib.util
import os
import sys
import types
from unittest.mock import MagicMock

import pytest

from app.services.quality.subtitle_styles import (
    resolve_font_path,
    list_available_fonts,
    list_subtitle_styles,
)


# ---------------------------------------------------------------------------
# Editor loader (Streamlit stub)
# ---------------------------------------------------------------------------

def _load_editor():
    st_stub = types.ModuleType("streamlit")
    st_stub.runtime = MagicMock()
    st_stub.runtime.exists = lambda: False
    for attr in ["selectbox", "text_input", "button", "info", "error", "sidebar",
                 "columns", "tabs", "expander", "container", "form", "slider",
                 "checkbox", "number_input", "text_area", "json", "write",
                 "caption", "subheader", "header", "title", "metric", "video",
                 "markdown", "warning", "success", "rerun", "set_page_config",
                 "form_submit_button", "altair_chart", "image"]:
        setattr(st_stub, attr, MagicMock(return_value=None))
    sys.modules["streamlit"] = st_stub
    spec = importlib.util.spec_from_file_location(
        "project_editor_sub",
        os.path.join(os.path.dirname(__file__), "../../webui/pages/2_Project_Editor.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ===========================================================================
# Increment 1 — resolve_font_path
# ===========================================================================

class TestResolveFontPath:
    def test_existing_font_returned_as_is(self, tmp_path):
        font_file = tmp_path / "MyFont.ttf"
        font_file.touch()
        result = resolve_font_path("MyFont.ttf", str(tmp_path))
        assert result == str(tmp_path / "MyFont.ttf")

    def test_missing_font_falls_back_to_default(self, tmp_path):
        result = resolve_font_path("Missing.ttf", str(tmp_path))
        assert result.endswith("STHeitiMedium.ttc")

    def test_none_name_returns_default(self, tmp_path):
        result = resolve_font_path(None, str(tmp_path))
        assert result.endswith("STHeitiMedium.ttc")

    def test_empty_string_returns_default(self, tmp_path):
        result = resolve_font_path("", str(tmp_path))
        assert result.endswith("STHeitiMedium.ttc")

    def test_fallback_path_uses_fonts_dir(self, tmp_path):
        result = resolve_font_path("NonExistent.ttf", str(tmp_path))
        assert str(tmp_path) in result


# ===========================================================================
# Increment 2 — karaoke edge cases (pure logic, no moviepy)
# ===========================================================================

from app.services.quality.subtitle_styles import build_karaoke_segments


class TestKaraokeEdgeCases:
    def test_zero_duration_phrase_returns_segments(self):
        segs = build_karaoke_segments("hola mundo", 5.0, 5.0, [])
        assert len(segs) == 2
        for s in segs:
            assert s["start"] == 5.0
            assert s["end"] == 5.0

    def test_all_timestamps_outside_window(self):
        word_timestamps = [
            {"start": 0.0, "end": 0.5},
            {"start": 0.6, "end": 1.0},
        ]
        segs = build_karaoke_segments("uno dos tres", 10.0, 13.0, word_timestamps)
        assert len(segs) == 3
        assert segs[0]["start"] == 10.0
        assert segs[-1]["end"] == 13.0

    def test_empty_phrase_yields_empty(self):
        assert build_karaoke_segments("", 0.0, 1.0, []) == []
        assert build_karaoke_segments("  ", 0.0, 1.0, []) == []

    def test_single_word_spans_full_window(self):
        segs = build_karaoke_segments("increíble", 2.0, 4.0, [])
        assert len(segs) == 1
        assert segs[0]["start"] == 2.0
        assert segs[0]["end"] == 4.0

    def test_word_count_mismatch_falls_back_to_even_split(self):
        wts = [{"start": 1.0, "end": 2.0}]
        segs = build_karaoke_segments("uno dos", 1.0, 3.0, wts)
        assert len(segs) == 2
        assert abs(segs[0]["end"] - segs[1]["start"]) < 1e-9


# ===========================================================================
# Increment 3 — font/style helpers (now in subtitle_styles, re-exported to UI)
# ===========================================================================

class TestListAvailableFonts:
    def test_returns_only_font_files(self, tmp_path):
        (tmp_path / "Bold.ttf").touch()
        (tmp_path / "Medium.ttc").touch()
        (tmp_path / "readme.txt").touch()
        (tmp_path / "icon.png").touch()
        fonts = list_available_fonts(str(tmp_path))
        assert set(fonts) == {"Bold.ttf", "Medium.ttc"}

    def test_sorted_output(self, tmp_path):
        for name in ["Z.otf", "A.ttf", "M.ttc"]:
            (tmp_path / name).touch()
        fonts = list_available_fonts(str(tmp_path))
        assert fonts == sorted(fonts)

    def test_missing_dir_returns_empty(self):
        fonts = list_available_fonts("/nonexistent/fonts")
        assert fonts == []

    def test_all_font_extensions(self, tmp_path):
        for ext in [".ttf", ".ttc", ".otf"]:
            (tmp_path / f"font{ext}").touch()
        fonts = list_available_fonts(str(tmp_path))
        assert len(fonts) == 3


class TestListSubtitleStyles:
    def test_returns_all_five_presets(self):
        styles = list_subtitle_styles()
        assert set(styles) >= {"classic", "clean", "premium", "karaoke", "documentary"}

    def test_returns_list_of_strings(self):
        styles = list_subtitle_styles()
        assert all(isinstance(s, str) for s in styles)


# ===========================================================================
# RenderRequest schema fields
# ===========================================================================

class TestRenderRequestSchema:
    def test_subtitle_style_field_accepted(self):
        from app.models.project_schema import RenderRequest
        r = RenderRequest(subtitle_style="karaoke")
        assert r.subtitle_style == "karaoke"

    def test_font_name_field_accepted(self):
        from app.models.project_schema import RenderRequest
        r = RenderRequest(font_name="Charm-Bold.ttf")
        assert r.font_name == "Charm-Bold.ttf"

    def test_fields_default_to_none(self):
        from app.models.project_schema import RenderRequest
        r = RenderRequest()
        assert r.subtitle_style is None
        assert r.font_name is None
