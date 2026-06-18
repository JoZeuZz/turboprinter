"""Local material library for the optional Personal Quality Stack (Fase 6).

A curated, reusable index of the user's own video/image files, stored in a
small SQLite database under ``storage/``. The pipeline can prefer these local
assets over stock downloads (feeding the Fase 5 :mod:`material_ranker`).

The store, hashing and directory scanning are stdlib only (``sqlite3``,
``hashlib``, ``os``) so they are fully unit testable. Media probing
(duration/resolution/fps) needs ffprobe/moviepy at runtime and is injected as a
``prober`` callable, defaulting to :func:`probe_media_file`.

Safety: indexing never moves or deletes the user's media. ``remove_entry`` only
removes the database row, never the file on disk.
"""

import hashlib
import os
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

VIDEO_EXTENSIONS = (".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp")

_HASH_CHUNK = 1 << 20  # 1 MiB head/tail sampled for a fast, stable content hash


@dataclass
class LibraryEntry:
    path: str
    hash: str
    media_type: str  # "video" | "image"
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    orientation: str = "unknown"
    tags: List[str] = field(default_factory=list)
    license: Optional[str] = None
    source: Optional[str] = None
    brightness: Optional[float] = None
    indexed_at: str = ""


def orientation_of(width: int, height: int) -> str:
    if width <= 0 or height <= 0:
        return "unknown"
    if height > width:
        return "portrait"
    if width > height:
        return "landscape"
    return "square"


def media_type_for(path: str) -> Optional[str]:
    ext = os.path.splitext(path)[1].lower()
    if ext in VIDEO_EXTENSIONS:
        return "video"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    return None


def compute_file_hash(path: str) -> str:
    """Fast, stable content hash: file size + sampled head/tail bytes.

    Avoids hashing entire multi-GB videos while still detecting content
    changes. Deterministic for the same file contents.
    """
    hasher = hashlib.sha256()
    size = os.path.getsize(path)
    hasher.update(str(size).encode("ascii"))
    with open(path, "rb") as handle:
        hasher.update(handle.read(_HASH_CHUNK))
        if size > 2 * _HASH_CHUNK:
            handle.seek(-_HASH_CHUNK, os.SEEK_END)
            hasher.update(handle.read(_HASH_CHUNK))
    return hasher.hexdigest()


_SCHEMA = """
CREATE TABLE IF NOT EXISTS materials (
    path TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    media_type TEXT NOT NULL,
    duration REAL DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    fps REAL DEFAULT 0,
    orientation TEXT DEFAULT 'unknown',
    tags TEXT DEFAULT '',
    license TEXT,
    source TEXT,
    brightness REAL,
    indexed_at TEXT NOT NULL
);
"""


def connect(db_path: str) -> sqlite3.Connection:
    """Open (creating if needed) the library database and ensure the schema."""
    if db_path != ":memory:":
        parent = os.path.dirname(os.path.abspath(db_path))
        if parent:
            os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute(_SCHEMA)
    conn.commit()
    return conn


def _row_to_entry(row: sqlite3.Row) -> LibraryEntry:
    tags = [t for t in (row["tags"] or "").split(",") if t]
    return LibraryEntry(
        path=row["path"],
        hash=row["hash"],
        media_type=row["media_type"],
        duration=row["duration"] or 0.0,
        width=row["width"] or 0,
        height=row["height"] or 0,
        fps=row["fps"] or 0.0,
        orientation=row["orientation"] or "unknown",
        tags=tags,
        license=row["license"],
        source=row["source"],
        brightness=row["brightness"],
        indexed_at=row["indexed_at"],
    )


def upsert_entry(conn: sqlite3.Connection, entry: LibraryEntry) -> None:
    conn.execute(
        """
        INSERT INTO materials
            (path, hash, media_type, duration, width, height, fps,
             orientation, tags, license, source, brightness, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(path) DO UPDATE SET
            hash=excluded.hash,
            media_type=excluded.media_type,
            duration=excluded.duration,
            width=excluded.width,
            height=excluded.height,
            fps=excluded.fps,
            orientation=excluded.orientation,
            tags=excluded.tags,
            license=excluded.license,
            source=excluded.source,
            brightness=excluded.brightness,
            indexed_at=excluded.indexed_at
        """,
        (
            entry.path,
            entry.hash,
            entry.media_type,
            entry.duration,
            entry.width,
            entry.height,
            entry.fps,
            entry.orientation,
            ",".join(entry.tags),
            entry.license,
            entry.source,
            entry.brightness,
            entry.indexed_at,
        ),
    )
    conn.commit()


def get_entry(conn: sqlite3.Connection, path: str) -> Optional[LibraryEntry]:
    row = conn.execute("SELECT * FROM materials WHERE path = ?", (path,)).fetchone()
    return _row_to_entry(row) if row else None


def all_entries(conn: sqlite3.Connection) -> List[LibraryEntry]:
    rows = conn.execute("SELECT * FROM materials ORDER BY path").fetchall()
    return [_row_to_entry(r) for r in rows]


def count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM materials").fetchone()[0]


def query_entries(
    conn: sqlite3.Connection,
    media_type: Optional[str] = None,
    orientation: Optional[str] = None,
    tag: Optional[str] = None,
) -> List[LibraryEntry]:
    clauses = []
    args: list = []
    if media_type:
        clauses.append("media_type = ?")
        args.append(media_type)
    if orientation:
        clauses.append("orientation = ?")
        args.append(orientation)
    if tag:
        # tags stored comma-separated; match a whole tag token
        clauses.append("(',' || tags || ',') LIKE ?")
        args.append(f"%,{tag},%")
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = conn.execute(
        f"SELECT * FROM materials{where} ORDER BY path", args
    ).fetchall()
    return [_row_to_entry(r) for r in rows]


def remove_entry(conn: sqlite3.Connection, path: str) -> bool:
    """Remove the database row only. Never touches the file on disk."""
    cur = conn.execute("DELETE FROM materials WHERE path = ?", (path,))
    conn.commit()
    return cur.rowcount > 0


def iter_media_files(directory: str):
    """Yield ``(path, media_type)`` for recognised media files under directory."""
    for root, _dirs, files in os.walk(directory):
        for name in sorted(files):
            full = os.path.join(root, name)
            media_type = media_type_for(full)
            if media_type:
                yield full, media_type


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def index_directory(
    conn: sqlite3.Connection,
    directory: str,
    prober=None,
    source: Optional[str] = None,
    license: Optional[str] = None,
    tags: Optional[List[str]] = None,
    reindex: bool = False,
) -> dict:
    """Scan ``directory`` and upsert media metadata.

    Files whose content hash is unchanged are skipped without re-probing
    (unless ``reindex=True``). ``prober(path) -> dict`` returns
    ``duration/width/height/fps`` (and optionally ``brightness``); it defaults
    to :func:`probe_media_file`. Never moves or deletes media.
    """
    if prober is None:
        prober = probe_media_file
    stats = {"scanned": 0, "added": 0, "updated": 0, "skipped": 0}
    tags = tags or []

    for path, media_type in iter_media_files(directory):
        stats["scanned"] += 1
        try:
            file_hash = compute_file_hash(path)
        except OSError:
            continue

        existing = get_entry(conn, path)
        if existing and existing.hash == file_hash and not reindex:
            stats["skipped"] += 1
            continue

        try:
            meta = prober(path) or {}
        except Exception:
            # A single unreadable file must not abort the whole index run.
            continue

        width = int(meta.get("width", 0) or 0)
        height = int(meta.get("height", 0) or 0)
        entry = LibraryEntry(
            path=path,
            hash=file_hash,
            media_type=media_type,
            duration=float(meta.get("duration", 0) or 0),
            width=width,
            height=height,
            fps=float(meta.get("fps", 0) or 0),
            orientation=orientation_of(width, height),
            tags=list(tags),
            license=license,
            source=source,
            brightness=meta.get("brightness"),
            indexed_at=_now_iso(),
        )
        upsert_entry(conn, entry)
        if existing:
            stats["updated"] += 1
        else:
            stats["added"] += 1

    return stats


def select_pipeline_entries(
    conn: sqlite3.Connection,
    settings,
    context,
    limit: int,
) -> List[LibraryEntry]:
    """Return up to ``limit`` ranked local **video** :class:`LibraryEntry`.

    Builds :class:`material_ranker.MaterialCandidate` objects (``is_local=True``,
    carrying stored ``brightness``) and ranks them with the deterministic ranker,
    so local assets benefit from the same quality scoring as stock clips.
    """
    from app.services.quality import material_ranker

    entries = query_entries(conn, media_type="video")
    if not entries:
        return []
    by_path = {e.path: e for e in entries}

    candidates = []
    for entry in entries:
        # Use the first tag as the diversity "query" bucket, falling back to a
        # constant so unlabelled local clips still rank.
        query = entry.tags[0] if entry.tags else "local"
        candidates.append(
            material_ranker.MaterialCandidate(
                key=entry.path,
                provider="local",
                query=query,
                duration=entry.duration,
                width=entry.width,
                height=entry.height,
                fps=entry.fps,
                is_local=True,
                license=entry.license,
                brightness=entry.brightness,
            )
        )

    ranked = material_ranker.rank_candidates(candidates, settings, context)
    ordered = [by_path[c.key] for c in ranked if c.key in by_path]
    if limit and limit > 0:
        ordered = ordered[:limit]
    return ordered


def select_pipeline_materials(
    conn: sqlite3.Connection,
    settings,
    context,
    limit: int,
    search_terms: Optional[List[str]] = None,
) -> List[str]:
    """Ranked local video paths for the pipeline (see :func:`select_pipeline_entries`)."""
    return [e.path for e in select_pipeline_entries(conn, settings, context, limit)]


def useful_duration(entries, max_clip_duration) -> float:
    """Total usable seconds from entries, capping each clip at the clip length.

    Mirrors how ``combine_videos`` consumes at most ``max_clip_duration`` of each
    clip, so callers can tell whether the local library already covers the audio.
    """
    cap = float(max_clip_duration)
    return float(sum(min(cap, float(e.duration or 0.0)) for e in entries))


def probe_media_file(path: str) -> dict:
    """Runtime media probe using MoviePy/FFmpeg.

    Imported lazily so the rest of this module stays dependency-free for tests
    and minimal environments. Returns ``duration/width/height/fps``; on failure
    returns zeros so the caller can still index the file path.
    """
    media_type = media_type_for(path)
    try:
        if media_type == "image":
            from PIL import Image

            with Image.open(path) as image:
                width, height = image.size
            return {"duration": 0.0, "width": int(width), "height": int(height), "fps": 0.0}

        from moviepy import VideoFileClip

        clip = VideoFileClip(path)
        try:
            width, height = clip.size
            return {
                "duration": float(clip.duration or 0.0),
                "width": int(width),
                "height": int(height),
                "fps": float(getattr(clip, "fps", 0) or 0.0),
            }
        finally:
            clip.close()
    except Exception:
        return {"duration": 0.0, "width": 0, "height": 0, "fps": 0.0}
