from __future__ import annotations

import json
from typing import runtime_checkable

import litellm
from loguru import logger

from app.domain.media.vision_scoring import VisionProvider, VisionScore  # noqa: F401 (re-export)

_PROMPT = (
    "Rate how relevant this image is for a short-form video segment.\n"
    "Narration: '{narration}'\n"
    "Search query: '{query}'\n"
    "Return ONLY valid JSON: "
    '{{"relevance": 0.0-1.0, "reason": "one sentence in English"}}'
)


class LiteLLMVisionProvider:
    """Implements VisionProvider using litellm multimodal message format."""

    def __init__(self, model: str) -> None:
        self._model = model

    def score_thumbnail(
        self,
        thumbnail_url: str | None,
        query: str,
        narration: str,
    ) -> VisionScore | None:
        if thumbnail_url is None:
            return None
        if not thumbnail_url:
            logger.warning("[vision] empty thumbnail_url, skipping")
            return None
        try:
            prompt = _PROMPT.format(narration=narration[:200], query=query[:100])
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": thumbnail_url}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]
            response = litellm.completion(
                model=self._model,
                messages=messages,
                temperature=0.1,
                drop_params=True,
            )
            choices = getattr(response, "choices", None)
            if not choices:
                logger.warning(f"[vision] empty response from {self._model}")
                return None
            content = choices[0].message.content
            if not content:
                logger.warning(f"[vision] empty content from {self._model}")
                return None
            data = json.loads(content)
            return VisionScore(
                relevance=float(data["relevance"]),
                reason=str(data.get("reason", "")),
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[vision] score_thumbnail failed for {self._model}: {exc!r}")
            return None
