import importlib
import os


def test_project_mode_default_false(monkeypatch):
    monkeypatch.setenv("TURBOPRINTER_PROJECT_MODE_ENABLED", "false")
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


def test_project_mode_bool_reads_config_when_env_missing(monkeypatch):
    monkeypatch.delenv("TURBOPRINTER_PROJECT_MODE_ENABLED", raising=False)
    from app.config import config

    assert config._env_bool_or_config(
        "TURBOPRINTER_PROJECT_MODE_ENABLED", True
    ) is True


def test_project_mode_string_env_overrides_config(monkeypatch):
    monkeypatch.setenv("TURBOPRINTER_TIMELINE_RENDERER", "opencut")
    from app.config import config

    assert config._env_str_or_config(
        "TURBOPRINTER_TIMELINE_RENDERER", "moviepy", "moviepy"
    ) == "opencut"


def test_vision_ranking_disabled_by_default(monkeypatch):
    monkeypatch.delenv("TURBOPRINTER_VISION_RANKING_ENABLED", raising=False)
    import importlib
    from app.config import config
    importlib.reload(config)
    assert config.vision_ranking_enabled is False


def test_vision_ranking_enabled_via_env(monkeypatch):
    import importlib
    monkeypatch.setenv("TURBOPRINTER_VISION_RANKING_ENABLED", "true")
    from app.config import config
    importlib.reload(config)
    assert config.vision_ranking_enabled is True
    monkeypatch.delenv("TURBOPRINTER_VISION_RANKING_ENABLED", raising=False)
    importlib.reload(config)


def test_vision_top_n_default():
    from app.config import config
    assert config.vision_top_n == 3
