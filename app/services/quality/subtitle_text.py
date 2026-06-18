"""Deterministic Spanish-aware subtitle text shaping.

Pure/stdlib only so it can be unit tested without PIL/moviepy. This module does
the *logical* shaping (normalization + line breaking by a character budget);
pixel-accurate wrapping still happens in ``video.py`` via PIL. Running this
first gives the renderer cleaner, well-punctuated Spanish text.

Spanish specifics handled:
- Opening marks ``¿`` / ``¡`` must hug the following word (no trailing space).
- Closing punctuation (``? ! , . ; :``) must hug the preceding word and never
  start a line.
- Accents, ``ñ`` and other diacritics are preserved untouched.
"""

import re

# Punctuation that must attach to the preceding token / never open a line.
_CLOSING_PUNCT = "?!,.;:)]}»…"
# Marks that open a clause and must attach to the following token.
_OPENING_MARKS = "¿¡([{«"

_WS_RE = re.compile(r"\s+")
# space(s) immediately after an opening mark -> remove
_SPACE_AFTER_OPENING_RE = re.compile(r"([¿¡(\[{«])\s+")
# space(s) immediately before closing punctuation -> remove
_SPACE_BEFORE_CLOSING_RE = re.compile(r"\s+([?!,.;:)\]}»…])")


def normalize_spanish_subtitle(text: str) -> str:
    """Normalize whitespace and Spanish punctuation spacing.

    Collapses runs of whitespace/newlines to single spaces and fixes spacing
    around inverted opening marks and closing punctuation. Leaves letters,
    accents and ``ñ`` untouched. Empty/whitespace input yields ``""``.
    """
    if not text:
        return ""
    normalized = _WS_RE.sub(" ", text).strip()
    if not normalized:
        return ""
    normalized = _SPACE_AFTER_OPENING_RE.sub(r"\1", normalized)
    normalized = _SPACE_BEFORE_CLOSING_RE.sub(r"\1", normalized)
    return normalized


def _greedy_wrap(words, max_chars: int):
    """Greedy word wrap by character budget; never splits a word."""
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip() if current else word
        if len(candidate) <= max_chars or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _pull_leading_closing_punctuation(lines):
    """Ensure no line starts with closing punctuation.

    If a line begins with a closing-punctuation token, attach it to the end of
    the previous line instead (Spanish never starts a line with ``?``/``.``).
    """
    fixed = []
    for line in lines:
        stripped = line.lstrip()
        if fixed and stripped and stripped[0] in _CLOSING_PUNCT:
            # move the leading punctuation token onto the previous line
            head, _, tail = stripped.partition(" ")
            fixed[-1] = f"{fixed[-1]}{head}"
            if tail:
                fixed.append(tail)
        else:
            fixed.append(line)
    return fixed


def _merge_overflow(lines, max_lines: int):
    """Keep at most ``max_lines`` lines, merging surplus into the last one so
    no text is ever dropped."""
    if max_lines >= 1 and len(lines) > max_lines:
        head = lines[: max_lines - 1]
        tail = " ".join(lines[max_lines - 1 :])
        return head + [tail]
    return lines


def wrap_subtitle_text(text: str, max_chars: int, max_lines: int = 2):
    """Break ``text`` into at most ``max_lines`` lines of roughly ``max_chars``.

    Words are never split. A single word longer than the budget is kept whole.
    Lines never start with closing punctuation. If the text cannot fit in
    ``max_lines`` lines, the surplus is merged into the last line so nothing is
    lost (the renderer's pixel wrapping is the final safety net).
    """
    words = text.split()
    if not words:
        return []
    lines = _greedy_wrap(words, max_chars)
    lines = _pull_leading_closing_punctuation(lines)
    lines = _merge_overflow(lines, max_lines)
    return lines


def shape_spanish_subtitle(text: str, max_chars: int, max_lines: int = 2) -> str:
    """Convenience: normalize then wrap, returning a newline-joined block."""
    return "\n".join(
        wrap_subtitle_text(normalize_spanish_subtitle(text), max_chars, max_lines)
    )
