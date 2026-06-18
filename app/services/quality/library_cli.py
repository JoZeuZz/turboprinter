"""CLI for the local material library (Personal Quality Stack, Fase 6).

Headless tool to index/list/inspect the user's local media library so it can be
used as a prioritized source in the pipeline. Runs without the WebUI.

Usage:
    python -m app.services.quality.library_cli index /path/to/media \\
        --source user --license CC0 --tags nature,demo
    python -m app.services.quality.library_cli list
    python -m app.services.quality.library_cli stats
    python -m app.services.quality.library_cli remove /path/to/media/clip.mp4

By default the database lives at ``storage/local_library/library.db``; override
with ``--db``. Indexing never moves or deletes media; ``remove`` only deletes
the database row.
"""

import argparse
import os
from typing import Optional, Sequence

from app.services.quality import local_library


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mpt-library",
        description="Index and manage the local material library.",
    )
    parser.add_argument(
        "--db",
        default=None,
        help="path to the library SQLite db (default: storage/local_library/library.db)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_index = sub.add_parser("index", help="scan a directory and index media")
    p_index.add_argument("directory", help="directory to scan recursively")
    p_index.add_argument("--source", default=None, help="optional source label")
    p_index.add_argument("--license", default=None, help="optional license label")
    p_index.add_argument(
        "--tags", default="", help="optional comma-separated tags applied to all files"
    )
    p_index.add_argument(
        "--reindex",
        action="store_true",
        help="re-probe files even if their content hash is unchanged",
    )

    sub.add_parser("list", help="list indexed entries")
    sub.add_parser("stats", help="show library counts")

    p_remove = sub.add_parser("remove", help="remove an entry (row only, not the file)")
    p_remove.add_argument("path", help="indexed path to remove")

    return parser


def _default_db_path() -> str:
    from app.utils import utils

    return os.path.join(utils.storage_dir("local_library", create=True), "library.db")


def _run(args, conn, prober) -> int:
    if args.command == "index":
        tags = [t.strip() for t in (args.tags or "").split(",") if t.strip()]
        stats = local_library.index_directory(
            conn,
            args.directory,
            prober=prober,
            source=args.source,
            license=args.license,
            tags=tags,
            reindex=args.reindex,
        )
        print(
            "indexed: "
            f"scanned={stats['scanned']} added={stats['added']} "
            f"updated={stats['updated']} skipped={stats['skipped']}"
        )
        return 0

    if args.command == "list":
        for entry in local_library.all_entries(conn):
            print(
                f"{entry.path}\t{entry.media_type}\t{entry.width}x{entry.height}\t"
                f"{entry.orientation}\t{entry.duration:.1f}s\t{','.join(entry.tags)}"
            )
        return 0

    if args.command == "stats":
        entries = local_library.all_entries(conn)
        videos = sum(1 for e in entries if e.media_type == "video")
        images = sum(1 for e in entries if e.media_type == "image")
        print(f"total={len(entries)} videos={videos} images={images}")
        return 0

    if args.command == "remove":
        removed = local_library.remove_entry(conn, args.path)
        print("removed" if removed else "not found")
        return 0 if removed else 1

    return 2


def main(argv: Optional[Sequence[str]] = None, conn=None, prober=None) -> int:
    args = build_parser().parse_args(argv)

    own_conn = conn is None
    if own_conn:
        db_path = args.db or _default_db_path()
        conn = local_library.connect(db_path)
    try:
        return _run(args, conn, prober)
    finally:
        if own_conn:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
