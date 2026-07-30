import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.quality import manifest as mf
from app.services.quality import render_profiles
from app.services.quality.settings import load_quality_settings


class BuildRenderManifestTest(unittest.TestCase):
    def _settings(self, **over):
        cfg = {"enabled": True, "profile": "high", "target_platform": "shorts"}
        cfg.update(over)
        return load_quality_settings(cfg)

    def test_includes_version_task_and_timestamp(self):
        m = mf.build_render_manifest(
            task_id="t1", created_at="2026-06-17T00:00:00+00:00"
        )
        self.assertEqual(m["manifest_version"], mf.MANIFEST_VERSION)
        self.assertEqual(m["task_id"], "t1")
        self.assertEqual(m["created_at"], "2026-06-17T00:00:00+00:00")

    def test_serializes_quality_settings_and_render_profile(self):
        qs = self._settings()
        profile = render_profiles.get_render_profile(qs)
        m = mf.build_render_manifest(
            task_id="t1",
            quality_settings=qs,
            render_profile=profile,
            codec="libx264",
            created_at="x",
        )
        self.assertTrue(m["quality"]["enabled"])
        self.assertEqual(m["quality"]["profile"], "high")
        self.assertEqual(m["codec"], "libx264")
        self.assertEqual(m["render_profile"]["crf"], 18)
        self.assertEqual(m["render_profile"]["preset"], "slow")

    def test_none_inputs_yield_null_sections(self):
        m = mf.build_render_manifest(task_id="t1", created_at="x")
        self.assertIsNone(m["quality"])
        self.assertIsNone(m["render_profile"])
        self.assertIsNone(m["codec"])
        self.assertEqual(m["artifacts"], {})

    def test_artifacts_drop_empty_values(self):
        m = mf.build_render_manifest(
            task_id="t1",
            created_at="x",
            artifacts={"videos": ["a.mp4"], "subtitle_path": "", "audio_file": None},
        )
        self.assertEqual(m["artifacts"], {"videos": ["a.mp4"]})

    def test_default_created_at_is_iso_string(self):
        m = mf.build_render_manifest(task_id="t1")
        # Should be a non-empty ISO-8601 string ending with a timezone offset.
        self.assertIsInstance(m["created_at"], str)
        self.assertIn("T", m["created_at"])

    def test_result_is_json_serializable(self):
        import json

        qs = self._settings()
        profile = render_profiles.get_render_profile(qs)
        m = mf.build_render_manifest(
            task_id="t1", quality_settings=qs, render_profile=profile, created_at="x"
        )
        json.loads(json.dumps(m))  # must not raise


if __name__ == "__main__":
    unittest.main()
