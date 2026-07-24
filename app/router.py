"""Application configuration - root APIRouter.

Defines all FastAPI application endpoints.

Resources:
    1. https://fastapi.tiangolo.com/tutorial/bigger-applications

"""

from fastapi import APIRouter

from app.controllers.v1 import (
    config,
    jobs,
    llm,
    metrics,
    projects,
    prompt_templates,
    publications,
    system,
    video,
    workspaces,
)

root_api_router = APIRouter()
# v1
root_api_router.include_router(video.router)
root_api_router.include_router(llm.router)
root_api_router.include_router(projects.router)
root_api_router.include_router(config.router)
root_api_router.include_router(workspaces.router)
root_api_router.include_router(prompt_templates.router)
root_api_router.include_router(system.router)
root_api_router.include_router(jobs.router)
root_api_router.include_router(publications.router)
root_api_router.include_router(metrics.router)
