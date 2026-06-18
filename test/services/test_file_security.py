import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.utils.file_security import resolve_path_within_directory


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
            os.symlink(outside, link)
            with self.assertRaisesRegex(ValueError, "path is outside the allowed directory"):
                resolve_path_within_directory(self.base, "link.txt")
        finally:
            os.remove(outside)
            if os.path.lexists(link):
                os.remove(link)


if __name__ == "__main__":
    unittest.main()
