import importlib
import os


def test_project_mode_default_false(monkeypatch):
    monkeypatch.delenv("TURBOPRINTER_PROJECT_MODE_ENABLED", raising=False)
    from app.config import config

    importlib.reload(config)
    assert config.project_mode_enabled is False


def test_project_mode_enabled_via_env(monkeypatch):
    monkeypatch.setenv("TURBOPRINTER_PROJECT_MODE_ENABLED", "true")
    from app.config import config

    importlib.reload(config)
    assert config.project_mode_enabled is True
    # restore default for other tests
    monkeypatch.delenv("TURBOPRINTER_PROJECT_MODE_ENABLED", raising=False)
    importlib.reload(config)
