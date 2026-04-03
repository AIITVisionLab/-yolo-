"""System and health routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import HealthResponse
except ImportError:
    import api_router as handlers
    from schemas import HealthResponse


router = APIRouter(tags=["system"])
router.add_api_route("/", handlers.root, methods=["GET"], response_model=HealthResponse)
router.add_api_route("/health", handlers.health, methods=["GET"], response_model=HealthResponse)
