import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.asgi import _resolve_cors_config


class TestResolveCorsConfig(unittest.TestCase):
    def test_empty_string_returns_wildcard_no_credentials(self):
        origins, allow_credentials = _resolve_cors_config("")
        self.assertEqual(origins, ["*"])
        self.assertFalse(allow_credentials)

    def test_single_origin_returns_list_with_credentials(self):
        origins, allow_credentials = _resolve_cors_config("https://video.example.org")
        self.assertEqual(origins, ["https://video.example.org"])
        self.assertTrue(allow_credentials)

    def test_multiple_origins_with_spaces_are_stripped(self):
        origins, allow_credentials = _resolve_cors_config("https://a.org, https://b.org")
        self.assertEqual(origins, ["https://a.org", "https://b.org"])
        self.assertTrue(allow_credentials)

    def test_only_commas_and_spaces_falls_back_to_wildcard(self):
        origins, allow_credentials = _resolve_cors_config(" , ")
        self.assertEqual(origins, ["*"])
        self.assertFalse(allow_credentials)

    def test_explicit_wildcard_string_returns_wildcard_no_credentials(self):
        """CORS_ALLOWED_ORIGINS="*" must NOT enable credentials."""
        origins, allow_credentials = _resolve_cors_config("*")
        self.assertEqual(origins, ["*"])
        self.assertFalse(allow_credentials)

    def test_wildcard_mixed_with_real_origins_disables_credentials(self):
        """A list containing '*' is treated as wildcard (safety first)."""
        origins, allow_credentials = _resolve_cors_config("https://a.org,*")
        self.assertEqual(origins, ["*"])
        self.assertFalse(allow_credentials)


if __name__ == "__main__":
    unittest.main()
