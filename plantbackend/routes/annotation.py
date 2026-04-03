"""Annotation, dataset, and augmentation routes."""

from fastapi import APIRouter

try:
    from .. import api_router as handlers
    from ..schemas import AnnotationAugmentResponse, AnnotationClassesResponse, AnnotationSaveResponse, AnnotationSourceImageDetailResponse
except ImportError:
    import api_router as handlers
    from schemas import AnnotationAugmentResponse, AnnotationClassesResponse, AnnotationSaveResponse, AnnotationSourceImageDetailResponse


router = APIRouter(tags=["annotation"])
router.add_api_route(
    "/annotation/classes",
    handlers.annotation_classes,
    methods=["GET"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/datasets",
    handlers.create_dataset,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/datasets/import-folder",
    handlers.import_dataset_from_folder,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route("/annotation/datasets/{dataset_name}/download", handlers.download_annotation_dataset, methods=["GET"])
router.add_api_route(
    "/annotation/source-images/upload",
    handlers.upload_annotation_source_images,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/source-images/{dataset_name}/{image_name}",
    handlers.download_annotation_source_image,
    methods=["GET"],
)
router.add_api_route(
    "/annotation/source-images/{dataset_name}/{image_name}/detail",
    handlers.get_annotation_source_image_detail,
    methods=["GET"],
    response_model=AnnotationSourceImageDetailResponse,
)
router.add_api_route(
    "/annotation/datasets/delete",
    handlers.remove_dataset,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/classes",
    handlers.create_annotation_class,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/classes/delete",
    handlers.remove_annotation_class,
    methods=["POST"],
    response_model=AnnotationClassesResponse,
)
router.add_api_route(
    "/annotation/augment",
    handlers.augment_annotation_dataset,
    methods=["POST"],
    response_model=AnnotationAugmentResponse,
)
router.add_api_route(
    "/annotation/save",
    handlers.save_annotation,
    methods=["POST"],
    response_model=AnnotationSaveResponse,
)
