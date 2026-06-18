"""Personal Quality Stack (optional).

This package groups the additive, opt-in quality enhancements for this fork.
Everything here is disabled by default (``[quality] enabled = false``); when
disabled the rest of the application behaves exactly like upstream.

Design rules (see CLAUDE.md):
- Keep modules small, additive and easy to rebase on top of upstream.
- Pure/deterministic logic (settings parsing, profile construction, subtitle
  text shaping, material ranking) must stay dependency-free so it can be unit
  tested without moviepy/ffmpeg/whisper.
"""
