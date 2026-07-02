"""Tests for FilesystemProjectStore delete/duplicate actions."""
from __future__ import annotations

import json
import os

import pytest

from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def store(tmp_path):
    return FilesystemProjectStore(base_tasks_dir=str(tmp_path))


def _seed_project(store, tmp_path, proj_id="proj-1", topic="Tema origen"):
    store.save_project_metadata(proj_id, topic=topic)
    store.save_script(proj_id, "guion de prueba")
    (tmp_path / proj_id / "render_spec.json").write_text(
        json.dumps({"voice": "es-1", "font": "Roboto"}), encoding="utf-8"
    )
    return proj_id


def test_delete_project_removes_directory(store, tmp_path):
    proj_id = _seed_project(store, tmp_path)
    assert store.exists(proj_id)
    store.delete_project(proj_id)
    assert not store.exists(proj_id)
    assert not (tmp_path / proj_id).exists()


def test_delete_missing_project_is_noop(store):
    store.delete_project("does-not-exist")  # must not raise


def test_duplicate_copies_render_spec_only(store, tmp_path):
    proj_id = _seed_project(store, tmp_path)
    new_id = store.duplicate_video_config(proj_id)

    assert new_id != proj_id
    assert (tmp_path / new_id / "render_spec.json").exists()
    copied = json.loads((tmp_path / new_id / "render_spec.json").read_text())
    assert copied == {"voice": "es-1", "font": "Roboto"}
    # Script must NOT be copied
    assert not (tmp_path / new_id / "script.txt").exists()


def test_duplicate_sets_copia_de_topic(store, tmp_path):
    proj_id = _seed_project(store, tmp_path, topic="Mi video")
    new_id = store.duplicate_video_config(proj_id)
    meta = store.load_project_metadata(new_id)
    assert meta["topic"] == "Copia de Mi video"


def test_duplicate_without_render_spec_still_creates_project(store, tmp_path):
    store.save_project_metadata("bare", topic="Sin spec")
    new_id = store.duplicate_video_config("bare")
    assert store.exists(new_id)
    assert not (tmp_path / new_id / "render_spec.json").exists()
