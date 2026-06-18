"""Spanish Content Package generator (Personal Quality Stack, Fase 7).

Produces a sidecar publishing package next to the video: title, hook,
description, hashtags, per-scene keywords, a thumbnail prompt and a human review
checklist. Fully deterministic and pure/stdlib, so it works with a manually
pasted script and **without any LLM/API key** (the user has no guaranteed
OpenAI/Anthropic key at runtime).

Optional enrichment: ``build_content_package`` accepts an ``llm_metadata`` dict
(e.g. the output of ``llm.generate_social_metadata``) to override the
deterministic title/description/hashtags when a provider is configured. This is
an opt-in seam — nothing here ever calls an LLM by itself.
"""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import List, Optional

# Common Spanish stopwords to drop during keyword extraction.
SPANISH_STOPWORDS = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "u", "e",
    "de", "del", "al", "a", "ante", "con", "sin", "por", "para", "en", "sobre",
    "que", "qué", "cual", "cuál", "quien", "quién", "como", "cómo", "cuando",
    "cuándo", "donde", "dónde", "es", "son", "ser", "estar", "está", "están",
    "este", "esta", "estos", "estas", "ese", "esa", "eso", "esto", "su", "sus",
    "mi", "mis", "tu", "tus", "lo", "le", "les", "se", "me", "te", "nos", "más",
    "muy", "ya", "no", "sí", "si", "pero", "porque", "cada", "todo", "toda",
    "todos", "todas", "puede", "pueden", "hay", "fue", "han", "ha", "con",
}

_WORD_RE = re.compile(r"[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+", re.UNICODE)
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+|\n+")

_TITLE_MAX = 80
_SUMMARY_MAX = 220
_HOOK_MAX = 90

_PLATFORM_TAGS = {
    "shorts": ["#shorts", "#fyp", "#viral"],
    "reels": ["#reels", "#fyp", "#viral"],
    "tiktok": ["#tiktok", "#fyp", "#parati"],
    "landscape": ["#video"],
}

_REVIEW_CHECKLIST = [
    "Verificar los derechos/licencia de la música de fondo.",
    "Revisar que los subtítulos coincidan con el audio.",
    "Comprobar que el hook engancha en los primeros 3 segundos.",
    "Revisar tildes, ñ y signos de apertura (¿ ¡).",
    "Verificar la duración adecuada para la plataforma objetivo.",
    "Revisar la licencia de los materiales de vídeo usados.",
    "Comprobar el encuadre y la safe-area de los subtítulos.",
    "Validar título, descripción y hashtags antes de publicar.",
]


@dataclass
class ContentPackage:
    title: str
    hook: str
    summary: str
    description: str
    hashtags: List[str]
    scene_keywords: List[List[str]]
    thumbnail_prompt: str
    review_checklist: List[str] = field(default_factory=list)


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def extract_keywords(
    text: str, limit: int = 8, extra_stopwords: Optional[set] = None
) -> List[str]:
    """Return up to ``limit`` keywords ordered by frequency then first seen.

    Lowercased, accents preserved, stopwords and tokens shorter than 3 chars
    dropped. Deterministic.
    """
    stop = SPANISH_STOPWORDS | (extra_stopwords or set())
    counts: dict = {}
    order: dict = {}
    for idx, match in enumerate(_WORD_RE.findall(text.lower())):
        if len(match) < 3 or match in stop:
            continue
        counts[match] = counts.get(match, 0) + 1
        order.setdefault(match, idx)
    ranked = sorted(counts.keys(), key=lambda w: (-counts[w], order[w]))
    return ranked[:limit]


def split_scenes(script: str) -> List[str]:
    """Split a script into scene-sized sentences (also breaks on newlines)."""
    if not script or not script.strip():
        return []
    parts = _SENTENCE_SPLIT_RE.split(script.strip())
    return [p.strip() for p in parts if p and p.strip()]


def _to_hashtag(token: str) -> str:
    ascii_token = _strip_accents(token.lower())
    cleaned = re.sub(r"[^0-9a-z]+", "", ascii_token)
    return f"#{cleaned}" if cleaned else ""


def build_hashtags(
    keywords: List[str], subject: str, platform: str, limit: int = 12
) -> List[str]:
    """Build ASCII-normalized, de-duplicated hashtags plus platform tags."""
    tags: List[str] = []
    seen = set()

    def add(tag: str):
        if tag and tag not in seen:
            seen.add(tag)
            tags.append(tag)

    for token in _WORD_RE.findall((subject or "").lower()):
        if len(token) >= 3 and token not in SPANISH_STOPWORDS:
            add(_to_hashtag(token))
    for kw in keywords or []:
        add(_to_hashtag(kw))
    for platform_tag in _PLATFORM_TAGS.get(platform, _PLATFORM_TAGS["shorts"]):
        add(platform_tag)

    return [t for t in tags if t][:limit]


def _truncate(text: str, max_len: int) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1].rstrip() + "…"


def build_content_package(
    subject: str,
    script: str,
    keywords: Optional[List[str]] = None,
    language: str = "es",
    platform: str = "shorts",
    llm_metadata: Optional[dict] = None,
) -> ContentPackage:
    """Build a deterministic content package from subject + script.

    ``keywords`` are global search terms (e.g. the pipeline's video_terms); when
    omitted they are derived from the script. ``llm_metadata`` (optional) can
    override title/description/hashtags with provider-generated values.
    """
    scenes = split_scenes(script)
    global_keywords = keywords or extract_keywords(script, limit=8)

    hook = _truncate(scenes[0], _HOOK_MAX) if scenes else _truncate(subject, _HOOK_MAX)
    summary = _truncate(" ".join(scenes[:2]) if scenes else subject, _SUMMARY_MAX)

    title = (subject or "").strip()
    if not title:
        title = _truncate(scenes[0], _TITLE_MAX) if scenes else "Vídeo corto"
    title = _truncate(title, _TITLE_MAX)

    hashtags = build_hashtags(global_keywords, subject, platform)

    scene_keywords = [extract_keywords(scene, limit=3) for scene in scenes]

    thumbnail_prompt = (
        f"Miniatura vertical para {platform}, tema '{subject or title}', "
        f"texto destacado '{hook}', estilo llamativo de alto contraste, "
        "colores vibrantes, composición centrada, sin texto pequeño."
    )

    # Optional LLM enrichment (opt-in): override deterministic fields.
    if llm_metadata:
        if llm_metadata.get("title"):
            title = _truncate(str(llm_metadata["title"]), _TITLE_MAX)
        if llm_metadata.get("caption"):
            summary = str(llm_metadata["caption"]).strip()
        if llm_metadata.get("hashtags"):
            hashtags = [str(t) for t in llm_metadata["hashtags"] if t]

    description = f"{hook}\n\n{summary}\n\n{' '.join(hashtags)}".strip()

    return ContentPackage(
        title=title,
        hook=hook,
        summary=summary,
        description=description,
        hashtags=hashtags,
        scene_keywords=scene_keywords,
        thumbnail_prompt=thumbnail_prompt,
        review_checklist=list(_REVIEW_CHECKLIST),
    )


def package_to_dict(pkg: ContentPackage) -> dict:
    return {
        "title": pkg.title,
        "hook": pkg.hook,
        "summary": pkg.summary,
        "description": pkg.description,
        "hashtags": pkg.hashtags,
        "scene_keywords": pkg.scene_keywords,
        "thumbnail_prompt": pkg.thumbnail_prompt,
        "review_checklist": pkg.review_checklist,
    }


def package_to_markdown(pkg: ContentPackage) -> str:
    lines = [
        f"# {pkg.title}",
        "",
        "## Hook",
        pkg.hook,
        "",
        "## Descripción",
        pkg.description,
        "",
        "## Hashtags",
        " ".join(pkg.hashtags),
        "",
        "## Keywords por escena",
    ]
    for index, kws in enumerate(pkg.scene_keywords, start=1):
        lines.append(f"{index}. {', '.join(kws)}")
    lines += [
        "",
        "## Prompt de miniatura",
        pkg.thumbnail_prompt,
        "",
        "## Checklist de revisión",
    ]
    lines += [f"- [ ] {item}" for item in pkg.review_checklist]
    return "\n".join(lines) + "\n"
