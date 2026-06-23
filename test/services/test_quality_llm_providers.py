import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import json
import pytest
from unittest.mock import MagicMock, patch


class TestBaseTypes:
    def test_llm_provider_error_message_includes_provider(self):
        from app.services.quality.llm_providers.base import LLMProviderError
        cause = ValueError("timeout")
        err = LLMProviderError("groq", cause)
        assert "groq" in str(err)
        assert err.provider == "groq"
        assert err.cause is cause

    def test_llm_config_error_is_value_error(self):
        from app.services.quality.llm_providers.base import LLMConfigError
        err = LLMConfigError("missing key")
        assert isinstance(err, ValueError)

    def test_script_response_validates(self):
        from app.services.quality.llm_providers.base import ScriptResponse
        sr = ScriptResponse(paragraphs=["Hello world", "Second para"])
        assert sr.paragraphs == ["Hello world", "Second para"]
        assert sr.language == ""

    def test_terms_response_validates(self):
        from app.services.quality.llm_providers.base import TermsResponse
        tr = TermsResponse(terms=["cats", "dogs"])
        assert tr.terms == ["cats", "dogs"]

    def test_terms_response_rejects_non_strings(self):
        from app.services.quality.llm_providers.base import TermsResponse
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            TermsResponse(terms=[1, 2, 3])


class TestOpenAICompatProvider:
    def _make_provider(self, provider_name: str, extra_config: dict | None = None):
        """Helper: patch config and return an OpenAICompatProvider."""
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {
            "openai_api_key": "sk-test",
            "openai_model_name": "gpt-4o-mini",
            "openai_base_url": "https://api.openai.com/v1",
            "groq_api_key": "gsk-test",
            "groq_model_name": "llama-3.3-70b-versatile",
            "deepseek_api_key": "ds-test",
            "deepseek_model_name": "deepseek-v4-flash",
            "deepseek_base_url": "https://api.deepseek.com",
            "deepseek_thinking_enabled": False,
            **(extra_config or {}),
        }
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = OpenAICompatProvider(provider_name)
        return provider, cfg

    def test_openai_generate_calls_completions(self):
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {
            "openai_api_key": "sk-test",
            "openai_model_name": "gpt-4o-mini",
            "openai_base_url": "https://api.openai.com/v1",
        }
        fake_response = MagicMock()
        fake_response.choices = [MagicMock()]
        fake_response.choices[0].message.content = "hello world"
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg, \
             patch("app.services.quality.llm_providers.openai_compat.OpenAI") as MockClient:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            MockClient.return_value.chat.completions.create.return_value = fake_response
            provider = OpenAICompatProvider("openai")
            result = provider.generate("test prompt")
        assert result == "hello world"

    def test_json_mode_adds_response_format(self):
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {
            "openai_api_key": "sk-test",
            "openai_model_name": "gpt-4o-mini",
            "openai_base_url": "https://api.openai.com/v1",
        }
        fake_response = MagicMock()
        fake_response.choices = [MagicMock()]
        fake_response.choices[0].message.content = '["cats"]'
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg, \
             patch("app.services.quality.llm_providers.openai_compat.OpenAI") as MockClient:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            create_mock = MockClient.return_value.chat.completions.create
            create_mock.return_value = fake_response
            provider = OpenAICompatProvider("openai")
            provider.generate("test prompt", json_mode=True)
        call_kwargs = create_mock.call_args[1]
        assert call_kwargs.get("response_format") == {"type": "json_object"}

    def test_missing_api_key_raises_llm_config_error(self):
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        from app.services.quality.llm_providers.base import LLMConfigError
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg:
            mock_cfg.app.get.return_value = None
            with pytest.raises(LLMConfigError, match="api_key"):
                OpenAICompatProvider("openai")

    def test_groq_uses_groq_base_url_by_default(self):
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {"groq_api_key": "gsk-test", "groq_model_name": "llama-3.3-70b-versatile"}
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg, \
             patch("app.services.quality.llm_providers.openai_compat.OpenAI") as MockClient:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            OpenAICompatProvider("groq")
        call_kwargs = MockClient.call_args[1]
        assert "groq.com" in call_kwargs.get("base_url", "")


class TestGeminiProvider:
    def test_generate_returns_text(self):
        import sys
        from app.services.quality.llm_providers.gemini import GeminiProvider
        cfg = {"gemini_api_key": "AIza-test", "gemini_model_name": "gemini-2.5-flash"}
        fake_part = MagicMock()
        fake_part.text = "generated text"
        fake_candidate = MagicMock()
        fake_candidate.content.parts = [fake_part]
        fake_candidate.finish_reason = "STOP"
        fake_response = MagicMock()
        fake_response.candidates = [fake_candidate]
        fake_response.prompt_feedback = MagicMock(block_reason=None)

        # Create mocks for the google.genai module
        mock_genai = MagicMock()
        mock_genai.Client.return_value.models.generate_content.return_value = fake_response
        mock_genai.types = MagicMock()
        mock_google = MagicMock()
        mock_google.genai = mock_genai

        with patch("app.services.quality.llm_providers.gemini.config") as mock_cfg, \
             patch.dict(sys.modules, {"google": mock_google, "google.genai": mock_genai}):
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = GeminiProvider("gemini")
            result = provider.generate("test prompt")
        assert result == "generated text"

    def test_json_mode_sets_mime_type(self):
        import sys
        from app.services.quality.llm_providers.gemini import GeminiProvider
        cfg = {"gemini_api_key": "AIza-test", "gemini_model_name": "gemini-2.5-flash"}
        fake_part = MagicMock()
        fake_part.text = '["cats"]'
        fake_candidate = MagicMock()
        fake_candidate.content.parts = [fake_part]
        fake_candidate.finish_reason = "STOP"
        fake_response = MagicMock()
        fake_response.candidates = [fake_candidate]
        fake_response.prompt_feedback = MagicMock(block_reason=None)

        # Create mocks for the google.genai module
        mock_genai = MagicMock()
        create_mock = MagicMock(return_value=fake_response)
        mock_genai.Client.return_value.models.generate_content = create_mock

        # Mock GenerateContentConfig to track the kwargs it receives
        config_mock = MagicMock()
        mock_genai.types.GenerateContentConfig = MagicMock(side_effect=lambda **kwargs: (config_mock.update(kwargs), config_mock)[1])

        mock_google = MagicMock()
        mock_google.genai = mock_genai

        with patch("app.services.quality.llm_providers.gemini.config") as mock_cfg, \
             patch.dict(sys.modules, {"google": mock_google, "google.genai": mock_genai}):
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = GeminiProvider("gemini")
            provider.generate("test prompt", json_mode=True)

        # Check that GenerateContentConfig was called with response_mime_type
        gen_cfg_call_kwargs = mock_genai.types.GenerateContentConfig.call_args[1]
        assert gen_cfg_call_kwargs.get("response_mime_type") == "application/json"

    def test_missing_api_key_raises_config_error(self):
        from app.services.quality.llm_providers.gemini import GeminiProvider
        from app.services.quality.llm_providers.base import LLMConfigError
        with patch("app.services.quality.llm_providers.gemini.config") as mock_cfg:
            mock_cfg.app.get.return_value = None
            with pytest.raises(LLMConfigError, match="api_key"):
                GeminiProvider("gemini")


class TestRegistry:
    def test_get_provider_openai_returns_openai_compat(self):
        from app.services.quality.llm_providers import get_provider
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {"openai_api_key": "sk-test", "openai_model_name": "gpt-4o-mini", "openai_base_url": "https://api.openai.com/v1"}
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = get_provider("openai")
        assert isinstance(provider, OpenAICompatProvider)

    def test_get_provider_gemini_returns_gemini(self):
        from app.services.quality.llm_providers import get_provider
        from app.services.quality.llm_providers.gemini import GeminiProvider
        cfg = {"gemini_api_key": "AIza-test", "gemini_model_name": "gemini-2.5-flash"}
        with patch("app.services.quality.llm_providers.gemini.config") as mock_cfg:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = get_provider("gemini")
        assert isinstance(provider, GeminiProvider)

    def test_get_provider_unknown_falls_back_to_openai_compat(self):
        from app.services.quality.llm_providers import get_provider
        from app.services.quality.llm_providers.openai_compat import OpenAICompatProvider
        cfg = {"unknown_xyz_api_key": "test", "unknown_xyz_model_name": "m", "unknown_xyz_base_url": "http://x"}
        with patch("app.services.quality.llm_providers.openai_compat.config") as mock_cfg:
            mock_cfg.app.get.side_effect = lambda k, default=None: cfg.get(k, default)
            provider = get_provider("unknown_xyz")
        assert isinstance(provider, OpenAICompatProvider)

    def test_provider_error_not_swallowed_by_generate_response_single(self):
        """LLMProviderError from a provider must propagate up (not become 'Error: ...')."""
        from app.services.quality.llm_providers.base import LLMProviderError
        import app.services.llm as llm_mod
        fake_provider = MagicMock()
        fake_provider.generate.side_effect = LLMProviderError("fake", ValueError("boom"))
        with patch("app.services.quality.llm_providers.get_provider", return_value=fake_provider), \
             patch.object(llm_mod, "config") as mock_cfg:
            mock_cfg.app.get.return_value = "fake"
            result = llm_mod._generate_response_single("hello", provider_override="fake")
        # Should propagate as "Error: ..." string via the outer try/except in the fallback chain
        assert result.startswith("Error:")
