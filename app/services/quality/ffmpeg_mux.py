"""FFmpeg-native final mux with optional audio ducking.

MoviePy handles all clip assembly (crop/resize/concat/subtitles) and writes
a silent visual-only temp file.  This module muxes that visual with the TTS
voice track and optional BGM via a single FFmpeg subprocess call.

Fallback: if the ffmpeg binary is missing or the command fails, ``fallback_fn``
is called (defaults to None — caller must supply when needed).
"""
from __future__ import annotations

import os
import subprocess
from collections.abc import Callable
from typing import Optional

from loguru import logger


def finalize(
    visual_path: str,
    voice_path: str,
    bgm_path: Optional[str],
    output_path: str,
    *,
    bgm_volume: float = 0.2,
    duck_db: float = 12.0,
    fps: int = 30,
    codec: str = "libx264",
    fallback_fn: Optional[Callable] = None,
) -> None:
    """Mux visual + voice + optional BGM into *output_path* using FFmpeg.

    Args:
        visual_path: Temp video file written by MoviePy (no audio stream).
        voice_path:  TTS voice track (WAV or MP3).
        bgm_path:    Background music file; ``None`` skips BGM entirely.
        output_path: Final output video path.
        bgm_volume:  Linear volume multiplier for BGM (0.0–1.0).
        duck_db:     How many dB to attenuate BGM during voice segments.
        fps:         Output frame rate passed to FFmpeg.
        codec:       Video codec (e.g. ``libx264``, ``h264_nvenc``).
        fallback_fn: Callable invoked with no arguments when FFmpeg fails.
    """
    try:
        cmd = _build_command(
            visual_path, voice_path, bgm_path, output_path,
            bgm_volume=bgm_volume, duck_db=duck_db, fps=fps, codec=codec,
        )
        logger.debug(f"ffmpeg_mux cmd: {' '.join(cmd)}")
        subprocess.run(cmd, check=True, capture_output=True)
        logger.info(f"ffmpeg_mux: wrote {output_path}")
    except FileNotFoundError:
        logger.warning("ffmpeg binary not found — falling back to MoviePy mux")
        if fallback_fn is not None:
            fallback_fn()
    except subprocess.CalledProcessError as exc:
        logger.exception(
            f"ffmpeg_mux failed (rc={exc.returncode}): "
            f"{(exc.stderr or b'').decode(errors='replace')}"
        )
        if fallback_fn is not None:
            fallback_fn()
    finally:
        if os.path.exists(visual_path):
            try:
                os.unlink(visual_path)
            except OSError as exc:
                logger.warning(f"ffmpeg_mux: could not delete temp file {visual_path}: {exc}")


def _build_command(
    visual_path: str,
    voice_path: str,
    bgm_path: Optional[str],
    output_path: str,
    *,
    bgm_volume: float,
    duck_db: float,
    fps: int,
    codec: str,
) -> list[str]:
    """Build the FFmpeg command list."""
    cmd = ["ffmpeg", "-y"]

    # Inputs
    cmd += ["-i", visual_path]   # 0:v — visual (no audio)
    cmd += ["-i", voice_path]    # 1:a — TTS voice

    if bgm_path:
        cmd += ["-i", bgm_path]  # 2:a — BGM
        filtergraph = _build_ducking_filtergraph(bgm_volume=bgm_volume, duck_db=duck_db)
        cmd += ["-filter_complex", filtergraph]
        cmd += ["-map", "0:v", "-map", "[aout]"]
    else:
        cmd += ["-map", "0:v", "-map", "1:a"]

    cmd += [
        "-c:v", codec,
        "-c:a", "aac",
        "-r", str(fps),
        "-shortest",
        output_path,
    ]
    return cmd


def _build_ducking_filtergraph(*, bgm_volume: float, duck_db: float) -> str:
    """Return the filter_complex string for side-chain BGM ducking.

    Signal chain:
      1. Volume-adjust BGM by *bgm_volume* (linear).
      2. Side-chain compress BGM using voice as the detector, attenuating
         by *duck_db* during speech.
      3. Mix compressed BGM with original voice at equal weight.
    """
    ratio = round(10 ** (duck_db / 20), 2)  # dB → ratio for sidechaincompress
    return (
        f"[2:a]volume={bgm_volume:.4f}[bgm];"
        f"[bgm][1:a]sidechaincompress="
        f"threshold=0.02:ratio={ratio}:attack=5:release=200[ducked];"
        f"[1:a][ducked]amix=inputs=2:duration=first[aout]"
    )
