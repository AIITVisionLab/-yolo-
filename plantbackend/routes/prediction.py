"""Prediction and AI recommendation routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import AiRecommendationResponse, PredictResponse
except ImportError:
    import api_router as handlers
    from schemas import AiRecommendationResponse, PredictResponse


router = APIRouter(tags=["prediction"])
router.add_api_route(
    "/ai/recommendation",
    handlers.get_ai_recommendation,
    methods=["POST"],
    response_model=AiRecommendationResponse,
)
router.add_api_route("/predict", handlers.predict, methods=["POST"], response_model=PredictResponse)
