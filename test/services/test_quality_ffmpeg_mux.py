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


class TestFinalizeBgm(unittest.TestCase):
    """finalize() with BGM: filtergraph with sidechaincompress and amix."""

    def _run_with_bgm(self, **kw):
        from app.services.quality.ffmpeg_mux import finalize
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink"):
            mock_run.return_value = MagicMock(returncode=0)
            finalize("visual.mp4", "voice.wav", "bgm.mp3", "output.mp4", **kw)
            return mock_run

    def test_bgm_input_present(self):
        mock_run = self._run_with_bgm()
        cmd = mock_run.call_args[0][0]
        assert "bgm.mp3" in cmd

    def test_filtergraph_flag_present(self):
        mock_run = self._run_with_bgm()
        cmd = mock_run.call_args[0][0]
        assert "-filter_complex" in cmd

    def test_filtergraph_contains_sidechaincompress(self):
        mock_run = self._run_with_bgm()
        cmd = mock_run.call_args[0][0]
        fg_idx = cmd.index("-filter_complex")
        filtergraph = cmd[fg_idx + 1]
        assert "sidechaincompress" in filtergraph

    def test_filtergraph_contains_amix(self):
        mock_run = self._run_with_bgm()
        cmd = mock_run.call_args[0][0]
        fg_idx = cmd.index("-filter_complex")
        filtergraph = cmd[fg_idx + 1]
        assert "amix" in filtergraph

    def test_bgm_volume_applied_to_filtergraph(self):
        mock_run = self._run_with_bgm(bgm_volume=0.15)
        cmd = mock_run.call_args[0][0]
        fg_idx = cmd.index("-filter_complex")
        filtergraph = cmd[fg_idx + 1]
        assert "0.1500" in filtergraph

    def test_map_uses_aout_label(self):
        mock_run = self._run_with_bgm()
        cmd = mock_run.call_args[0][0]
        assert "[aout]" in cmd

    def test_fallback_called_on_called_process_error(self):
        from app.services.quality.ffmpeg_mux import finalize
        fallback = MagicMock()
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink"):
            mock_run.side_effect = subprocess.CalledProcessError(1, "ffmpeg", stderr=b"fail")
            finalize("visual.mp4", "voice.wav", "bgm.mp3", "output.mp4", fallback_fn=fallback)
        fallback.assert_called_once()

    def test_fallback_called_on_file_not_found(self):
        from app.services.quality.ffmpeg_mux import finalize
        fallback = MagicMock()
        with patch("app.services.quality.ffmpeg_mux.subprocess.run") as mock_run, \
             patch("app.services.quality.ffmpeg_mux.os.path.exists", return_value=True), \
             patch("app.services.quality.ffmpeg_mux.os.unlink"):
            mock_run.side_effect = FileNotFoundError("ffmpeg not found")
            finalize("visual.mp4", "voice.wav", None, "output.mp4", fallback_fn=fallback)
        fallback.assert_called_once()
