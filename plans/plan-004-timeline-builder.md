# Timeline Builder automatico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `TimelineBuilder` para convertir `ShotPlan + selected_media` en `TimelineProject` persistible, determinista y validado.

**Architecture:** Servicio standalone en `app/application/services/timeline_builder.py`. Consume modelos de dominio existentes y `ProjectStore`; no toca pipeline legacy. Crea tracks `video`, `audio` y `subtitle` simples, valida gaps/overlaps y persiste `timeline_project.json` cuando hay `task_id`.

**Tech Stack:** Python 3.11-3.12, Pydantic v2, pytest, uv.

## Global Constraints

- Python `>=3.11,<3.13`. Sin dependencias nuevas, GPU-obligatorias ni red.
- No modificar `app/services/task.py`, `app/services/material.py`, `app/services/video.py`, `app/services/llm.py` ni romper WebUI/API/CLI legacy.
- Usar modelos existentes: `TimelineProject`, `TimelineTrack`, `TimelineItem`, `ExportSettings`, `ShotPlan`, `MediaCandidate`.
- Factory `get_timeline_builder()` usa `TURBOPRINTER_PROJECT_MODE_ENABLED`, default `false`.
- Segmentos sin media producen placeholder trazable, no excepcion temprana.
- Clips seleccionados con `duration_sec` conocido menor al segmento se repiten en items contiguos y se registran en `metadata["repeated_media_segments"]`.
- Clips con `duration_sec` conocido no positivo o sub-epsilon se reemplazan por placeholder y se registran en `metadata["invalid_media_segments"]`.
- Timeline determinista: starts acumulativos, orden por segmentos, sin RNG.
- Validar no gaps/no overlaps con `app.domain.projects.validators`.
- No commitear secretos, `config.toml`, artefactos ni cambios ajenos. En este entorno no hacer commit/push salvo pedido explicito.

---

### Task 1: Core builder + video track

**Files:**
- Create: `app/application/services/timeline_builder.py`
- Test: `test/services/test_timeline_builder.py`

**Interfaces:**
- Consumes: `ShotPlan`, `MediaCandidate`, `TimelineProject`, `TimelineTrack`, `TimelineItem`, `ExportSettings`, `validate_no_gaps`, `validate_no_overlaps`, `ProjectStore`.
- Produces: `TimelineBuilder.build(...) -> TimelineProject`.

- [ ] **Step 1: Write failing test**

Create `test/services/test_timeline_builder.py` with helpers and core test:

```python
from __future__ import annotations

import pytest

from app.application.services.timeline_builder import TimelineBuilder
from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment


def _segment(seg_id: str, order: int, duration: float) -> ShotSegment:
    return ShotSegment(
        id=seg_id,
        order=order,
        narration_text=f"Narration {order}",
        target_duration_sec=duration,
        visual_goal=f"Visual goal {order}",
        search_queries=[f"query {order}"],
    )


def _plan() -> ShotPlan:
    return ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno. Dos. Tres.",
        segments=[
            _segment("seg_001", 1, 3.0),
            _segment("seg_002", 2, 4.0),
            _segment("seg_003", 3, 2.5),
        ],
    )


def _candidate(seg_id: str, cid: str, duration: float = 10.0) -> MediaCandidate:
    return MediaCandidate(
        id=cid,
        provider="pexels",
        local_path=f"/tmp/{cid}.mp4",
        duration_sec=duration,
        segment_id=seg_id,
        score=4.2,
        score_reasons=["test"],
    )


def test_build_creates_contiguous_video_track():
    selected = {
        "seg_001": _candidate("seg_001", "mc-1"),
        "seg_002": _candidate("seg_002", "mc-2"),
        "seg_003": _candidate("seg_003", "mc-3"),
    }
    project = TimelineBuilder().build(_plan(), selected, task_id="task-1")

    assert project.project_id == "task-1"
    assert project.task_id == "task-1"
    assert project.script == "Uno. Dos. Tres."
    assert len(project.tracks) == 1
    video = project.tracks[0]
    assert video.id == "video_1"
    assert video.type == "video"
    assert [item.start_sec for item in video.items] == [0.0, 3.0, 7.0]
    assert [item.duration_sec for item in video.items] == [3.0, 4.0, 2.5]
    assert [item.media_id for item in video.items] == ["mc-1", "mc-2", "mc-3"]
    assert [item.local_path for item in video.items] == [
        "/tmp/mc-1.mp4",
        "/tmp/mc-2.mp4",
        "/tmp/mc-3.mp4",
    ]
    assert project.metadata["timeline_duration_sec"] == 9.5
    assert project.metadata["missing_media_segments"] == []
```

- [ ] **Step 2: Run failure**

Run: `uv run pytest test/services/test_timeline_builder.py::test_build_creates_contiguous_video_track -v`

Expected: FAIL with missing `timeline_builder` module.

- [ ] **Step 3: Implement minimal builder**

Create `app/application/services/timeline_builder.py`:

```python
from __future__ import annotations

from collections.abc import Mapping, Sequence

from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment
from app.domain.projects.models import ExportSettings, TimelineItem, TimelineProject, TimelineTrack
from app.domain.projects.validators import validate_no_gaps, validate_no_overlaps
from app.infrastructure.storage.base import ProjectStore

SelectedMedia = Mapping[str, MediaCandidate] | Sequence[MediaCandidate]


class TimelineBuilder:
    def __init__(self, store: ProjectStore | None = None) -> None:
        self._store = store

    @staticmethod
    def _duration(segment: ShotSegment) -> float:
        if segment.start_sec is not None and segment.end_sec is not None:
            duration = segment.end_sec - segment.start_sec
            if duration > 0:
                return duration
        return segment.target_duration_sec

    @staticmethod
    def _selection_by_segment(selected_media: SelectedMedia) -> dict[str, MediaCandidate]:
        if isinstance(selected_media, Mapping):
            return dict(selected_media)
        by_segment: dict[str, MediaCandidate] = {}
        for candidate in selected_media:
            if candidate.segment_id:
                by_segment[candidate.segment_id] = candidate
        return by_segment

    @staticmethod
    def _candidate_path(candidate: MediaCandidate) -> str | None:
        return candidate.local_path or candidate.download_url or candidate.source_url

    def build(
        self,
        shot_plan: ShotPlan,
        selected_media: SelectedMedia,
        task_id: str | None = None,
        title: str | None = None,
        export: ExportSettings | None = None,
        narration_audio_path: str | None = None,
        subtitle_path: str | None = None,
    ) -> TimelineProject:
        project_task_id = task_id or shot_plan.task_id
        selection = self._selection_by_segment(selected_media)
        items: list[TimelineItem] = []
        missing_segments: list[str] = []
        cursor = 0.0

        for segment in shot_plan.segments:
            duration = self._duration(segment)
            if duration <= 0:
                raise ValueError(f"segment {segment.id!r} has non-positive duration")
            candidate = selection.get(segment.id)
            if candidate is None:
                missing_segments.append(segment.id)
                item = TimelineItem(
                    id=f"item_{segment.id}", media_id=None, local_path=None,
                    start_sec=cursor, duration_sec=duration, segment_id=segment.id,
                    provider="placeholder",
                )
            else:
                item = TimelineItem(
                    id=f"item_{segment.id}", media_id=candidate.id,
                    local_path=self._candidate_path(candidate), start_sec=cursor,
                    duration_sec=duration, trim_start_sec=0.0,
                    trim_end_sec=min(candidate.duration_sec, duration)
                    if candidate.duration_sec is not None else None,
                    segment_id=segment.id, provider=candidate.provider,
                )
            items.append(item)
            cursor += duration

        video_track = TimelineTrack(id="video_1", type="video", name="Video", items=items)
        validate_no_gaps(video_track)
        validate_no_overlaps(video_track)
        project_kwargs = {
            "task_id": project_task_id,
            "title": title,
            "script": shot_plan.script,
            "shot_plan": shot_plan,
            "tracks": [video_track],
            "export": export or ExportSettings(),
            "metadata": {
                "timeline_builder_version": "1.0",
                "timeline_duration_sec": cursor,
                "missing_media_segments": missing_segments,
                "selected_media_count": len(selection),
            },
        }
        if project_task_id:
            project_kwargs["project_id"] = project_task_id
        project = TimelineProject(**project_kwargs)
        if self._store is not None and project_task_id:
            self._store.save_timeline(project_task_id, project)
        return project
```

- [ ] **Step 4: Run pass**

Run: `uv run pytest test/services/test_timeline_builder.py::test_build_creates_contiguous_video_track -v`

Expected: PASS.

---

### Task 2: Lists, short clips, placeholders, duration validation, audio/subtitle tracks

**Files:**
- Modify: `app/application/services/timeline_builder.py`
- Modify: `test/services/test_timeline_builder.py`

**Interfaces:**
- Consumes: `TimelineBuilder.build()`.
- Produces: list selected-media support, short-clip repetition metadata, placeholder behavior, duration validation, optional `audio` and `subtitle` tracks.

- [ ] **Step 1: Write failing tests**

Append tests:

```python
def test_build_accepts_selected_media_list():
    project = TimelineBuilder().build(_plan(), [
        _candidate("seg_001", "mc-1"),
        _candidate("seg_002", "mc-2"),
        _candidate("seg_003", "mc-3"),
    ], task_id="task-1")
    assert [item.media_id for item in project.tracks[0].items] == ["mc-1", "mc-2", "mc-3"]


def test_build_repeats_short_candidate_to_cover_segment():
    plan = ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno. Dos.",
        segments=[_segment("seg_short", 1, 5.0), _segment("seg_next", 2, 3.0)],
    )
    project = TimelineBuilder().build(
        plan,
        {
            "seg_short": _candidate("seg_short", "mc-short", duration=2.0),
            "seg_next": _candidate("seg_next", "mc-next", duration=10.0),
        },
        task_id="task-1",
    )

    video_items = project.tracks[0].items
    repeated_items = video_items[:3]
    assert [item.duration_sec for item in repeated_items] == [2.0, 2.0, 1.0]
    assert [item.start_sec for item in repeated_items] == [0.0, 2.0, 4.0]
    assert [item.media_id for item in repeated_items] == ["mc-short", "mc-short", "mc-short"]
    assert video_items[3].segment_id == "seg_next"
    assert video_items[3].start_sec == 5.0
    assert project.metadata["repeated_media_segments"] == [{
        "segment_id": "seg_short",
        "media_id": "mc-short",
        "source_duration_sec": 2.0,
        "target_duration_sec": 5.0,
        "parts": 3,
    }]


def test_build_creates_placeholder_for_missing_segment():
    project = TimelineBuilder().build(_plan(), {"seg_001": _candidate("seg_001", "mc-1")}, task_id="task-1")
    items = project.tracks[0].items
    assert items[1].provider == "placeholder"
    assert items[1].media_id is None
    assert items[1].local_path is None
    assert project.metadata["missing_media_segments"] == ["seg_002", "seg_003"]


def test_build_rejects_non_positive_segment_duration():
    plan = ShotPlan(language="es", script="Zero.", segments=[_segment("seg_zero", 1, 0.0)])
    with pytest.raises(ValueError, match="seg_zero"):
        TimelineBuilder().build(plan, {})


def test_build_adds_audio_and_subtitle_tracks():
    project = TimelineBuilder().build(
        _plan(),
        {"seg_001": _candidate("seg_001", "mc-1"), "seg_002": _candidate("seg_002", "mc-2"), "seg_003": _candidate("seg_003", "mc-3")},
        task_id="task-1",
        narration_audio_path="/tmp/narration.mp3",
        subtitle_path="/tmp/subtitles.srt",
    )
    assert [track.type for track in project.tracks] == ["video", "audio", "subtitle"]
    assert project.tracks[1].items[0].local_path == "/tmp/narration.mp3"
    assert project.tracks[1].items[0].duration_sec == 9.5
    assert project.tracks[2].items[0].local_path == "/tmp/subtitles.srt"
    assert project.tracks[2].items[0].duration_sec == 9.5
```

- [ ] **Step 2: Run failure**

Run: `uv run pytest test/services/test_timeline_builder.py -v`

Expected: audio/subtitle test FAILS until tracks are added.

- [ ] **Step 3: Implement short-clip repetition and tracks**

When `candidate.duration_sec` is known and shorter than segment duration, append repeated contiguous items for that segment until covered and add a `repeated_media_segments` metadata record. Before `project_kwargs`, create `tracks = [video_track]`; append `audio_1` and `subtitle_1` tracks when paths are present, each with one `TimelineItem` covering `cursor`. Use `tracks` and metadata containing both `missing_media_segments` and `repeated_media_segments` in project kwargs.

- [ ] **Step 4: Run pass**

Run: `uv run pytest test/services/test_timeline_builder.py -v`

Expected: PASS.

---

### Task 3: Store integration + factory

**Files:**
- Modify: `app/application/services/timeline_builder.py`
- Modify: `test/services/test_timeline_builder.py`

**Interfaces:**
- Consumes: `ProjectStore.save/load_shot_plan`, `save/load_selected_media`, `save/load_timeline`; `config.project_mode_enabled`.
- Produces: `build_from_store(...)` and `get_timeline_builder(store=None)`.

- [ ] **Step 1: Write failing tests**

Append tests:

```python
def test_build_persists_timeline(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    project = TimelineBuilder(store=store).build(_plan(), {"seg_001": _candidate("seg_001", "mc-1")}, task_id="task-1")
    loaded = store.load_timeline("task-1")
    assert loaded is not None
    assert loaded.project_id == project.project_id
    assert loaded.metadata["missing_media_segments"] == ["seg_002", "seg_003"]


def test_build_from_store_loads_plan_and_selected_media(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    store.save_shot_plan("task-1", _plan())
    store.save_selected_media("task-1", [_candidate("seg_001", "mc-1"), _candidate("seg_002", "mc-2"), _candidate("seg_003", "mc-3")])
    project = TimelineBuilder(store=store).build_from_store("task-1", title="Demo")
    assert project.title == "Demo"
    assert [item.media_id for item in project.tracks[0].items] == ["mc-1", "mc-2", "mc-3"]
    assert store.load_timeline("task-1") is not None


def test_build_from_store_requires_store():
    with pytest.raises(ValueError, match="ProjectStore"):
        TimelineBuilder().build_from_store("task-1")


def test_build_from_store_requires_shot_plan(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    with pytest.raises(ValueError, match="shot_plan"):
        TimelineBuilder(store=store).build_from_store("missing")


def test_get_timeline_builder_uses_project_mode_flag(monkeypatch):
    from app.application.services import timeline_builder as tb
    monkeypatch.setattr(tb.config, "project_mode_enabled", False)
    assert tb.get_timeline_builder() is None
    monkeypatch.setattr(tb.config, "project_mode_enabled", True)
    assert isinstance(tb.get_timeline_builder(), tb.TimelineBuilder)
```

- [ ] **Step 2: Run failure**

Run: `uv run pytest test/services/test_timeline_builder.py -v`

Expected: FAIL with missing `build_from_store` or `get_timeline_builder`.

- [ ] **Step 3: Implement store methods and factory**

Add `from app.config import config`. Add method:

```python
    def build_from_store(self, task_id: str, title: str | None = None, export: ExportSettings | None = None, narration_audio_path: str | None = None, subtitle_path: str | None = None) -> TimelineProject:
        if self._store is None:
            raise ValueError("ProjectStore is required to build a timeline from store")
        shot_plan = self._store.load_shot_plan(task_id)
        if shot_plan is None:
            raise ValueError(f"shot_plan.json not found for task {task_id!r}")
        return self.build(shot_plan, self._store.load_selected_media(task_id), task_id=task_id, title=title, export=export, narration_audio_path=narration_audio_path, subtitle_path=subtitle_path)
```

Add module function:

```python
def get_timeline_builder(store: ProjectStore | None = None) -> TimelineBuilder | None:
    if not getattr(config, "project_mode_enabled", False):
        return None
    return TimelineBuilder(store=store)
```

- [ ] **Step 4: Run pass**

Run: `uv run pytest test/services/test_timeline_builder.py -v`

Expected: PASS.

---

### Task 4: Documentation + validation gates

**Files:**
- Create: `docs/architecture/001-project-timeline-architecture.md`
- Modify: `README_PERSONAL_FORK.md`

**Interfaces:**
- Consumes: implemented `TimelineBuilder`.
- Produces: docs for Fase 4 scope and validation output.

- [ ] **Step 1: Create architecture doc**

Create `docs/architecture/001-project-timeline-architecture.md` covering: `ShotPlan -> selected_media.json -> TimelineBuilder -> timeline_project.json`, contracts, flags, placeholder behavior, and out-of-scope render/API/UI.

- [ ] **Step 2: Update README_PERSONAL_FORK.md**

In section `1b`, add row for `app/application/services/timeline_builder.py`: builds deterministic `TimelineProject` from `ShotPlan + selected_media`; writes `timeline_project.json`; Fase 4 standalone, no legacy render wiring yet. Add paragraph after feature flags noting Fase 5 will add render adapter.

- [ ] **Step 3: Validation gates**

Run:

```bash
uv run python -m compileall app
uv run pytest test/services/test_timeline_builder.py -v
uv run pytest test/domain/test_timeline_project.py test/infrastructure/test_project_store.py test/services/test_timeline_builder.py -v
uv run python cli.py --help
uv lock --check
```

Expected: all pass. If environment-specific known `test_llm.py` failures appear only in full suite, record as baseline, not regression.

- [ ] **Step 4: Do not commit in this environment**

Record changed files and validation output. Do not run `git commit` or `git push` unless explicitly requested.
