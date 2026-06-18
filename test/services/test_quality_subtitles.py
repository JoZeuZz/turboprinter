"""Unit tests for the optional premium subtitle layer (Spanish-focused).

Pure/stdlib only: no moviepy/PIL/app.config imports, so these run in minimal
environments. Covers Spanish text normalization, deterministic line wrapping,
style presets, safe-area positioning and the word-highlight segment helper.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import subtitle_styles, subtitle_text


class TestSpanishNormalization(unittest.TestCase):
    def test_removes_space_after_opening_marks(self):
        self.assertEqual(
            subtitle_text.normalize_spanish_subtitle("¿ Cómo estás ?"),
            "¿Cómo estás?",
        )
        self.assertEqual(
            subtitle_text.normalize_spanish_subtitle("¡ Vamos !"),
            "¡Vamos!",
        )

    def test_removes_space_before_closing_punctuation(self):
        self.assertEqual(
            subtitle_text.normalize_spanish_subtitle("Hola , mundo ."),
            "Hola, mundo.",
        )
        self.assertEqual(
            subtitle_text.normalize_spanish_subtitle("Bien ; gracias : ya"),
            "Bien; gracias: ya",
        )

    def test_collapses_whitespace_and_newlines(self):
        self.assertEqual(
            subtitle_text.normalize_spanish_subtitle("Hola\n  mundo\t cruel"),
            "Hola mundo cruel",
        )

    def test_preserves_accents_enie_and_diacritics(self):
        text = "El año pasado María cantó en Ñuñoa"
        self.assertEqual(subtitle_text.normalize_spanish_subtitle(text), text)

    def test_idempotent_on_clean_text(self):
        text = "¿Listos para empezar?"
        self.assertEqual(subtitle_text.normalize_spanish_subtitle(text), text)

    def test_handles_empty_and_whitespace(self):
        self.assertEqual(subtitle_text.normalize_spanish_subtitle(""), "")
        self.assertEqual(subtitle_text.normalize_spanish_subtitle("   "), "")


class TestSubtitleWrapping(unittest.TestCase):
    def test_short_text_stays_on_one_line(self):
        lines = subtitle_text.wrap_subtitle_text("Hola mundo", max_chars=20, max_lines=2)
        self.assertEqual(lines, ["Hola mundo"])

    def test_wraps_into_multiple_lines_without_splitting_words(self):
        text = "el rápido zorro marrón salta"
        lines = subtitle_text.wrap_subtitle_text(text, max_chars=14, max_lines=3)
        self.assertGreater(len(lines), 1)
        for line in lines:
            self.assertLessEqual(len(line), 14)
        # no word was broken: rejoining yields the original words in order
        self.assertEqual(" ".join(lines).split(), text.split())

    def test_respects_max_lines_by_merging_overflow_into_last_line(self):
        text = "una dos tres cuatro cinco seis siete ocho"
        lines = subtitle_text.wrap_subtitle_text(text, max_chars=10, max_lines=2)
        self.assertEqual(len(lines), 2)
        # no text is lost even when it cannot fit the budget
        self.assertEqual(" ".join(lines).split(), text.split())

    def test_opening_question_mark_stays_attached_to_word(self):
        text = "dime una cosa importante ¿vienes hoy?"
        lines = subtitle_text.wrap_subtitle_text(text, max_chars=18, max_lines=3)
        # no line ends with a dangling opening mark
        for line in lines:
            self.assertFalse(line.endswith("¿"))
            self.assertFalse(line.endswith("¡"))

    def test_line_does_not_start_with_closing_punctuation(self):
        # crafted pre-normalized tokens where naive wrapping could orphan "?"
        lines = subtitle_text.wrap_subtitle_text(
            "palabralarga ? siguiente", max_chars=12, max_lines=3
        )
        for line in lines:
            self.assertFalse(line.lstrip().startswith("?"))
            self.assertFalse(line.lstrip().startswith("."))

    def test_single_word_longer_than_budget_is_kept_whole(self):
        lines = subtitle_text.wrap_subtitle_text(
            "supercalifragilistico", max_chars=8, max_lines=2
        )
        self.assertEqual(lines, ["supercalifragilistico"])


class TestSubtitleStyles(unittest.TestCase):
    def test_all_documented_presets_exist(self):
        for name in ("classic", "clean", "premium", "karaoke", "documentary"):
            style = subtitle_styles.get_subtitle_style(name)
            self.assertEqual(style.name, name)

    def test_unknown_preset_falls_back_to_premium(self):
        style = subtitle_styles.get_subtitle_style("does-not-exist")
        self.assertEqual(style.name, "premium")

    def test_classic_preset_is_close_to_upstream_defaults(self):
        style = subtitle_styles.get_subtitle_style("classic")
        self.assertEqual(style.font_size_scale, 1.0)
        self.assertEqual(style.position, "bottom")
        self.assertFalse(style.word_highlight)

    def test_karaoke_preset_enables_word_highlight(self):
        self.assertTrue(subtitle_styles.get_subtitle_style("karaoke").word_highlight)

    def test_clean_preset_has_no_background(self):
        self.assertEqual(subtitle_styles.get_subtitle_style("clean").background, "none")

    def test_premium_preset_uses_rounded_translucent_background(self):
        style = subtitle_styles.get_subtitle_style("premium")
        self.assertEqual(style.background, "rounded")
        self.assertLess(style.bg_alpha, 255)


class TestSafeArea(unittest.TestCase):
    def test_vertical_platforms_reserve_more_bottom_than_landscape(self):
        shorts = subtitle_styles.safe_area_bottom_fraction("shorts")
        landscape = subtitle_styles.safe_area_bottom_fraction("landscape")
        self.assertGreater(shorts, landscape)

    def test_unknown_platform_uses_a_safe_default(self):
        frac = subtitle_styles.safe_area_bottom_fraction("unknown")
        self.assertGreater(frac, 0.0)
        self.assertLess(frac, 0.5)

    def test_bottom_position_is_lifted_inside_safe_area(self):
        # returns a custom-position percentage from the top, kept above the
        # reserved bottom band
        pct = subtitle_styles.safe_area_custom_position("tiktok")
        self.assertGreater(pct, 50.0)
        self.assertLess(pct, 100.0)


class TestResolveSubtitleRender(unittest.TestCase):
    class _Params:
        font_size = 60
        stroke_width = 1.5
        stroke_color = "#000000"
        text_fore_color = "#FFFFFF"
        text_background_color = True
        rounded_subtitle_background = False
        subtitle_position = "bottom"
        custom_position = 70.0

    def _qs(self, enabled, **over):
        from app.services.quality import settings

        cfg = {"enabled": enabled}
        cfg.update(over)
        return settings.load_quality_settings(cfg)

    def test_disabled_quality_mirrors_params_exactly(self):
        params = self._Params()
        eff = subtitle_styles.resolve_subtitle_render(
            params, self._qs(False), video_width=1080, video_height=1920
        )
        self.assertEqual(eff.font_size, 60)
        self.assertEqual(eff.stroke_width, 1.5)
        self.assertEqual(eff.fore_color, "#FFFFFF")
        self.assertEqual(eff.position, "bottom")
        self.assertEqual(eff.custom_position, 70.0)
        self.assertFalse(eff.normalize)
        self.assertFalse(eff.word_highlight)

    def test_enabled_premium_applies_style_and_safe_area(self):
        params = self._Params()
        eff = subtitle_styles.resolve_subtitle_render(
            params,
            self._qs(True, subtitle_style="premium", target_platform="shorts"),
            video_width=1080,
            video_height=1920,
        )
        self.assertTrue(eff.normalize)
        self.assertTrue(eff.rounded_background)
        # safe area lifts a bottom subtitle to a custom position
        self.assertEqual(eff.position, "custom")
        self.assertGreater(eff.custom_position, 50.0)
        self.assertLess(eff.custom_position, 100.0)

    def test_enabled_classic_keeps_bottom_and_base_font(self):
        params = self._Params()
        eff = subtitle_styles.resolve_subtitle_render(
            params,
            self._qs(True, subtitle_style="classic", safe_area_enabled=False),
            video_width=1080,
            video_height=1920,
        )
        self.assertEqual(eff.position, "bottom")
        self.assertEqual(eff.font_size, 60)


class TestWordHighlightSegments(unittest.TestCase):
    def test_builds_progressive_segments_from_word_timestamps(self):
        words = [("Hola", 0.0, 0.4), ("mundo", 0.4, 0.9), ("cruel", 0.9, 1.3)]
        segments = subtitle_styles.build_word_highlight_segments(words)
        self.assertEqual(len(segments), 3)
        self.assertEqual(segments[0]["highlight_index"], 0)
        self.assertEqual(segments[0]["start"], 0.0)
        self.assertEqual(segments[0]["end"], 0.4)
        self.assertEqual(segments[-1]["highlight_index"], 2)
        # full phrase text is carried on every segment for rendering
        self.assertEqual(segments[0]["words"], ["Hola", "mundo", "cruel"])

    def test_empty_input_returns_empty(self):
        self.assertEqual(subtitle_styles.build_word_highlight_segments([]), [])


if __name__ == "__main__":
    unittest.main()
