"""Phase timing instrumentation for both project-mode and legacy pipelines.

Usage:
    with phase_timer("plan", project_id=pid):
        result = shot_planner.plan(...)

When TURBOPRINTER_PHASE_TIMING is false (default), phase_timer is a no-op
context manager with near-zero overhead.

When enabled, each phase:
  - Measures wall time with time.perf_counter().
  - Logs one loguru INFO line: "[phase:name] 1.234s ok=True".
  - If project_id is supplied, appends one JSON record to
    storage/tasks/{project_id}/timings.json (failures are silently warned).
"""
from __future__ import annotations

import json
import os
import time
from contextlib import contextmanager
from datetime import datetime, timezone

from loguru import logger


def _is_enabled() -> bool:
    from app.config import config  # lazy import to avoid circular dep at module load

    return bool(getattr(config, "phase_timing_enabled", False))


def _timings_path(project_id: str) -> str:
    from app.utils.utils import task_dir

    return os.path.join(task_dir(project_id), "timings.json")


def _append_record(path: str, record: dict) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[phase_timer] failed to write timings.json: {exc!r}")


@contextmanager
def phase_timer(name: str, project_id: str | None = None):
    """Context manager that times a pipeline phase.

    Re-raises any exception from the wrapped block unchanged.
    Is a no-op when phase_timing_enabled is False.
    """
    if not _is_enabled():
        yield
        return

    start = time.perf_counter()
    error: str | None = None
    ok = True
    try:
        yield
    except Exception as exc:
        ok = False
        error = repr(exc)
        raise
    finally:
        elapsed = time.perf_counter() - start
        logger.info(f"[phase:{name}] {elapsed:.3f}s ok={ok}")
        if project_id is not None:
            record = {
                "phase": name,
                "elapsed_sec": round(elapsed, 6),
                "ts": datetime.now(timezone.utc).isoformat(),
                "ok": ok,
                "error": error,
            }
            _append_record(_timings_path(project_id), record)
