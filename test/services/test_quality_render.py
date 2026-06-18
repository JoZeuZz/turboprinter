"""Unit tests for the optional Personal Quality Stack: settings loading and
render-profile construction.

These tests intentionally avoid importing moviepy/ffmpeg/whisper or
``app.config`` so they can run in minimal environments: the modules under test
are pure (stdlib only) and receive their configuration as plain dictionaries.
"""

import sys
import unittest
from pathlib import Path

# add project root to python path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import render_profiles, settings


class TestLoadQualitySettings(unittest.TestCase):
    def test_missing_section_behaves_as_disabled_upstream(self):
        s = settings.load_quality_settings({})
        self.assertFalse(s.enabled)
        # conservative defaults
        self.assertEqual(s.profile, "balanced")
        self.assertEqual(s.target_platform, "shorts")
        self.assertEqual(s.language, "es")
        self.assertTrue(s.prefer_local_assets)
        self.assertEqual(s.subtitle_style, "premium")
        self.assertFalse(s.word_highlight)
        self.assertFalse(s.use_two_pass)
        # explicit render overrides are absent unless configured
        self.assertIsNone(s.render_crf)
        self.assertIsNone(s.render_preset)
        self.assertIsNone(s.audio_bitrate)

    def test_none_section_is_tolerated(self):
        s = settings.load_quality_settings(None)
        self.assertFalse(s.enabled)
        self.assertEqual(s.profile, "balanced")

    def test_reads_enabled_and_profile_from_config(self):
        s = settings.load_quality_settings({"enabled": True, "profile": "high"})
        self.assertTrue(s.enabled)
        self.assertEqual(s.profile, "high")

    def test_invalid_profile_falls_back_to_balanced(self):
        s = settings.load_quality_settings({"profile": "ultra-mega"})
        self.assertEqual(s.profile, "balanced")

    def test_invalid_target_platform_falls_back_to_shorts(self):
        s = settings.load_quality_settings({"target_platform": "imax"})
        self.assertEqual(s.target_platform, "shorts")

    def test_boolean_coercion_from_string(self):
        s = settings.load_quality_settings(
            {"enabled": "true", "normalize_audio": "false", "use_two_pass": "1"}
        )
        self.assertTrue(s.enabled)
        self.assertFalse(s.normalize_audio)
        self.assertTrue(s.use_two_pass)

    def test_render_crf_is_clamped_to_valid_range(self):
        self.assertEqual(settings.load_quality_settings({"render_crf": 18}).render_crf, 18)
        self.assertEqual(settings.load_quality_settings({"render_crf": -5}).render_crf, 0)
        self.assertEqual(settings.load_quality_settings({"render_crf": 99}).render_crf, 51)
        # non-numeric values are ignored, not fatal
        self.assertIsNone(settings.load_quality_settings({"render_crf": "abc"}).render_crf)

    def test_overrides_take_precedence_over_global_config(self):
        s = settings.load_quality_settings(
            {"enabled": False, "profile": "balanced"},
            overrides={"enabled": True, "profile": "archival"},
        )
        self.assertTrue(s.enabled)
        self.assertEqual(s.profile, "archival")

    def test_none_overrides_do_not_clobber_config(self):
        s = settings.load_quality_settings(
            {"enabled": True, "profile": "high"},
            overrides={"enabled": None, "profile": None},
        )
        self.assertTrue(s.enabled)
        self.assertEqual(s.profile, "high")

    def test_webui_cli_override_keys_flow_through(self):
        # Fase 8 exposes these per-request from WebUI/CLI.
        s = settings.load_quality_settings(
            {"enabled": True},
            overrides={
                "subtitle_style": "karaoke",
                "prefer_local_assets": False,
                "normalize_audio": False,
                "language": "en",
                "content_package": True,
            },
        )
        self.assertEqual(s.subtitle_style, "karaoke")
        self.assertFalse(s.prefer_local_assets)
        self.assertFalse(s.normalize_audio)
        self.assertEqual(s.language, "en")
        self.assertTrue(s.content_package)


class TestRenderProfiles(unittest.TestCase):
    def _settings(self, **overrides):
        cfg = {"enabled": True}
        cfg.update(overrides)
        return settings.load_quality_settings(cfg)

    def test_high_profile_maps_to_expected_params(self):
        profile = render_profiles.get_render_profile(self._settings(profile="high"))
        self.assertEqual(profile.name, "high")
        self.assertEqual(profile.crf, 18)
        self.assertEqual(profile.preset, "slow")
        self.assertEqual(profile.audio_bitrate, "256k")
        self.assertEqual(profile.pix_fmt, "yuv420p")

    def test_fast_profile_is_lighter_than_high(self):
        fast = render_profiles.get_render_profile(self._settings(profile="fast"))
        high = render_profiles.get_render_profile(self._settings(profile="high"))
        self.assertGreater(fast.crf, high.crf)

    def test_unknown_profile_falls_back_to_balanced(self):
        # settings already normalizes, but get_render_profile must also be safe
        profile = render_profiles.get_render_profile(self._settings(profile="balanced"))
        self.assertEqual(profile.name, "balanced")

    def test_config_render_overrides_apply_on_top_of_profile(self):
        profile = render_profiles.get_render_profile(
            self._settings(
                profile="high",
                render_crf=14,
                render_preset="slower",
                audio_bitrate="320k",
            )
        )
        self.assertEqual(profile.crf, 14)
        self.assertEqual(profile.preset, "slower")
        self.assertEqual(profile.audio_bitrate, "320k")

    def test_two_pass_flag_propagates(self):
        profile = render_profiles.get_render_profile(
            self._settings(profile="archival", use_two_pass=True)
        )
        self.assertTrue(profile.use_two_pass)

    def test_ffmpeg_params_for_libx264_include_crf_and_preset(self):
        profile = render_profiles.get_render_profile(self._settings(profile="high"))
        params = render_profiles.build_ffmpeg_video_params(profile, codec="libx264")
        self.assertIn("-crf", params)
        self.assertEqual(params[params.index("-crf") + 1], "18")
        self.assertIn("-preset", params)
        self.assertEqual(params[params.index("-preset") + 1], "slow")
        self.assertIn("-pix_fmt", params)
        self.assertEqual(params[params.index("-pix_fmt") + 1], "yuv420p")

    def test_ffmpeg_params_for_hardware_codec_omit_crf_and_preset(self):
        profile = render_profiles.get_render_profile(self._settings(profile="high"))
        params = render_profiles.build_ffmpeg_video_params(profile, codec="h264_nvenc")
        # crf/preset are libx264-specific and would break hardware encoders
        self.assertNotIn("-crf", params)
        self.assertNotIn("-preset", params)
        # pixel format is still enforced for compatibility
        self.assertIn("-pix_fmt", params)


class TestMoviepyKwargs(unittest.TestCase):
    def _profile(self, **overrides):
        cfg = {"enabled": True}
        cfg.update(overrides)
        return render_profiles.get_render_profile(settings.load_quality_settings(cfg))

    def test_libx264_uses_native_preset_and_avoids_duplicate_preset_flag(self):
        kwargs = render_profiles.build_moviepy_kwargs(self._profile(profile="high"))
        # MoviePy maps ``preset`` to ``-preset`` itself, so it must NOT also
        # appear in ffmpeg_params (that would emit ``-preset`` twice).
        self.assertEqual(kwargs["preset"], "slow")
        self.assertNotIn("-preset", kwargs["ffmpeg_params"])
        self.assertIn("-crf", kwargs["ffmpeg_params"])
        self.assertIn("-pix_fmt", kwargs["ffmpeg_params"])
        self.assertEqual(kwargs["audio_bitrate"], "256k")
        self.assertEqual(kwargs["fps"], 30)

    def test_hardware_codec_has_no_preset_or_crf(self):
        kwargs = render_profiles.build_moviepy_kwargs(
            self._profile(profile="high"), codec="h264_nvenc"
        )
        self.assertNotIn("preset", kwargs)
        self.assertNotIn("-crf", kwargs["ffmpeg_params"])
        self.assertIn("-pix_fmt", kwargs["ffmpeg_params"])

    def test_intermediate_clips_can_skip_audio_bitrate(self):
        kwargs = render_profiles.build_moviepy_kwargs(
            self._profile(profile="balanced"), include_audio=False
        )
        self.assertNotIn("audio_bitrate", kwargs)


if __name__ == "__main__":
    unittest.main()
