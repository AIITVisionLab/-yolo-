"""Model asset and training routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import ModelTrainResponse, ModelTrainTaskResponse, ModelsResponse
except ImportError:
    import api_router as handlers
    from schemas import ModelTrainResponse, ModelTrainTaskResponse, ModelsResponse


router = APIRouter(tags=["models"])
router.add_api_route("/models/upload", handlers.upload_model, methods=["POST"], response_model=ModelsResponse)
router.add_api_route("/models", handlers.list_models, methods=["GET"], response_model=ModelsResponse)
router.add_api_route("/models/{model_name}/download", handlers.download_model, methods=["GET"])
router.add_api_route("/models/delete", handlers.remove_model, methods=["POST"], response_model=ModelsResponse)
router.add_api_route("/models/select", handlers.select_model, methods=["POST"], response_model=ModelsResponse)
router.add_api_route("/models/train", handlers.train_model, methods=["POST"], response_model=ModelTrainResponse)
router.add_api_route(
    "/models/train/tasks",
    handlers.start_train_model_task,
    methods=["POST"],
    response_model=ModelTrainTaskResponse,
)
router.add_api_route(
    "/models/train/tasks/{task_id}",
    handlers.get_train_model_task,
    methods=["GET"],
    response_model=ModelTrainTaskResponse,
)
