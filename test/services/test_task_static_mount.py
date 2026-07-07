from __future__ import annotations

import os
import shutil

from fastapi.testclient import TestClient

from app.asgi import app
from app.utils import utils


def test_meta_files_are_not_fetchable_via_tasks_mount():
    """`_meta/` must 404 through the static mount even with a known filename."""
    task_id = "static-mount-test-task"
    base = utils.task_dir(task_id)
    meta_dir = os.path.join(base, "_meta")
    os.makedirs(meta_dir, exist_ok=True)
    try:
        with open(os.path.join(meta_dir, "script.json"), "w") as f:
            f.write('{"secret": "do not leak"}')
        with open(os.path.join(base, "final-1.mp4"), "wb") as f:
            f.write(b"fake video bytes")

        client = TestClient(app)

        meta_resp = client.get(f"/tasks/{task_id}/_meta/script.json")
        assert meta_resp.status_code == 404

        public_resp = client.get(f"/tasks/{task_id}/final-1.mp4")
        assert public_resp.status_code == 200
        assert public_resp.content == b"fake video bytes"
    finally:
        shutil.rmtree(base, ignore_errors=True)
