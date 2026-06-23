from __future__ import annotations

import importlib.util
import os

_PAGE = os.path.join(
    os.path.dirname(__file__), "..", "..", "webui", "pages", "2_Project_Editor.py"
)


def _load_page():
    spec = importlib.util.spec_from_file_location("project_editor_page", _PAGE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_build_trim_command():
    page = _load_page()
    cmd = page.build_trim_command("video_1", "i1", 0.5, 2.0)
    assert cmd == {"type": "trim", "track_id": "video_1", "item_id": "i1",
                   "trim_start_sec": 0.5, "trim_end_sec": 2.0}


def test_build_reorder_command_moves_item_start():
    page = _load_page()
    items = [
        {"id": "a", "start_sec": 0.0, "duration_sec": 3.0},
        {"id": "b", "start_sec": 3.0, "duration_sec": 2.0},
    ]
    cmd = page.build_reorder_command("video_1", items, 1, "up")
    assert cmd["type"] == "move"
    assert cmd["track_id"] == "video_1"
    assert cmd["item_id"] == "b"
    assert cmd["new_start_sec"] == 0.0


def test_build_reorder_command_top_item_up_is_noop():
    page = _load_page()
    items = [{"id": "a", "start_sec": 0.0, "duration_sec": 3.0}]
    assert page.build_reorder_command("video_1", items, 0, "up") is None


def test_build_reorder_commands_swap_adjacent_items():
    page = _load_page()
    items = [
        {"id": "a", "start_sec": 0.0, "duration_sec": 3.0},
        {"id": "b", "start_sec": 3.0, "duration_sec": 2.0},
    ]

    commands = page.build_reorder_commands("video_1", items, 1, "up")

    assert commands == [
        {"type": "move", "track_id": "video_1", "item_id": "b", "new_start_sec": 0.0},
        {"type": "move", "track_id": "video_1", "item_id": "a", "new_start_sec": 2.0},
    ]


def test_build_set_timing_command():
    page = _load_page()
    assert page.build_set_timing_command("video_1", "i1", 4.5) == {
        "type": "set_timing", "track_id": "video_1", "item_id": "i1", "duration_sec": 4.5,
    }


def test_build_replace_command():
    page = _load_page()
    candidate = {"id": "mc-1", "provider": "pexels", "local_path": "/tmp/a.mp4"}
    cmd = page.build_replace_command("video_1", "i1", candidate)
    assert cmd == {
        "type": "replace", "track_id": "video_1", "item_id": "i1", "new_candidate": candidate,
    }


def test_asset_id_for_local_path_matches_preview_asset():
    page = _load_page()
    assets = [{"asset_id": "media/clip.mp4", "path": "media/clip.mp4"}]
    assert page.asset_id_for_local_path("/tmp/project/media/clip.mp4", assets) == "media/clip.mp4"
