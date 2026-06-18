"""Pluggable TTS adapter + word-timestamp alignment (Personal Quality Stack, Fase 4).

Provides a uniform result shape for any text-to-speech provider and an optional
Whisper-based alignment fallback when a provider does not return word-level
timestamps. The core here is pure/stdlib and fully unit testable; the only
runtime-heavy piece (:func:`make_faster_whisper_aligner`) imports
``faster_whisper`` lazily and reuses the dependency the project already ships,
so this phase adds **no new mandatory dependency**.

Existing providers are untouched: ``app.services.voice`` keeps working as-is.
``voice.synthesize`` (added in this phase) wraps the existing ``voice.tts`` into
a :class:`TTSResult` without removing any provider.

Adding a local TTS provider (Piper / XTTS / Chatterbox / Coqui / ...):

    from app.services.quality.tts_adapter import TTSResult, build_tts_result

    class PiperProvider:
        def synthesize(self, text, voice, rate, output_file, **kwargs) -> TTSResult:
            # 1. run the engine, writing audio to `output_file`
            # 2. read the real duration
            # 3. optionally collect word timestamps if the engine exposes them
            return build_tts_result(
                audio_file=output_file,
                duration=measured_duration,
                provider="piper",
                word_timestamps=optional_word_list,  # or None
                metadata={"voice": voice, "rate": rate},
            )

Any class with a matching ``synthesize`` is a :class:`TTSProvider` (structural).
If the provider returns no word timestamps, call
:func:`ensure_word_timestamps` with a Whisper aligner to fill them.

Voice-cloning note: do not clone a voice without an explicit, user-provided
legal voice sample and a clear personal-use warning.
"""

from dataclasses import dataclass, field, replace
from typing import List, Optional, Protocol, runtime_checkable

_HUNDRED_NS_PER_SECOND = 10_000_000  # edge_tts offsets are in 100ns units


@dataclass
class WordTimestamp:
    word: str
    start: float
    end: float


@dataclass
class TTSResult:
    audio_file: str
    duration: float
    provider: str = ""
    word_timestamps: Optional[List[WordTimestamp]] = None
    metadata: dict = field(default_factory=dict)


@runtime_checkable
class TTSProvider(Protocol):
    """Structural interface for a TTS engine adapter."""

    def synthesize(
        self, text: str, voice: str, rate: float, output_file: str, **kwargs
    ) -> TTSResult:
        ...


def build_tts_result(
    audio_file: str,
    duration: float,
    provider: str = "",
    word_timestamps: Optional[List[WordTimestamp]] = None,
    metadata: Optional[dict] = None,
) -> TTSResult:
    return TTSResult(
        audio_file=audio_file,
        duration=float(duration or 0.0),
        provider=provider,
        word_timestamps=word_timestamps or None,
        metadata=metadata or {},
    )


def has_word_timestamps(result: TTSResult) -> bool:
    return bool(result.word_timestamps)


def normalize_word_timestamps(raw) -> List[WordTimestamp]:
    """Coerce a heterogeneous word list into sorted, validated WordTimestamps.

    Accepts tuples ``(word, start, end)`` or dicts with ``word``/``text`` +
    ``start``/``end``. Drops empty words, swaps reversed start/end and sorts by
    start time. Deterministic.
    """
    out: List[WordTimestamp] = []
    for item in raw or []:
        if isinstance(item, dict):
            word = item.get("word", item.get("text", ""))
            start = item.get("start", 0)
            end = item.get("end", 0)
        else:
            try:
                word, start, end = item
            except (ValueError, TypeError):
                continue
        word = str(word or "").strip()
        if not word:
            continue
        try:
            start = float(start)
            end = float(end)
        except (TypeError, ValueError):
            continue
        if end < start:
            start, end = end, start
        out.append(WordTimestamp(word=word, start=start, end=end))
    out.sort(key=lambda w: (w.start, w.end))
    return out


def extract_word_timestamps_from_submaker(sub_maker) -> List[WordTimestamp]:
    """Best-effort word timestamps from an edge_tts SubMaker.

    Prefers edge_tts 7.x ``cues`` (``.text`` + ``.start``/``.end`` timedeltas),
    falling back to the project's legacy ``subs``/``offset`` (100ns units).
    Returns ``[]`` when no timing info is present (clean fallback).
    """
    if sub_maker is None:
        return []

    cues = getattr(sub_maker, "cues", None)
    if cues:
        raw = []
        for cue in cues:
            start = getattr(cue, "start", None)
            end = getattr(cue, "end", None)
            if start is None or end is None:
                continue
            start_s = start.total_seconds() if hasattr(start, "total_seconds") else float(start)
            end_s = end.total_seconds() if hasattr(end, "total_seconds") else float(end)
            raw.append((getattr(cue, "text", ""), start_s, end_s))
        return normalize_word_timestamps(raw)

    subs = getattr(sub_maker, "subs", None)
    offset = getattr(sub_maker, "offset", None)
    if subs and offset:
        raw = []
        for text, span in zip(subs, offset):
            try:
                start_ns, end_ns = span
            except (ValueError, TypeError):
                continue
            raw.append(
                (
                    text,
                    float(start_ns) / _HUNDRED_NS_PER_SECOND,
                    float(end_ns) / _HUNDRED_NS_PER_SECOND,
                )
            )
        return normalize_word_timestamps(raw)

    return []


def align_with_transcriber(audio_file: str, transcriber) -> List[WordTimestamp]:
    """Run an injected ``transcriber(audio_file) -> raw word list`` and normalize.

    ``transcriber`` returns an iterable of ``(word, start, end)`` tuples or word
    dicts. Decoupled from any specific engine so it is unit testable.
    """
    if transcriber is None:
        return []
    return normalize_word_timestamps(transcriber(audio_file))


def ensure_word_timestamps(
    result: TTSResult, audio_file: str, aligner=None
) -> TTSResult:
    """Return ``result`` with word timestamps, aligning only if needed.

    If the result already has timestamps, returns it unchanged (the aligner is
    never invoked). Otherwise, when an ``aligner`` is provided, fills timestamps
    via :func:`align_with_transcriber`. Without an aligner this is a clean
    fallback that leaves the result without timestamps.
    """
    if has_word_timestamps(result):
        return result
    if aligner is None:
        return result
    word_timestamps = align_with_transcriber(audio_file, aligner)
    return replace(result, word_timestamps=word_timestamps or None)


def result_to_dict(result: TTSResult) -> dict:
    return {
        "audio_file": result.audio_file,
        "duration": result.duration,
        "provider": result.provider,
        "metadata": result.metadata,
        "word_timestamps": [
            {"word": w.word, "start": w.start, "end": w.end}
            for w in (result.word_timestamps or [])
        ],
    }


def make_faster_whisper_aligner(
    model_size: str = "large-v3",
    device: str = "cpu",
    compute_type: str = "int8",
    language: Optional[str] = None,
):
    """Build a Whisper aligner callable ``aligner(audio_file) -> raw word list``.

    Lazily imports ``faster_whisper`` (already a project dependency) so this
    module stays import-light for tests/minimal environments. The returned
    callable transcribes with ``word_timestamps=True`` and yields
    ``(word, start, end)`` tuples; on any failure it returns ``[]`` so callers
    degrade cleanly to phrase-level subtitles.
    """

    def aligner(audio_file: str):
        try:
            from faster_whisper import WhisperModel

            model = WhisperModel(
                model_size_or_path=model_size, device=device, compute_type=compute_type
            )
            segments, _info = model.transcribe(
                audio_file, word_timestamps=True, language=language
            )
            words = []
            for segment in segments:
                for word in getattr(segment, "words", None) or []:
                    words.append((word.word, word.start, word.end))
            return words
        except Exception:
            return []

    return aligner
