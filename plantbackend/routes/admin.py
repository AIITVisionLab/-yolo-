"""Administrator routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import AdminConsoleResponse, AnnotationClassesResponse, UsersResponse
except ImportError:
    import api_router as handlers
    from schemas import AdminConsoleResponse, AnnotationClassesResponse, UsersResponse


router = APIRouter(tags=["admin"])
router.add_api_route("/users", handlers.list_users, methods=["GET"], response_model=UsersResponse)
router.add_api_route(
    "/admin/users/{user_id}/disabled",
    handlers.set_user_disabled,
    methods=["POST"],
    response_model=UsersResponse,
)
router.add_api_route(
    "/admin/users/{user_id}/flagged",
    handlers.set_user_flagged,
    methods=["POST"],
    response_model=UsersResponse,
)
router.add_api_route(
    "/admin/users/{user_id}",
    handlers.delete_user,
    methods=["DELETE"],
    response_model=UsersResponse,
)
router.add_api_route("/admin/console", handlers.get_admin_console, methods=["GET"], response_model=AdminConsoleResponse)
router.add_api_route(
    "/admin/models/upload",
    handlers.admin_upload_model,
    methods=["POST"],
    response_model=AdminConsoleResponse,
)
router.add_api_route(
    "/admin/datasets/upload",
    handlers.admin_upload_dataset,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/admin/augmentations/upload",
    handlers.admin_upload_augmentation_script,
    methods=["POST"],
    response_model=AdminConsoleResponse,
)
router.add_api_route(
    "/admin/augmentations/select",
    handlers.admin_select_augmentation_script,
    methods=["POST"],
    response_model=AdminConsoleResponse,
)
router.add_api_route(
    "/admin/augmentations/{script_name}",
    handlers.admin_delete_augmentation_script,
    methods=["DELETE"],
    response_model=AdminConsoleResponse,
)
