import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services import material


class TestGetApiKey(unittest.TestCase):
    def test_missing_key_raises_valueerror(self):
        with patch("app.services.material.config") as mock_cfg:
            mock_cfg.app.get.return_value = None
            mock_cfg.config_file = "/fake/config.toml"
            with self.assertRaises(ValueError) as ctx:
                material.get_api_key("pexels_api_keys")
        self.assertIn("pexels_api_keys", str(ctx.exception))

    def test_missing_key_error_does_not_contain_json_dump(self):
        """Error message must NOT contain serialized config values."""
        with patch("app.services.material.config") as mock_cfg:
            mock_cfg.app.get.return_value = None
            mock_cfg.app = {"pexels_api_keys": [], "pixabay_api_keys": ["SECRET_KEY"]}
            mock_cfg.config_file = "/fake/config.toml"
            with self.assertRaises(ValueError) as ctx:
                material.get_api_key("pexels_api_keys")
        # The error must NOT include values from other config keys
        self.assertNotIn("SECRET_KEY", str(ctx.exception))

    def test_single_string_key_returned_directly(self):
        with patch("app.services.material.config") as mock_cfg:
            mock_cfg.app.get.return_value = "mykey123"
            result = material.get_api_key("pexels_api_keys")
        self.assertEqual(result, "mykey123")

    def test_list_of_keys_rotates(self):
        with patch("app.services.material.config") as mock_cfg:
            mock_cfg.app.get.return_value = ["key1", "key2", "key3"]
            import app.services.material as mat
            mat._api_key_counter = 0
            r1 = material.get_api_key("pexels_api_keys")
            r2 = material.get_api_key("pexels_api_keys")
        self.assertIn(r1, ["key1", "key2", "key3"])
        self.assertNotEqual(r1, r2)


if __name__ == "__main__":
    unittest.main()
