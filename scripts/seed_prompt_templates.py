"""Idempotently seed the five default Spanish prompt templates.

Usage: uv run python scripts/seed_prompt_templates.py
"""
from __future__ import annotations

import sys
from pathlib import Path

# Running this file directly (`python scripts/seed_prompt_templates.py`) puts
# this script's own directory on sys.path[0], not the repo root, so the
# `app` package wouldn't otherwise be importable regardless of cwd.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.domain.prompts.seeds import seed_default_templates  # noqa: E402


def main() -> None:
    created = seed_default_templates()
    if created:
        print(f"Created {len(created)} prompt template(s): {', '.join(created)}")
    else:
        print("All default prompt templates already exist. Nothing to do.")


if __name__ == "__main__":
    main()
