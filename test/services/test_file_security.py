import os
import sys
import tempfile
import unittest
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.utils.file_security import build_local_media_filename, resolve_path_within_directory


class TestResolvePathWithinDirectory(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.base = self._tmpdir.name

    def tearDown(self):
        self._tmpdir.cleanup()

    # 1. Empty path raises ValueError
    def test_empty_path_raises(self):
        with self.assertRaisesRegex(ValueError, "empty path is not allowed"):
            resolve_path_within_directory(self.base, "")

    # 2. Valid relative path inside base returns realpath
    def test_valid_relative_path(self):
        filepath = os.path.join(self.base, "ok.txt")
        open(filepath, "w").close()
        result = resolve_path_within_directory(self.base, "ok.txt")
        self.assertEqual(result, os.path.realpath(filepath))

    # 3. Traversal with ../ raises ValueError
    def test_traversal_relative_raises(self):
        parent = os.path.dirname(self.base)
        secret = os.path.join(parent, "secret.txt")
        open(secret, "w").close()
        try:
            with self.assertRaisesRegex(ValueError, "path is outside the allowed directory"):
                resolve_path_within_directory(self.base, "../secret.txt")
        finally:
            os.remove(secret)

    # 4. Absolute path outside base raises ValueError
    def test_absolute_path_outside_raises(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            outside = f.name
        try:
            with self.assertRaisesRegex(ValueError, "path is outside the allowed directory"):
                resolve_path_within_directory(self.base, outside)
        finally:
            os.remove(outside)

    # 5. Non-existent file with require_file=True raises ValueError
    def test_nonexistent_file_raises(self):
        with self.assertRaisesRegex(ValueError, "file does not exist"):
            resolve_path_within_directory(self.base, "nonexistent.txt")

    # 6. require_file=False with non-existent path inside base returns resolved path
    def test_require_file_false_nonexistent_ok(self):
        result = resolve_path_within_directory(self.base, "nuevo.txt", require_file=False)
        expected = os.path.join(os.path.realpath(self.base), "nuevo.txt")
        self.assertEqual(result, expected)

    # 7. Symlink escaping base raises ValueError
    @unittest.skipUnless(hasattr(os, "symlink"), "symlinks not supported on this platform")
    def test_symlink_escaping_base_raises(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            outside = f.name
        link = os.path.join(self.base, "link.txt")
        try:
            try:
                os.symlink(outside, link)
            except OSError as exc:
                if os.name == "nt" and getattr(exc, "winerror", None) == 1314:
                    self.skipTest("Windows symlink privilege is not available")
                raise
            with self.assertRaisesRegex(ValueError, "path is outside the allowed directory"):
                resolve_path_within_directory(self.base, "link.txt")
        finally:
            os.remove(outside)
            if os.path.lexists(link):
                os.remove(link)


class TestBuildLocalMediaFilename(unittest.TestCase):
    def test_builds_short_unique_name_from_subject_and_time(self):
        result = build_local_media_filename(
            "Cómo preparar café en casa",
            "camera clip.MP4",
            "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            2,
            created_at=datetime(2026, 6, 22, 21, 45, 30),
        )

        self.assertEqual(result, "como-preparar-cafe-en-ca-214530-02-a1b2c3.mp4")
        self.assertLessEqual(len(result), 50)

    def test_rejects_unsupported_extension(self):
        with self.assertRaisesRegex(ValueError, "unsupported local media extension"):
            build_local_media_filename(
                "tema",
                "archivo.exe",
                "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                1,
            )

    def test_ignores_directory_components_from_browser_filename(self):
        result = build_local_media_filename(
            "tema",
            "../../otro/video.mov",
            "abcdef12-3456-7890-abcd-ef1234567890",
            1,
            created_at=datetime(2026, 6, 22, 9, 5, 7),
        )

        self.assertEqual(result, "tema-090507-01-abcdef.mov")


if __name__ == "__main__":
    unittest.main()
