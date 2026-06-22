"""Persistent project and script-history storage."""

import hashlib
import json
import os
import re
import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

from app.utils import utils


@dataclass
class ProjectRecord:
    id: str
    subject: str
    normalized_subject: str
    status: str
    script: str
    terms: list[str]
    params: dict[str, Any]
    artifacts: dict[str, Any]
    task_id: str
    created_at: str
    updated_at: str
    completed_at: str | None


_SCHEMA = """
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    normalized_subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    script TEXT NOT NULL DEFAULT '',
    script_hash TEXT NOT NULL DEFAULT '',
    terms_json TEXT NOT NULL DEFAULT '[]',
    params_json TEXT NOT NULL DEFAULT '{}',
    artifacts_json TEXT NOT NULL DEFAULT '{}',
    task_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_subject
    ON projects(normalized_subject, updated_at DESC);
"""


def default_db_path() -> str:
    return os.path.join(utils.storage_dir("projects", create=True), "projects.db")


def connect(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or default_db_path())
    conn.row_factory = sqlite3.Row
    conn.executescript(_SCHEMA)
    conn.commit()
    return conn


def normalize_subject(subject: str) -> str:
    normalized = unicodedata.normalize("NFKD", subject or "").casefold()
    without_marks = "".join(
        char for char in normalized if not unicodedata.combining(char)
    )
    return " ".join(re.findall(r"[^\W_]+", without_marks, flags=re.UNICODE))


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _json_value(value: Any, fallback: Any) -> str:
    if value is None:
        value = fallback
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json", warnings=False)
    return json.dumps(value, ensure_ascii=False, default=str)


def _loads(value: str, fallback: Any) -> Any:
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _row_to_project(row: sqlite3.Row) -> ProjectRecord:
    return ProjectRecord(
        id=row["id"],
        subject=row["subject"],
        normalized_subject=row["normalized_subject"],
        status=row["status"],
        script=row["script"],
        terms=_loads(row["terms_json"], []),
        params=_loads(row["params_json"], {}),
        artifacts=_loads(row["artifacts_json"], {}),
        task_id=row["task_id"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        completed_at=row["completed_at"],
    )


def save_project(
    conn: sqlite3.Connection,
    project_id: str,
    *,
    subject: str,
    status: str = "draft",
    script: str = "",
    terms: list[str] | str | None = None,
    params: Any = None,
    artifacts: dict[str, Any] | None = None,
    task_id: str = "",
) -> ProjectRecord:
    now = _now_iso()
    existing = get_project(conn, project_id)
    if isinstance(terms, str):
        terms = [item.strip() for item in terms.split(",") if item.strip()]
    effective_terms = terms if terms is not None else (existing.terms if existing else [])
    effective_params = params if params is not None else (existing.params if existing else {})
    effective_artifacts = (
        artifacts if artifacts is not None else (existing.artifacts if existing else {})
    )
    completed_at = now if status == "completed" else None
    script_hash = hashlib.sha256((script or "").encode("utf-8")).hexdigest() if script else ""
    conn.execute(
        """
        INSERT INTO projects
            (id, subject, normalized_subject, status, script, script_hash,
             terms_json, params_json, artifacts_json, task_id, created_at,
             updated_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            subject=excluded.subject,
            normalized_subject=excluded.normalized_subject,
            status=excluded.status,
            script=excluded.script,
            script_hash=excluded.script_hash,
            terms_json=excluded.terms_json,
            params_json=excluded.params_json,
            artifacts_json=excluded.artifacts_json,
            task_id=excluded.task_id,
            updated_at=excluded.updated_at,
            completed_at=COALESCE(excluded.completed_at, projects.completed_at)
        """,
        (
            project_id,
            (subject or "").strip(),
            normalize_subject(subject),
            status,
            script or "",
            script_hash,
            _json_value(effective_terms, []),
            _json_value(effective_params, {}),
            _json_value(effective_artifacts, {}),
            task_id or (existing.task_id if existing else ""),
            existing.created_at if existing else now,
            now,
            completed_at,
        ),
    )
    conn.commit()
    return get_project(conn, project_id)


def get_project(conn: sqlite3.Connection, project_id: str) -> ProjectRecord | None:
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _row_to_project(row) if row else None


def list_projects(conn: sqlite3.Connection, limit: int = 30) -> list[ProjectRecord]:
    rows = conn.execute(
        "SELECT * FROM projects ORDER BY updated_at DESC LIMIT ?", (max(1, limit),)
    ).fetchall()
    return [_row_to_project(row) for row in rows]


def previous_scripts(
    conn: sqlite3.Connection,
    subject: str,
    *,
    exclude_project_id: str = "",
    limit: int = 8,
) -> list[str]:
    normalized = normalize_subject(subject)
    if not normalized:
        return []
    rows = conn.execute(
        """
        SELECT script FROM projects
        WHERE normalized_subject = ? AND script <> '' AND id <> ?
        ORDER BY updated_at DESC LIMIT ?
        """,
        (normalized, exclude_project_id, max(1, limit)),
    ).fetchall()
    return [row["script"] for row in rows]


def _normalized_script(script: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", normalize_subject(script)))


def script_similarity(first: str, second: str) -> float:
    left = _normalized_script(first)
    right = _normalized_script(second)
    if not left or not right:
        return 0.0
    sequence_score = SequenceMatcher(None, left, right).ratio()
    left_words = left.split()
    right_words = right.split()
    left_shingles = set(zip(left_words, left_words[1:], left_words[2:]))
    right_shingles = set(zip(right_words, right_words[1:], right_words[2:]))
    union = left_shingles | right_shingles
    shingle_score = len(left_shingles & right_shingles) / len(union) if union else 0.0
    return max(sequence_score, shingle_score)


def is_too_similar(script: str, previous: list[str], threshold: float = 0.72) -> bool:
    return any(script_similarity(script, old_script) >= threshold for old_script in previous)


def originality_context(previous: list[str], limit: int = 5) -> str:
    excerpts = []
    for index, script in enumerate(previous[:limit], start=1):
        compact = " ".join((script or "").split())[:500]
        if compact:
            excerpts.append(f"{index}. {compact}")
    return "\n".join(excerpts)
