from fastapi import Request

from app.controllers.v1.base import new_router
from app.config import config
from app.utils import utils

router = new_router()

_VIDEO_SOURCES = ["pexels", "pixabay", "local"]


@router.get("/config", summary="Get safe UI configuration")
def get_ui_config(request: Request):
    data = {
        "video_sources": _VIDEO_SOURCES,
        "subtitle_position_default": config.ui.get("subtitle_position", "bottom"),
        "custom_position_default": float(config.ui.get("custom_position", 70.0)),
    }
    return utils.get_response(200, data)
