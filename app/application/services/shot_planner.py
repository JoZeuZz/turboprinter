from __future__ import annotations

import re

from loguru import logger

from app.config import config
from app.domain.planning.models import ShotPlan, ShotSegment
from app.infrastructure.llm.structured_output import (
    LiteLLMStructuredProvider,
    StructuredLLMProvider,
)
from app.infrastructure.storage.base import ProjectStore

_DEFAULT_SEGMENT_SEC = 5.0
_STOPWORDS = frozenset({"para", "como", "pero", "este", "esta", "esto", "unos", "unas", "que", "los", "las", "del", "con", "por", "una", "uno"})


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
    total = target_duration_sec if target_duration_sec is not None else n * _DEFAULT_SEGMENT_SEC
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


_SYSTEM_RULES = """You are an audiovisual director for short-form video.
Transform the narration script into a structured shot plan.
Return ONLY valid JSON matching the schema.
Rules:
- Do not invent media URLs or clip IDs.
- Split the narration into coherent visual segments.
- Each segment must have a concrete visual_goal.
- Each segment must include 2-5 concrete search_queries for stock video APIs.
- Queries must be visually specific, not abstract.
- Include fallback_queries and must_avoid when useful.
- Keep visual continuity across the whole video.
- Respect the target duration.
"""


def _build_prompt(script, language, target_duration_sec, topic, visual_style):
    parts = [
        _SYSTEM_RULES,
        f"Language: {language}",
    ]
    if topic:
        parts.append(f"Topic: {topic}")
    if visual_style:
        parts.append(f"Global visual style: {visual_style}")
    if target_duration_sec:
        parts.append(f"Target total duration (seconds): {target_duration_sec}")
    parts.append(f"Script:\n{script}")
    return "\n\n".join(parts)


def _repair_prompt(base_prompt, error):
    return (
        base_prompt
        + f"\n\nThe previous response was invalid: {error}\n"
        "Return ONLY corrected JSON strictly matching the schema."
    )


class ShotPlanner:
    def __init__(self, provider: StructuredLLMProvider, store: ProjectStore | None = None):
        self._provider = provider
        self._store = store

    def plan(
        self,
        script: str,
        language: str,
        target_duration_sec: float | None = None,
        topic: str | None = None,
        visual_style: str | None = None,
        task_id: str | None = None,
    ) -> ShotPlan:
        if not script or not script.strip():
            raise ValueError("script must not be empty")

        base_prompt = _build_prompt(script, language, target_duration_sec, topic, visual_style)
        result: ShotPlan | None = None

        try:
            logger.info("[shot_planner] attempt 1 via structured provider")
            result = self._provider.generate_structured(base_prompt, ShotPlan)
        except Exception as exc:  # noqa: BLE001 - degradación controlada
            logger.warning(f"[shot_planner] attempt 1 failed: {exc!r}; repairing")
            try:
                result = self._provider.generate_structured(
                    _repair_prompt(base_prompt, exc), ShotPlan
                )
            except Exception as exc2:  # noqa: BLE001
                logger.warning(
                    f"[shot_planner] repair failed: {exc2!r}; using heuristic fallback"
                )
                result = heuristic_shot_plan(
                    script, language, target_duration_sec, topic, visual_style, task_id
                )

        # propagar task_id al plan resultante
        assert result is not None
        if task_id and result.task_id != task_id:
            result = result.model_copy(update={"task_id": task_id})

        if self._store is not None and task_id:
            logger.info(f"[shot_planner] persisting shot_plan.json for task {task_id}")
            self._store.save_shot_plan(task_id, result)

        return result


def get_shot_planner(store: ProjectStore | None = None) -> "ShotPlanner | None":
    """Factory: returns None when the flag is off (default), else a ShotPlanner."""
    if not getattr(config, "structured_shot_planner_enabled", False):
        return None
    return ShotPlanner(LiteLLMStructuredProvider(), store=store)
