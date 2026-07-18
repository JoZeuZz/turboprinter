import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.controllers.v1.video import _parse_range_header

VIDEO_SIZE = 1000


class TestParseRangeHeaderNoHeader(unittest.TestCase):
    def test_none_header_returns_none(self):
        result = _parse_range_header(None, VIDEO_SIZE)
        self.assertIsNone(result)


class TestParseRangeHeaderFullRange(unittest.TestCase):
    def test_explicit_start_end(self):
        result = _parse_range_header("bytes=0-499", VIDEO_SIZE)
        self.assertEqual(result, (0, 499))


class TestParseRangeHeaderOpenEnd(unittest.TestCase):
    def test_start_to_end_of_file(self):
        result = _parse_range_header("bytes=500-", VIDEO_SIZE)
        self.assertEqual(result, (500, 999))


class TestParseRangeHeaderSuffix(unittest.TestCase):
    def test_suffix_form(self):
        result = _parse_range_header("bytes=-200", VIDEO_SIZE)
        self.assertEqual(result, (800, 999))


class TestParseRangeHeaderClampEnd(unittest.TestCase):
    def test_end_exceeds_file_size_is_clamped(self):
        result = _parse_range_header("bytes=0-5000", VIDEO_SIZE)
        self.assertEqual(result, (0, 999))


class TestParseRangeHeaderBadUnit(unittest.TestCase):
    def test_non_bytes_unit_raises(self):
        with self.assertRaises(ValueError):
            _parse_range_header("items=0-10", VIDEO_SIZE)


class TestParseRangeHeaderNonNumeric(unittest.TestCase):
    def test_non_numeric_parts_raise(self):
        with self.assertRaises(ValueError):
            _parse_range_header("bytes=abc-def", VIDEO_SIZE)


class TestParseRangeHeaderStartAfterEnd(unittest.TestCase):
    def test_start_greater_than_end_raises(self):
        with self.assertRaises(ValueError):
            _parse_range_header("bytes=900-100", VIDEO_SIZE)


class TestParseRangeHeaderZeroSizeFile(unittest.TestCase):
    def test_any_range_on_empty_file_raises(self):
        with self.assertRaises(ValueError):
            _parse_range_header("bytes=0-0", 0)


if __name__ == "__main__":
    unittest.main()
