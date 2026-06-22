from __future__ import annotations

import re

from app.domain.planning.models import ShotPlan, ShotSegment

_DEFAULT_SEGMENT_SEC = 5.0
_STOPWORDS = {"para", "como", "pero", "este", "esta", "esto", "unos", "unas", "que", "los", "las", "del", "con", "por", "una", "uno"}


def _split_sentences(script: str) -> list[str]:
    parts = re.split(r"[.!?]+", script)
    return [p.strip() for p in parts if p.strip()]


def _keywords(text: str, topic: str | None) -> list[str]:
    words = [w.lower() for w in re.findall(r"[\wáéíóúñü]+", text)]
    kept = [w for w in words if len(w) > 3 and w not in _STOPWORDS]
    # dedupe preservando orden
    seen: set[str] = set()
    uniq = [w for w in kept if not (w in seen or seen.add(w))]
    queries = uniq[:5]
    if not queries:
        queries = [topic] if topic else ["cinematic background"]
    return queries


def heuristic_shot_plan(
    script: str,
    language: str,
    target_duration_sec: float | None = None,
    topic: str | None = None,
    visual_style: str | None = None,
    task_id: str | None = None,
) -> ShotPlan:
    """Plan determinista sin red: split por oraciones + duración uniforme."""
    sentences = _split_sentences(script) or [script.strip()]
    n = len(sentences)
    total = target_duration_sec if target_duration_sec else n * _DEFAULT_SEGMENT_SEC
    per = round(total / n, 3)

    segments: list[ShotSegment] = []
    cursor = 0.0
    for i, text in enumerate(sentences, start=1):
        start = round(cursor, 3)
        end = round(cursor + per, 3)
        cursor = end
        segments.append(
            ShotSegment(
                id=f"seg_{i:03d}",
                order=i,
                narration_text=text,
                start_sec=start,
                end_sec=end,
                target_duration_sec=per,
                visual_goal=f"visual support for: {text[:60]}",
                search_queries=_keywords(text, topic),
            )
        )

    return ShotPlan(
        task_id=task_id,
        language=language,
        topic=topic,
        script=script,
        total_duration_sec=round(per * n, 3),
        segments=segments,
        global_visual_style=visual_style,
    )
