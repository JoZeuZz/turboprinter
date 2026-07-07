"""Application implementation - ASGI."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Scope

from app.config import config
from app.models.exception import HttpException
from app.router import root_api_router
from app.utils import utils


def exception_handler(request: Request, e: HttpException):
    return JSONResponse(
        status_code=e.status_code,
        content=utils.get_response(e.status_code, e.data, e.message),
    )


def validation_exception_handler(request: Request, e: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content=utils.get_response(
            status=400, data=e.errors(), message="field required"
        ),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup event")
    yield
    logger.info("shutdown event")


def get_application() -> FastAPI:
    """Initialize FastAPI application.

    Returns:
       FastAPI: Application object instance.

    """
    instance = FastAPI(
        title=config.project_name,
        description=config.project_description,
        version=config.project_version,
        debug=False,
        lifespan=lifespan,
    )
    instance.include_router(root_api_router)
    instance.add_exception_handler(HttpException, exception_handler)
    instance.add_exception_handler(RequestValidationError, validation_exception_handler)
    return instance


app = get_application()


def _resolve_cors_config(cors_allowed_origins_str: str):
    """Return (origins, allow_credentials) for the CORS middleware.

    With an explicit comma-separated allow-list of real origins, credentials are
    allowed. With no allow-list, or if any entry is "*", we fall back to wildcard
    origins with credentials DISABLED: Starlette reflects the request Origin when
    allow_credentials is True and "*" is in allow_origins, which would authorize
    any origin to send credentials — a known security misconfiguration.
    """
    cleaned = [o.strip() for o in cors_allowed_origins_str.split(",") if o.strip()]
    if cleaned and "*" not in cleaned:
        return cleaned, True
    return ["*"], False


# Configures the CORS middleware for the FastAPI app
cors_allowed_origins_str = os.getenv("CORS_ALLOWED_ORIGINS", "")
origins, allow_credentials = _resolve_cors_config(cors_allowed_origins_str)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

class _PrivateMetaStaticFiles(StaticFiles):
    """StaticFiles that blocks direct access to task `_meta/` files.

    `_meta/` holds scripts, render manifests and word timestamps that must
    stay private even though they live under the same on-disk task directory
    as public assets (video, audio, thumbnails). Excluding them here (rather
    than only omitting them from a listing endpoint) closes the gap where
    `/tasks/<id>/_meta/<file>` was directly fetchable by anyone who could
    reach the mount and guess/know the filename.
    """

    async def get_response(self, path: str, scope: Scope):
        if "_meta" in path.replace("\\", "/").split("/"):
            raise StarletteHTTPException(status_code=404)
        return await super().get_response(path, scope)


task_dir = utils.task_dir()
app.mount(
    "/tasks",
    _PrivateMetaStaticFiles(directory=task_dir, html=True, follow_symlink=False),
    name="",
)

public_dir = utils.public_dir()
app.mount("/", StaticFiles(directory=public_dir, html=True), name="")


