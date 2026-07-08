from __future__ import annotations

import importlib

from app.config import config


def test_jobs_defaults_when_section_absent(monkeypatch):
    monkeypatch.delitem(config._cfg, "jobs", raising=False)
    importlib.reload(config)
    assert config.jobs_enabled is False
    assert config.jobs_poll_interval_sec == 5
    assert config.jobs_default_max_attempts == 3
    importlib.reload(config)  # restore module state for later tests


def test_jobs_env_override(monkeypatch):
    monkeypatch.setenv("TURBOPRINTER_JOBS_ENABLED", "true")
    importlib.reload(config)
    assert config.jobs_enabled is True
    monkeypatch.delenv("TURBOPRINTER_JOBS_ENABLED", raising=False)
    importlib.reload(config)
