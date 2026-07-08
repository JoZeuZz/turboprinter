from __future__ import annotations

from app.application.services.project_lifecycle import create_project
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


def test_create_project_saves_script_and_metadata(tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))

    project_id = create_project(store, topic="cats", script="Uno. Dos.", workspace_id="ws-1")

    assert project_id
    assert store.load_script(project_id) == "Uno. Dos."
    metadata = store.load_project_metadata(project_id)
    assert metadata["topic"] == "cats"
    assert metadata["workspace_id"] == "ws-1"


def test_create_project_defaults_empty_script():
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        store = FilesystemProjectStore(base_tasks_dir=tmp)
        project_id = create_project(store, topic="dogs")
        assert store.load_script(project_id) == ""
