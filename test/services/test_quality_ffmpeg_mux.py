import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import subprocess
import unittest
from unittest.mock import MagicMock, call, patch


class TestFinalizeNoBgm(unittest.TestCase):
    """finalize() without BGM: simple -map 0:v -map 1:a, no filtergraph."""

    def _run(self, extra_kwargs=None):
        from app.services.quality.ffmpeg_mux import finalize
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink"):
            mock_run.return_value = MagicMock(returncode=0)
            finalize(
                "visual.mp4", "voice.wav", None, "output.mp4",
                **(extra_kwargs or {})
            )
            return mock_run

    def test_no_bgm_uses_simple_map(self):
        mock_run = self._run()
        cmd = mock_run.call_args[0][0]
        assert "-map" in cmd
        assert "0:v" in cmd
        assert "1:a" in cmd

    def test_no_bgm_has_no_filtergraph(self):
        mock_run = self._run()
        cmd = mock_run.call_args[0][0]
        assert "-filter_complex" not in cmd

    def test_output_path_in_command(self):
        mock_run = self._run()
        cmd = mock_run.call_args[0][0]
        assert "output.mp4" in cmd

    def test_visual_and_voice_inputs_in_command(self):
        mock_run = self._run()
        cmd = mock_run.call_args[0][0]
        assert "visual.mp4" in cmd
        assert "voice.wav" in cmd

    def test_overwrite_flag_present(self):
        mock_run = self._run()
        cmd = mock_run.call_args[0][0]
        assert "-y" in cmd


class TestFinalizeCleanup(unittest.TestCase):
    def test_visual_tmp_deleted_on_success(self):
        from app.services.quality.ffmpeg_mux import finalize
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink") as mock_unlink:
            mock_run.return_value = MagicMock(returncode=0)
            finalize("visual.mp4", "voice.wav", None, "output.mp4")
        mock_unlink.assert_called_with("visual.mp4")

    def test_visual_tmp_deleted_even_on_ffmpeg_failure(self):
        from app.services.quality.ffmpeg_mux import finalize
        fallback = MagicMock()
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink") as mock_unlink:
            mock_run.side_effect = subprocess.CalledProcessError(1, "ffmpeg", stderr=b"err")
            finalize("visual.mp4", "voice.wav", None, "output.mp4", fallback_fn=fallback)
        mock_unlink.assert_called_with("visual.mp4")
