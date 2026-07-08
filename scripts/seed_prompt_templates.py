"""Idempotently seed the five default Spanish prompt templates.

Usage: uv run python scripts/seed_prompt_templates.py
"""
from __future__ import annotations

from app.domain.prompts.seeds import seed_default_templates


def main() -> None:
    created = seed_default_templates()
    if created:
        print(f"Created {len(created)} prompt template(s): {', '.join(created)}")
    else:
        print("All default prompt templates already exist. Nothing to do.")


if __name__ == "__main__":
    main()
