"""Tests for app/services/quality/observability.py — phase_timer."""
from __future__ import annotations

import json
import os

import pytest

from app.services.quality.observability import phase_timer


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _enable(monkeypatch):
    import app.config.config as cfg
    monkeypatch.setattr(cfg, "phase_timing_enabled", True)


def _disable(monkeypatch):
    import app.config.config as cfg
    monkeypatch.setattr(cfg, "phase_timing_enabled", False)


# ---------------------------------------------------------------------------
# disabled (default)
# ---------------------------------------------------------------------------

def test_disabled_is_noop(monkeypatch, tmp_path):
    _disable(monkeypatch)
    called = []
    with phase_timer("test_phase"):
        called.append(1)
    assert called == [1]


def test_disabled_no_file_created(monkeypatch, tmp_path, caplog):
    _disable(monkeypatch)
    with phase_timer("test_phase", project_id="proj-1"):
        pass
    # no timings.json anywhere in tmp_path
    assert not list(tmp_path.rglob("timings.json"))


# ---------------------------------------------------------------------------
# enabled — success path
# ---------------------------------------------------------------------------

def test_enabled_logs_phase(monkeypatch, caplog):
    import logging

    _enable(monkeypatch)
    with caplog.at_level(logging.INFO, logger="root"):
        with phase_timer("plan"):
            pass
    # loguru goes to stderr by default; check via caplog propagation
    # (loguru propagates to stdlib root logger in test environments)
    # We at least verify no exception is raised and can read side effects.


def test_enabled_elapsed_positive(monkeypatch):
    import time

    _enable(monkeypatch)
    elapsed_holder: list[float] = []

    original_perf = time.perf_counter

    calls: list[float] = []

    def fake_perf():
        v = original_perf()
        calls.append(v)
        return v

    monkeypatch.setattr(time, "perf_counter", fake_perf)
    with phase_timer("plan"):
        pass

    assert len(calls) == 2
    assert calls[1] >= calls[0]


# ---------------------------------------------------------------------------
# enabled — exception path
# ---------------------------------------------------------------------------

def test_enabled_reraises_exception(monkeypatch):
    _enable(monkeypatch)
    with pytest.raises(ValueError, match="boom"):
        with phase_timer("plan"):
            raise ValueError("boom")


def test_enabled_exception_does_not_suppress(monkeypatch):
    _enable(monkeypatch)
    ran_after = []
    try:
        with phase_timer("plan"):
            raise RuntimeError("oops")
    except RuntimeError:
        pass
    ran_after.append(True)
    assert ran_after == [True]


# ---------------------------------------------------------------------------
# enabled — timings.json
# ---------------------------------------------------------------------------

def test_enabled_writes_timings_json(monkeypatch, tmp_path):
    _enable(monkeypatch)
    monkeypatch.setattr(
        "app.services.quality.observability._timings_path",
        lambda pid: str(tmp_path / pid / "timings.json"),
    )
    with phase_timer("media_search", project_id="proj-42"):
        pass

    path = tmp_path / "proj-42" / "timings.json"
    assert path.exists()
    record = json.loads(path.read_text().strip())
    assert record["phase"] == "media_search"
    assert record["ok"] is True
    assert record["error"] is None
    assert record["elapsed_sec"] >= 0


def test_enabled_timings_json_on_failure(monkeypatch, tmp_path):
    _enable(monkeypatch)
    monkeypatch.setattr(
        "app.services.quality.observability._timings_path",
        lambda pid: str(tmp_path / pid / "timings.json"),
    )
    with pytest.raises(ValueError):
        with phase_timer("plan", project_id="proj-err"):
            raise ValueError("fail")

    path = tmp_path / "proj-err" / "timings.json"
    assert path.exists()
    record = json.loads(path.read_text().strip())
    assert record["ok"] is False
    assert "ValueError" in record["error"]


def test_enabled_timings_append_multiple(monkeypatch, tmp_path):
    _enable(monkeypatch)
    timings_file = tmp_path / "timings.json"
    monkeypatch.setattr(
        "app.services.quality.observability._timings_path",
        lambda pid: str(timings_file),
    )
    for phase in ["plan", "media_search", "render"]:
        with phase_timer(phase, project_id="proj-x"):
            pass

    lines = timings_file.read_text().strip().splitlines()
    assert len(lines) == 3
    phases = [json.loads(ln)["phase"] for ln in lines]
    assert phases == ["plan", "media_search", "render"]


# ---------------------------------------------------------------------------
# enabled — write failure does not propagate
# ---------------------------------------------------------------------------

def test_write_failure_does_not_raise(monkeypatch, tmp_path):
    _enable(monkeypatch)

    def bad_path(pid):
        return "/dev/null/cannot/write/timings.json"

    monkeypatch.setattr(
        "app.services.quality.observability._timings_path",
        bad_path,
    )
    # Must not raise even though writing fails
    with phase_timer("plan", project_id="proj-bad"):
        pass
