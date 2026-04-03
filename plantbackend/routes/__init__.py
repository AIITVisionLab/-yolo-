"""Composable route groups for the Plant backend."""

from fastapi import APIRouter

from .admin import router as admin_router
from .annotation import router as annotation_router
from .auth import router as auth_router
from .models import router as models_router
from .prediction import router as prediction_router
from .system import router as system_router


def build_api_router() -> APIRouter:
    router = APIRouter()
    router.include_router(system_router)
    router.include_router(auth_router)
    router.include_router(admin_router)
    router.include_router(models_router)
    router.include_router(annotation_router)
    router.include_router(prediction_router)
    return router
