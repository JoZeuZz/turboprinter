"""Per-task render manifest for the optional Personal Quality Stack.

Pure/stdlib-only: builds a plain, JSON-serializable ``dict`` describing the
effective quality settings, the resolved render profile, the selected codec and
the artifacts produced for a task. The caller (``app.services.task``) decides
when to persist it as ``manifest.json``.

This module imports nothing from the application, moviepy or any third-party
package, so it stays unit-testable in minimal environments. It is only invoked
when the quality stack is enabled, so upstream task output is unchanged.
"""

from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Optional

MANIFEST_VERSION = 1


def _as_dict(obj) -> Optional[dict]:
    """Best-effort conversion of a (frozen) dataclass / mapping to a plain dict.

    Returns ``None`` for ``None`` or anything we cannot safely serialize, so the
    manifest never carries non-JSON-able objects.
    """
    if obj is None:
        return None
    if is_dataclass(obj) and not isinstance(obj, type):
        return asdict(obj)
    if isinstance(obj, dict):
        return dict(obj)
    return None


def build_render_manifest(
    *,
    task_id,
    quality_settings=None,
    render_profile=None,
    codec=None,
    artifacts=None,
    created_at: Optional[str] = None,
) -> dict:
    """Build the per-task render manifest.

    All inputs are optional and read defensively: missing/``None`` sections are
    emitted as ``null`` (or an empty mapping for ``artifacts``). ``artifacts``
    entries with empty/``None`` values are dropped so the manifest only records
    files that actually exist. ``created_at`` defaults to the current UTC time
    in ISO-8601; it is injectable to keep the output deterministic in tests.
    """
    if created_at is None:
        created_at = datetime.now(timezone.utc).isoformat()

    clean_artifacts = {
        key: value for key, value in (artifacts or {}).items() if value
    }

    return {
        "manifest_version": MANIFEST_VERSION,
        "task_id": task_id,
        "created_at": created_at,
        "codec": codec,
        "quality": _as_dict(quality_settings),
        "render_profile": _as_dict(render_profile),
        "artifacts": clean_artifacts,
    }
