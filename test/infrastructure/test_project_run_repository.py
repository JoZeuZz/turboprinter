from __future__ import annotations

from app.infrastructure.database.repositories.project_runs import ProjectRunRepository


def test_create_and_get_by_project_id():
    repo = ProjectRunRepository()

    created = repo.create(project_id="proj-1", task_id="proj-1", source="topic", topic="cats")

    fetched = repo.get_by_project_id("proj-1")
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.status == "created"


def test_get_by_project_id_returns_none_when_missing():
    repo = ProjectRunRepository()
    assert repo.get_by_project_id("does-not-exist") is None


def test_list_all():
    repo = ProjectRunRepository()
    repo.create(project_id="a", task_id="a", source="topic")
    repo.create(project_id="b", task_id="b", source="script")

    assert len(repo.list()) == 2
