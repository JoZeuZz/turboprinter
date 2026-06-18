"""Render quality profiles for the optional Personal Quality Stack.

Maps the ``[quality] profile`` selector to concrete FFmpeg encoding parameters
and exposes helpers to build the parameter list passed to MoviePy/FFmpeg. Kept
pure (stdlib only) so command construction can be unit tested without running a
real render (see ``test/services/test_quality_render.py``).

Profiles (slowest/highest last):
- ``fast``     : close to upstream behaviour, quickest.
- ``balanced`` : good default for normal use.
- ``high``     : better visual quality, slower (low CRF, slow preset).
- ``archival`` : maximum reasonable quality, experimental/slow.

Notes:
- CRF and ``-preset`` are libx264/x265-specific. For hardware encoders
  (NVENC/AMF/QSV/...) they are omitted to avoid breaking the command; the
  pixel format is still enforced for player compatibility.
- High-quality scaling (``scale_flags``) is carried here for future use by the
  scaling stage; this module only builds encoder parameters.
- Per-request/config overrides (``render_crf``/``render_preset``/
  ``audio_bitrate``) are applied on top of the selected profile.
"""

from dataclasses import dataclass, replace

# Software encoders for which CRF + ``-preset`` are valid x264/x265 controls.
_SOFTWARE_CRF_CODECS = ("libx264", "libx265")


@dataclass(frozen=True)
class RenderProfile:
    name: str
    crf: int
    preset: str
    pix_fmt: str
    audio_bitrate: str
    fps: int
    use_two_pass: bool
    scale_flags: str  # FFmpeg sws flags for high-quality scaling (future use)


_PROFILES = {
    "fast": RenderProfile(
        name="fast",
        crf=23,
        preset="veryfast",
        pix_fmt="yuv420p",
        audio_bitrate="128k",
        fps=30,
        use_two_pass=False,
        scale_flags="bicubic",
    ),
    "balanced": RenderProfile(
        name="balanced",
        crf=20,
        preset="medium",
        pix_fmt="yuv420p",
        audio_bitrate="192k",
        fps=30,
        use_two_pass=False,
        scale_flags="bicubic",
    ),
    "high": RenderProfile(
        name="high",
        crf=18,
        preset="slow",
        pix_fmt="yuv420p",
        audio_bitrate="256k",
        fps=30,
        use_two_pass=False,
        scale_flags="lanczos",
    ),
    "archival": RenderProfile(
        name="archival",
        crf=16,
        preset="slower",
        pix_fmt="yuv420p",
        audio_bitrate="320k",
        fps=30,
        use_two_pass=False,
        scale_flags="lanczos",
    ),
}

_DEFAULT_PROFILE_NAME = "balanced"


def get_render_profile(quality_settings) -> RenderProfile:
    """Resolve the effective :class:`RenderProfile` for the given settings.

    The selected profile provides the baseline; explicit config overrides
    (``render_crf``/``render_preset``/``audio_bitrate``) and ``use_two_pass``
    are applied on top. Unknown profile names fall back to ``balanced``.
    """
    base = _PROFILES.get(
        getattr(quality_settings, "profile", _DEFAULT_PROFILE_NAME),
        _PROFILES[_DEFAULT_PROFILE_NAME],
    )

    crf = base.crf
    override_crf = getattr(quality_settings, "render_crf", None)
    if override_crf is not None:
        crf = override_crf

    preset = getattr(quality_settings, "render_preset", None) or base.preset
    audio_bitrate = getattr(quality_settings, "audio_bitrate", None) or base.audio_bitrate
    use_two_pass = bool(getattr(quality_settings, "use_two_pass", False))

    return replace(
        base,
        crf=crf,
        preset=preset,
        audio_bitrate=audio_bitrate,
        use_two_pass=use_two_pass,
    )


def build_ffmpeg_video_params(profile: RenderProfile, codec: str = "libx264") -> list:
    """Build the ``ffmpeg_params`` list for a video encode with ``codec``.

    CRF/preset are only emitted for software x264/x265 encoders. The pixel
    format is always enforced for compatibility.
    """
    params: list = []
    if codec in _SOFTWARE_CRF_CODECS:
        params += ["-crf", str(profile.crf), "-preset", profile.preset]
    params += ["-pix_fmt", profile.pix_fmt]
    return params


def build_moviepy_kwargs(
    profile: RenderProfile, codec: str = "libx264", include_audio: bool = True
) -> dict:
    """Build keyword arguments for MoviePy's ``clip.write_videofile``.

    MoviePy maps its own ``preset`` argument to FFmpeg's ``-preset``, so we pass
    the preset natively and keep it OUT of ``ffmpeg_params`` to avoid emitting
    ``-preset`` twice. CRF is libx264/x265-specific and is only added for those
    encoders; the pixel format is always enforced.

    ``include_audio=False`` is used for the intermediate (video-only) clips so
    we do not advertise an irrelevant audio bitrate.
    """
    kwargs: dict = {"fps": profile.fps}
    if include_audio:
        kwargs["audio_bitrate"] = profile.audio_bitrate

    ffmpeg_params: list = []
    if codec in _SOFTWARE_CRF_CODECS:
        kwargs["preset"] = profile.preset
        ffmpeg_params += ["-crf", str(profile.crf)]
    ffmpeg_params += ["-pix_fmt", profile.pix_fmt]
    kwargs["ffmpeg_params"] = ffmpeg_params
    return kwargs


def describe(profile: RenderProfile, codec: str = "libx264") -> str:
    """Human-readable one-line summary for debug logging."""
    return (
        f"render profile '{profile.name}': codec={codec}, crf={profile.crf}, "
        f"preset={profile.preset}, pix_fmt={profile.pix_fmt}, "
        f"audio_bitrate={profile.audio_bitrate}, fps={profile.fps}, "
        f"two_pass={profile.use_two_pass}, scale={profile.scale_flags}"
    )
