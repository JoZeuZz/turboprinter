from __future__ import annotations

import pytest

from app.domain.workspaces.models import Workspace
from app.infrastructure.storage.workspace_store import WorkspaceStore


@pytest.fixture
def store(tmp_path):
    return WorkspaceStore(base_dir=str(tmp_path))


def test_save_and_load_round_trip(store):
    ws = Workspace(name="Canal Curiosidades")
    store.save(ws)
    loaded = store.load(ws.id)
    assert loaded == ws


def test_load_missing_returns_none(store):
    assert store.load("does-not-exist") is None


def test_exists(store):
    ws = Workspace(name="Misterio Shorts")
    assert store.exists(ws.id) is False
    store.save(ws)
    assert store.exists(ws.id) is True


def test_list_returns_all_sorted_by_updated_at_desc(store):
    import time

    older = Workspace(name="Older")
    store.save(older)
    time.sleep(0.01)
    newer = Workspace(name="Newer")
    store.save(newer)

    result = store.list()
    assert [w.id for w in result] == [newer.id, older.id]


def test_list_empty_when_no_workspaces(store):
    assert store.list() == []


def test_delete_existing_returns_true(store):
    ws = Workspace(name="To Delete")
    store.save(ws)
    assert store.delete(ws.id) is True
    assert store.load(ws.id) is None


def test_delete_missing_returns_false(store):
    assert store.delete("does-not-exist") is False


def test_save_overwrites_existing(store):
    ws = Workspace(name="Original")
    store.save(ws)
    ws.name = "Renamed"
    store.save(ws)
    assert store.load(ws.id).name == "Renamed"
    assert len(store.list()) == 1


def test_list_skips_corrupted_entries(store, tmp_path):
    ws = Workspace(name="Valid Workspace")
    store.save(ws)

    corrupted_path = tmp_path / "corrupted.json"
    corrupted_path.write_text("{not valid json", encoding="utf-8")

    result = store.list()

    assert [w.id for w in result] == [ws.id]
