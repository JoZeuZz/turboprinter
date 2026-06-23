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
