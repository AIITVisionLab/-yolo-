"""Authentication routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import AuthSessionResponse
except ImportError:
    import api_router as handlers
    from schemas import AuthSessionResponse


router = APIRouter(tags=["auth"])
router.add_api_route("/auth/login", handlers.auth_login, methods=["POST"], response_model=AuthSessionResponse)
router.add_api_route("/auth/register", handlers.auth_register, methods=["POST"], response_model=AuthSessionResponse)
router.add_api_route("/auth/session", handlers.auth_session, methods=["GET"], response_model=AuthSessionResponse)
router.add_api_route("/auth/logout", handlers.auth_logout, methods=["POST"], response_model=AuthSessionResponse)
