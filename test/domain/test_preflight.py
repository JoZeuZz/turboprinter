from __future__ import annotations

from app.domain.projects.preflight import PreflightCheck, PreflightResult


def test_preflight_check_holds_id_severity_and_message():
    check = PreflightCheck(
        id="video_track_exists", passed=False, severity="error",
        message="timeline has no video track with items",
    )
    assert check.id == "video_track_exists"
    assert check.passed is False
    assert check.severity == "error"


def test_preflight_result_defaults_to_empty_lists():
    result = PreflightResult(
        project_id="proj-1", valid=True, summary="ready to render",
    )
    assert result.errors == []
    assert result.warnings == []
    assert result.checks == []


def test_preflight_result_carries_checks_errors_and_warnings():
    checks = [
        PreflightCheck(id="a", passed=False, severity="error", message="bad a"),
        PreflightCheck(id="b", passed=False, severity="warning", message="meh b"),
    ]
    result = PreflightResult(
        project_id="proj-1", valid=False, errors=["bad a"], warnings=["meh b"],
        summary="1 error, 1 warning", checks=checks,
    )
    assert result.valid is False
    assert result.errors == ["bad a"]
    assert result.warnings == ["meh b"]
    assert len(result.checks) == 2
