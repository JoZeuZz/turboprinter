from __future__ import annotations

from typing import Any

import requests

from app.config import config

_TIMEOUT = 600


class ProjectApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        super().__init__(f"API error {status_code}: {message}")


def _default_base_url() -> str:
    host = getattr(config, "listen_host", "127.0.0.1") or "127.0.0.1"
    port = getattr(config, "listen_port", 8080)
    if host in ("0.0.0.0", ""):
        host = "127.0.0.1"
    return f"http://{host}:{port}/api/v1"


class ProjectApiClient:
    def __init__(self, base_url: str | None = None) -> None:
        self.base_url = (base_url or _default_base_url()).rstrip("/")

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    @staticmethod
    def _data(resp) -> dict[str, Any]:
        if resp.status_code >= 400:
            try:
                message = resp.json().get("message", "")
            except Exception:  # noqa: BLE001
                message = ""
            raise ProjectApiError(resp.status_code, message)
        return resp.json().get("data", {})

    def _post(self, path: str, payload: dict) -> dict:
        return self._data(requests.post(self._url(path), json=payload, timeout=_TIMEOUT))

    def _get(self, path: str) -> dict:
        return self._data(requests.get(self._url(path), timeout=_TIMEOUT))

    def create_from_script(self, script: str, language: str, topic: str | None = None) -> dict:
        return self._post("/projects/from-script",
                          {"script": script, "language": language, "topic": topic})

    def create_from_topic(self, topic: str, language: str, generate_script: bool = False) -> dict:
        return self._post("/projects/from-topic",
                          {"topic": topic, "language": language, "generate_script": generate_script})

    def get_project(self, pid: str) -> dict:
        return self._get(f"/projects/{pid}")

    def plan(self, pid: str, **opts) -> dict:
        return self._post(f"/projects/{pid}/plan", opts)

    def media_search(self, pid: str, **opts) -> dict:
        return self._post(f"/projects/{pid}/media/search", opts)

    def build_timeline(self, pid: str, **opts) -> dict:
        return self._post(f"/projects/{pid}/timeline/build", opts)

    def apply_commands(self, pid: str, commands: list[dict]) -> dict:
        return self._post(f"/projects/{pid}/timeline/commands", {"commands": commands})

    def render(self, pid: str, **opts) -> dict:
        return self._post(f"/projects/{pid}/render", opts)

    def render_status(self, pid: str) -> dict:
        return self._get(f"/projects/{pid}/render")

    def assets(self, pid: str) -> dict:
        return self._get(f"/projects/{pid}/assets")
