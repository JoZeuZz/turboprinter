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
