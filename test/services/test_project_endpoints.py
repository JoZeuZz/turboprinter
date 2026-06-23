from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.controllers.v1 import projects as pj


@pytest.fixture
def client(monkeypatch, tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    monkeypatch.setattr(pj.config, "project_mode_enabled", True)
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    monkeypatch.setattr(pj, "_store", lambda: store)
    return TestClient(app)


def test_endpoints_404_when_project_mode_off(monkeypatch):
    monkeypatch.setattr(pj.config, "project_mode_enabled", False)
    c = TestClient(app)
    r = c.post("/api/v1/projects/from-script", json={"script": "Hola.", "language": "es"})
    assert r.status_code == 404


def test_create_from_script_and_get(client):
    r = client.post(
        "/api/v1/projects/from-script",
        json={"script": "Uno. Dos.", "language": "es", "topic": "demo"},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]
    assert project_id

    g = client.get(f"/api/v1/projects/{project_id}")
    assert g.status_code == 200
    data = g.json()["data"]
    assert data["project_id"] == project_id
    assert data["has_script"] is True
    assert data["has_shot_plan"] is False


def test_create_from_topic_generates_script(client, monkeypatch):
    monkeypatch.setattr(pj.llm, "generate_script", lambda **kw: "Guion generado.")
    r = client.post(
        "/api/v1/projects/from-topic",
        json={"topic": "gatos", "language": "es", "generate_script": True},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]
    g = client.get(f"/api/v1/projects/{project_id}")
    assert g.json()["data"]["has_script"] is True


def test_get_unknown_project_404(client):
    assert client.get("/api/v1/projects/ghost").status_code == 404


def test_project_id_validation_rejects_path_segments():
    with pytest.raises(Exception) as exc_info:
        pj._validate_project_id("../other")
    assert getattr(exc_info.value, "message", "") == "invalid project id"


def test_plan_endpoint_runs_shot_planner(client, monkeypatch):
    from app.domain.planning.models import ShotPlan, ShotSegment

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]

    class FakePlanner:
        def plan(self, script, language, target_duration_sec=None, topic=None,
                 visual_style=None, task_id=None):
            plan = ShotPlan(
                task_id=task_id, language=language, script=script,
                segments=[ShotSegment(
                    id="seg_001", order=1, narration_text="Uno.",
                    target_duration_sec=3.0, visual_goal="x", search_queries=["q"],
                )],
            )
            pj._store().save_shot_plan(task_id, plan)
            return plan

    monkeypatch.setattr(pj, "_shot_planner", lambda store: FakePlanner())
    r = client.post(f"/api/v1/projects/{pid}/plan", json={})
    assert r.status_code == 200
    assert r.json()["data"]["segment_count"] == 1
    assert pj._store().load_shot_plan(pid) is not None


def test_plan_endpoint_requires_script(client):
    pid = client.post(
        "/api/v1/projects/from-topic", json={"topic": "x", "language": "es"}
    ).json()["data"]["project_id"]
    # from-topic without generate_script writes an empty script
    assert client.post(f"/api/v1/projects/{pid}/plan", json={}).status_code == 400


def test_media_search_endpoint(client, monkeypatch):
    from app.domain.media.models import MediaCandidate
    from app.domain.planning.models import ShotPlan, ShotSegment

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    plan = ShotPlan(
        task_id=pid, language="es", script="Uno.",
        segments=[ShotSegment(id="seg_001", order=1, narration_text="Uno.",
                              target_duration_sec=3.0, visual_goal="x", search_queries=["q"])],
    )
    pj._store().save_shot_plan(pid, plan)

    class FakeAgg:
        def select_for_plan(self, shot_plan, orientation=None, prefer_local=False, task_id=None):
            sel = {"seg_001": MediaCandidate(id="mc-1", provider="pexels", segment_id="seg_001")}
            pj._store().save_selected_media(task_id, list(sel.values()))
            return sel

    monkeypatch.setattr(pj, "_media_aggregator", lambda store: FakeAgg())
    r = client.post(f"/api/v1/projects/{pid}/media/search", json={})
    assert r.status_code == 200
    assert r.json()["data"]["selected_count"] == 1


def test_media_search_requires_shot_plan(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    assert client.post(f"/api/v1/projects/{pid}/media/search", json={}).status_code == 400


def _seed_plan_and_media(pid):
    from app.domain.media.models import MediaCandidate
    from app.domain.planning.models import ShotPlan, ShotSegment
    store = pj._store()
    store.save_shot_plan(pid, ShotPlan(
        task_id=pid, language="es", script="Uno. Dos.",
        segments=[
            ShotSegment(id="seg_001", order=1, narration_text="Uno.",
                        target_duration_sec=3.0, visual_goal="x", search_queries=["q"]),
            ShotSegment(id="seg_002", order=2, narration_text="Dos.",
                        target_duration_sec=2.0, visual_goal="y", search_queries=["q"]),
        ],
    ))
    store.save_selected_media(pid, [
        MediaCandidate(id="mc-1", provider="pexels", local_path="/tmp/a.mp4",
                       duration_sec=10.0, segment_id="seg_001"),
        MediaCandidate(id="mc-2", provider="pexels", local_path="/tmp/b.mp4",
                       duration_sec=10.0, segment_id="seg_002"),
    ])


def test_timeline_build_endpoint(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    r = client.post(f"/api/v1/projects/{pid}/timeline/build", json={"title": "Demo"})
    assert r.status_code == 200
    assert pj._store().load_timeline(pid) is not None


def test_timeline_commands_endpoint(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    store = pj._store()
    item_id = store.load_timeline(pid).tracks[0].items[0].id
    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "trim", "track_id": "video_1", "item_id": item_id,
         "trim_start_sec": 0.5, "trim_end_sec": 3.5},
    ]})
    assert r.status_code == 200
    reloaded = store.load_timeline(pid).tracks[0].items[0]
    assert reloaded.trim_start_sec == 0.5
    assert reloaded.trim_end_sec == 3.5


def test_timeline_commands_reject_invalid_change_without_persisting(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    store = pj._store()
    before = store.load_timeline(pid)
    item_id = before.tracks[0].items[0].id

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "set_timing", "track_id": "video_1", "item_id": item_id,
         "duration_sec": 10.0},
    ]})

    assert r.status_code == 400
    assert "trim range" in r.json()["message"].lower()
    after = store.load_timeline(pid)
    assert after.tracks[0].items[0].duration_sec == before.tracks[0].items[0].duration_sec


def test_timeline_replace_rejects_candidate_not_in_project_pool(client, tmp_path):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    store = pj._store()
    before = store.load_timeline(pid)
    item = before.tracks[0].items[0]
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"not a project candidate")

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "replace", "track_id": "video_1", "item_id": item.id,
         "new_candidate": {"id": "evil", "provider": "local", "local_path": str(outside),
                           "segment_id": item.segment_id}},
    ]})

    assert r.status_code == 400
    assert "project media candidates" in r.json()["message"]
    after = store.load_timeline(pid)
    assert after.tracks[0].items[0].media_id == item.media_id
    assert after.tracks[0].items[0].local_path == item.local_path


def test_timeline_replace_allows_same_segment_project_candidate(client):
    from app.domain.media.models import MediaCandidate

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    store = pj._store()
    store.save_media_candidates(pid, [
        *store.load_selected_media(pid),
        MediaCandidate(
            id="mc-alt", provider="pexels", source_url="https://example.com/alt.mp4",
            duration_sec=10.0, segment_id="seg_001",
        ),
    ])
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    item = store.load_timeline(pid).tracks[0].items[0]

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "replace", "track_id": "video_1", "item_id": item.id,
         "new_candidate": {"id": "mc-alt", "provider": "pexels",
                           "source_url": "https://example.com/alt.mp4",
                           "segment_id": "seg_001"}},
    ]})

    assert r.status_code == 200
    replaced = store.load_timeline(pid).tracks[0].items[0]
    assert replaced.media_id == "mc-alt"
    assert replaced.local_path == "https://example.com/alt.mp4"


def test_timeline_replace_rejects_partial_candidate_metadata(client):
    from app.domain.media.models import MediaCandidate

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    store = pj._store()
    store.save_media_candidates(pid, [
        *store.load_selected_media(pid),
        MediaCandidate(
            id="mc-alt", provider="pexels", source_url="https://example.com/alt.mp4",
            duration_sec=10.0, segment_id="seg_001",
        ),
    ])
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    item = store.load_timeline(pid).tracks[0].items[0]

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "replace", "track_id": "video_1", "item_id": item.id,
         "new_candidate": {"id": "mc-alt", "provider": "pexels", "segment_id": "seg_001"}},
    ]})

    assert r.status_code == 400
    assert "match project media candidates" in r.json()["message"]


def test_timeline_replace_rejects_different_segment_candidate(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    store = pj._store()
    item = store.load_timeline(pid).tracks[0].items[0]

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "replace", "track_id": "video_1", "item_id": item.id,
         "new_candidate": {"id": "mc-2", "provider": "pexels",
                           "duration_sec": 10.0, "segment_id": "seg_002"}},
    ]})

    assert r.status_code == 400
    assert "same segment" in r.json()["message"]


def test_timeline_replace_rejects_candidate_without_segment(client):
    from app.domain.media.models import MediaCandidate

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    store = pj._store()
    store.save_media_candidates(pid, [
        *store.load_selected_media(pid),
        MediaCandidate(id="mc-global", provider="pexels", source_url="https://example.com/global.mp4"),
    ])
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    item = store.load_timeline(pid).tracks[0].items[0]

    r = client.post(f"/api/v1/projects/{pid}/timeline/commands", json={"commands": [
        {"type": "replace", "track_id": "video_1", "item_id": item.id,
         "new_candidate": {"id": "mc-global", "provider": "pexels",
                           "source_url": "https://example.com/global.mp4"}},
    ]})

    assert r.status_code == 400
    assert "same segment" in r.json()["message"]


def test_timeline_validate_endpoint_returns_ok(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})

    r = client.post(f"/api/v1/projects/{pid}/timeline/validate", json={})

    assert r.status_code == 200
    assert r.json()["data"] == {"project_id": pid, "valid": True}


def test_timeline_validate_endpoint_rejects_invalid_timeline(client):
    from app.domain.projects.models import TimelineItem, TimelineProject, TimelineTrack

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    pj._store().save_timeline(pid, TimelineProject(
        project_id=pid,
        task_id=pid,
        tracks=[TimelineTrack(
            id="video_1", type="video", name="Video", items=[
                TimelineItem(id="a", start_sec=0.0, duration_sec=1.0),
                TimelineItem(id="b", start_sec=3.0, duration_sec=1.0),
            ],
        )],
    ))

    r = client.post(f"/api/v1/projects/{pid}/timeline/validate", json={})

    assert r.status_code == 400
    assert "gap" in r.json()["message"].lower()


class _FakeMusicProvider:
    name = "fake"

    def __init__(self, tracks):
        self._tracks = tracks

    def is_configured(self):
        return True

    def search(self, intent, max_results):
        return list(self._tracks)


def test_music_select_endpoint_uses_manual_intent(client, monkeypatch):
    from app.domain.music.models import MusicTrack

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    track = MusicTrack(
        id="m1", provider="local", local_path="/tmp/inspirational.mp3",
        tags=["inspirational", "cinematic"], title="Inspire",
    )
    monkeypatch.setattr(
        pj, "_music_providers", lambda local_only=True: [_FakeMusicProvider([track])]
    )

    r = client.post(f"/api/v1/projects/{pid}/music/select", json={
        "mood": "inspirational", "energy": "medium", "style": "cinematic",
        "commercial_safe_only": False, "local_only": True, "volume": 0.33,
    })

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["selected"]["id"] == "m1"
    assert pj._store().load_selected_music(pid)[0].volume == 0.33


def test_music_select_endpoint_uses_shot_plan_intent(client, monkeypatch):
    from app.domain.music.models import MusicTrack
    from app.domain.planning.models import MusicIntent, ShotPlan, ShotSegment

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    pj._store().save_shot_plan(pid, ShotPlan(
        task_id=pid,
        language="es",
        script="Uno.",
        music_intent=MusicIntent(mood="calm", energy="low", style="ambient"),
        segments=[ShotSegment(
            id="seg_001", order=1, narration_text="Uno.", target_duration_sec=3.0,
            visual_goal="x", search_queries=["q"],
        )],
    ))
    track = MusicTrack(
        id="m2", provider="local", local_path="/tmp/calm.mp3", tags=["calm", "ambient"]
    )
    monkeypatch.setattr(
        pj, "_music_providers", lambda local_only=True: [_FakeMusicProvider([track])]
    )

    r = client.post(f"/api/v1/projects/{pid}/music/select", json={"commercial_safe_only": False})

    assert r.status_code == 200
    assert r.json()["data"]["selected"]["id"] == "m2"


def test_music_select_endpoint_no_provider_does_not_break(client, monkeypatch):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    monkeypatch.setattr(pj, "_music_providers", lambda local_only=True: [])

    r = client.post(f"/api/v1/projects/{pid}/music/select", json={
        "mood": "inspirational", "energy": "medium", "local_only": True,
    })

    assert r.status_code == 200
    assert r.json()["data"]["selected"] is None
    assert pj._store().load_selected_music(pid) == []


def test_music_get_endpoint_returns_selected_music(client):
    from app.domain.music.models import MusicTrack

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    pj._store().save_selected_music(pid, [
        MusicTrack(id="m1", provider="local", local_path="/tmp/song.mp3", title="Song"),
    ])

    r = client.get(f"/api/v1/projects/{pid}/music")

    assert r.status_code == 200
    assert r.json()["data"]["tracks"][0]["id"] == "m1"


def test_render_endpoint_background_and_status(client, monkeypatch):
    from app.domain.rendering.models import RenderResult
    from app.application.workflows import render_project as rp

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})

    def fake_render(task_id, store, renderer=None, output_dir=None):
        return RenderResult(project_id=task_id, output_path="/tmp/final.mp4",
                            renderer_used="moviepy", success=True, duration_sec=5.0)

    monkeypatch.setattr(rp, "render_project_from_store", fake_render)
    r = client.post(f"/api/v1/projects/{pid}/render", json={})
    assert r.status_code == 202

    s = client.get(f"/api/v1/projects/{pid}/render")
    assert s.status_code == 200
    assert s.json()["data"]["state"] in (1, 4)  # COMPLETE or PROCESSING


def test_render_endpoint_preserves_existing_renderer_when_request_omits_renderer(
    client, monkeypatch
):
    from app.domain.rendering.models import RenderResult, RenderSpec
    from app.application.workflows import render_project as rp

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    monkeypatch.setattr(pj.config, "timeline_renderer", "moviepy")
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    pj._store().save_render_spec(
        pid,
        RenderSpec(
            project_id=pid, task_id=pid, renderer="opencut", width=1080, height=1920, fps=30
        ),
    )

    captured = {}

    def fake_render(task_id, store, renderer=None, output_dir=None):
        captured["renderer"] = store.load_render_spec(task_id).renderer
        return RenderResult(project_id=task_id, output_path="/tmp/final.mp4",
                            renderer_used="opencut", success=False, error="not implemented")

    monkeypatch.setattr(rp, "render_project_from_store", fake_render)

    r = client.post(f"/api/v1/projects/{pid}/render", json={})

    assert r.status_code == 202
    assert captured["renderer"] == "opencut"


def test_render_requires_timeline(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    assert client.post(f"/api/v1/projects/{pid}/render", json={}).status_code == 400


def test_render_rejects_unknown_renderer(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})

    r = client.post(f"/api/v1/projects/{pid}/render", json={"renderer": "unknown"})

    assert r.status_code == 400


def test_render_falls_back_when_config_renderer_is_invalid(client, monkeypatch):
    from app.domain.rendering.models import RenderResult
    from app.application.workflows import render_project as rp

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]
    _seed_plan_and_media(pid)
    client.post(f"/api/v1/projects/{pid}/timeline/build", json={})
    monkeypatch.setattr(pj.config, "timeline_renderer", "bad-renderer")
    captured = {}

    def fake_render(task_id, store, renderer=None, output_dir=None):
        captured["renderer"] = store.load_render_spec(task_id).renderer
        return RenderResult(project_id=task_id, output_path="/tmp/final.mp4",
                            renderer_used="moviepy", success=True)

    monkeypatch.setattr(rp, "render_project_from_store", fake_render)

    r = client.post(f"/api/v1/projects/{pid}/render", json={})

    assert r.status_code == 202
    assert captured["renderer"] == "moviepy"


def test_assets_endpoint_lists_files(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    r = client.get(f"/api/v1/projects/{pid}/assets")
    assert r.status_code == 200
    names = r.json()["data"]["assets"]
    assert any(a.endswith("script.txt") for a in names)


def _save_timeline_with_asset(pid, local_path):
    from app.domain.projects.models import TimelineItem, TimelineProject, TimelineTrack

    pj._store().save_timeline(pid, TimelineProject(
        project_id=pid,
        task_id=pid,
        tracks=[TimelineTrack(
            id="video_1",
            type="video",
            name="Video",
            items=[TimelineItem(
                id="clip-1",
                local_path=local_path,
                start_sec=0.0,
                duration_sec=1.0,
            )],
        )],
    ))


def test_asset_endpoint_serves_referenced_project_file(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    project_dir = pj._store().project_dir(pid, make=True)
    asset_dir = Path(project_dir) / "media"
    asset_dir.mkdir()
    asset = asset_dir / "clip.mp4"
    asset.write_bytes(b"clip-bytes")
    _save_timeline_with_asset(pid, str(asset))

    r = client.get(f"/api/v1/projects/{pid}/assets/media/clip.mp4")

    assert r.status_code == 200
    assert r.content == b"clip-bytes"


def test_asset_endpoint_rejects_path_traversal(client, tmp_path):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    outside = tmp_path / "secret.mp4"
    outside.write_bytes(b"secret")

    r = client.get(f"/api/v1/projects/{pid}/assets/..%2Fsecret.mp4")

    assert r.status_code in (400, 404)


def test_asset_endpoint_rejects_unreferenced_project_file(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    project_dir = pj._store().project_dir(pid, make=True)
    asset = Path(project_dir) / "orphan.mp4"
    asset.write_bytes(b"orphan")

    r = client.get(f"/api/v1/projects/{pid}/assets/orphan.mp4")

    assert r.status_code == 404


def test_asset_endpoint_rejects_asset_outside_project(client, tmp_path):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    outside = tmp_path / "outside.mp4"
    outside.write_bytes(b"outside")
    _save_timeline_with_asset(pid, str(outside))

    r = client.get(f"/api/v1/projects/{pid}/assets/outside.mp4")

    assert r.status_code == 404


def test_from_reddit_manual_payload(client, monkeypatch):
    monkeypatch.setattr(pj.config, "reddit_ingest_enabled", True)
    r = client.post("/api/v1/projects/from-reddit", json={
        "title": "T", "body": "story by u/bob", "comments": ["nice by u/ann"],
    })
    assert r.status_code == 200
    pid = r.json()["data"]["project_id"]
    script = pj._store().load_script(pid)
    assert "u/bob" not in script
    assert "story" in script


def test_from_reddit_url_uses_service(client, monkeypatch):
    from app.domain.sources.models import StorySource
    monkeypatch.setattr(pj.config, "reddit_ingest_enabled", True)

    class FakeSvc:
        def fetch(self, url, client=None):
            return StorySource(id="abc", kind="reddit", title="Hi", body="text by u/x")
        def from_manual(self, title, body, comments=None):
            raise AssertionError("should use fetch for url")

    monkeypatch.setattr(pj, "_reddit_service", lambda: FakeSvc())
    r = client.post("/api/v1/projects/from-reddit", json={"url": "https://reddit.com/r/x/abc"})
    assert r.status_code == 200
    pid = r.json()["data"]["project_id"]
    assert "u/x" not in pj._store().load_script(pid)


def test_from_reddit_404_when_disabled(client, monkeypatch):
    monkeypatch.setattr(pj.config, "reddit_ingest_enabled", False)
    r = client.post("/api/v1/projects/from-reddit", json={"body": "x"})
    assert r.status_code == 404


def test_from_reddit_requires_payload(client, monkeypatch):
    monkeypatch.setattr(pj.config, "reddit_ingest_enabled", True)
    r = client.post("/api/v1/projects/from-reddit", json={})
    assert r.status_code == 400
