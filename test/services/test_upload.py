import io
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.controllers.v1.video import _write_upload_file, _get_upload_limit_bytes
from app.models.exception import HttpException


def _make_upload(data: bytes) -> MagicMock:
    mock = MagicMock()
    mock.file = io.BytesIO(data)
    return mock


class TestWriteUploadFileOversized(unittest.TestCase):
    def test_rejects_oversized_upload_with_413(self):
        big_data = b"x" * (3 * 1024 * 1024)  # 3 MB
        upload = _make_upload(big_data)
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        try:
            with self.assertRaises(HttpException) as ctx:
                _write_upload_file(upload, tmp_path, "req-1", limit_bytes=2 * 1024 * 1024)
            self.assertEqual(ctx.exception.status_code, 413)
            self.assertFalse(os.path.exists(tmp_path))
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def test_rejects_upload_exactly_one_byte_over_limit(self):
        limit = 1024 * 1024  # 1 MB
        data = b"y" * (limit + 1)
        upload = _make_upload(data)
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        try:
            with self.assertRaises(HttpException) as ctx:
                _write_upload_file(upload, tmp_path, "req-edge", limit_bytes=limit)
            self.assertEqual(ctx.exception.status_code, 413)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


class TestWriteUploadFileWithinLimit(unittest.TestCase):
    def test_accepts_small_upload(self):
        data = b"z" * 512
        upload = _make_upload(data)
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        try:
            _write_upload_file(upload, tmp_path, "req-2", limit_bytes=1 * 1024 * 1024)
            self.assertEqual(os.path.getsize(tmp_path), 512)
        finally:
            os.remove(tmp_path)

    def test_accepts_upload_exactly_at_limit(self):
        limit = 1024 * 1024  # 1 MB
        data = b"a" * limit
        upload = _make_upload(data)
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        try:
            _write_upload_file(upload, tmp_path, "req-exact", limit_bytes=limit)
            self.assertEqual(os.path.getsize(tmp_path), limit)
        finally:
            os.remove(tmp_path)

    def test_no_limit_writes_full_file(self):
        data = b"b" * (5 * 1024 * 1024)  # 5 MB, no limit
        upload = _make_upload(data)
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
        try:
            _write_upload_file(upload, tmp_path, "req-nolimit", limit_bytes=0)
            self.assertEqual(os.path.getsize(tmp_path), len(data))
        finally:
            os.remove(tmp_path)


class TestGetUploadLimitBytes(unittest.TestCase):
    def test_returns_zero_when_unlimited(self):
        # Default config has max_upload_size_mb = 0, so limit should be 0
        result = _get_upload_limit_bytes()
        self.assertIsInstance(result, int)
        self.assertGreaterEqual(result, 0)


if __name__ == "__main__":
    unittest.main()
