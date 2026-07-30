"""Unit tests for the local material library CLI (Fase 6).

The CLI accepts an injected connection + prober so it runs without touching real
storage or needing ffprobe/moviepy.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import library_cli
from app.services.quality import local_library as lib


def _fake_prober(path):
    return {"duration": 6.0, "width": 1080, "height": 1920, "fps": 30.0}


def _write(path, content=b"data"):
    with open(path, "wb") as f:
        f.write(content)


class TestLibraryCli(unittest.TestCase):
    def setUp(self):
        self.conn = lib.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_index_command_populates_library(self):
        with tempfile.TemporaryDirectory() as d:
            _write(os.path.join(d, "a.mp4"))
            _write(os.path.join(d, "b.mp4"))
            rc = library_cli.main(
                ["index", d, "--source", "user", "--tags", "nature,demo"],
                conn=self.conn,
                prober=_fake_prober,
            )
            self.assertEqual(rc, 0)
            self.assertEqual(lib.count(self.conn), 2)
            entry = lib.all_entries(self.conn)[0]
            self.assertEqual(entry.source, "user")
            self.assertIn("nature", entry.tags)

    def test_stats_and_list_commands_succeed(self):
        with tempfile.TemporaryDirectory() as d:
            _write(os.path.join(d, "a.mp4"))
            library_cli.main(["index", d], conn=self.conn, prober=_fake_prober)
            self.assertEqual(library_cli.main(["stats"], conn=self.conn), 0)
            self.assertEqual(library_cli.main(["list"], conn=self.conn), 0)

    def test_remove_command_returns_nonzero_for_missing(self):
        self.assertEqual(
            library_cli.main(["remove", "/nope.mp4"], conn=self.conn), 1
        )

    def test_missing_command_errors(self):
        with self.assertRaises(SystemExit):
            library_cli.main([], conn=self.conn)


if __name__ == "__main__":
    unittest.main()
