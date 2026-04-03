# Project Feature Inventory

This project already uses a Python backend and a Vue frontend.

## Backend stack

- Python + FastAPI application entry:
  [plantbackend/factory.py](/d:/-yolo--main/-yolo--main/plantbackend/factory.py)
  [plantbackend/asgi.py](/d:/-yolo--main/-yolo--main/plantbackend/asgi.py)
  [plantbackend/__main__.py](/d:/-yolo--main/-yolo--main/plantbackend/__main__.py)
- Core route handlers:
  [plantbackend/api_router.py](/d:/-yolo--main/-yolo--main/plantbackend/api_router.py)
- Shared services:
  [plantbackend/model_service.py](/d:/-yolo--main/-yolo--main/plantbackend/model_service.py)
  [plantbackend/auth_store.py](/d:/-yolo--main/-yolo--main/plantbackend/auth_store.py)
  [plantbackend/ai_advice_service.py](/d:/-yolo--main/-yolo--main/plantbackend/ai_advice_service.py)
  [plantbackend/admin_asset_service.py](/d:/-yolo--main/-yolo--main/plantbackend/admin_asset_service.py)
  [plantbackend/augmentation_manager.py](/d:/-yolo--main/-yolo--main/plantbackend/augmentation_manager.py)

## Frontend stack

- Vue application entry:
  [frontend/src/main.js](/d:/-yolo--main/-yolo--main/frontend/src/main.js)
  [frontend/src/App.vue](/d:/-yolo--main/-yolo--main/frontend/src/App.vue)
- Workspace configuration:
  [frontend/src/appConfig.js](/d:/-yolo--main/-yolo--main/frontend/src/appConfig.js)
  [frontend/src/workspaces/registry.js](/d:/-yolo--main/-yolo--main/frontend/src/workspaces/registry.js)
- Session and API clients:
  [frontend/src/composables/useSession.js](/d:/-yolo--main/-yolo--main/frontend/src/composables/useSession.js)
  [frontend/src/lib/session.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/session.js)
  [frontend/src/lib/api.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/api.js)
  [frontend/src/lib/plantApi.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/plantApi.js)
  [frontend/src/lib/adminApi.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/adminApi.js)

## Functional modules

### 1. System and session

- Health check and root status endpoint.
- User registration, login, session restore, and logout.
- Local encrypted token persistence on the frontend.
- Role-aware workspace visibility.

### 2. Disease recognition workspace

- Image upload recognition.
- Camera recognition flow.
- Screen capture recognition flow.
- Real-time recognition loop with threshold and FPS controls.
- Model switching before inference.
- Top predictions, detection boxes, and confidence display.
- Visualization export for result views.
- AI advice generation from prediction results.
- Recognition result handoff into annotation workflow.

Main files:
- [frontend/src/components/recognition/RecognitionWorkspace.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/recognition/RecognitionWorkspace.vue)
- [frontend/src/components/recognition/components/RecognitionPictureInPicture.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/recognition/components/RecognitionPictureInPicture.vue)
- [frontend/src/lib/plantApi.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/plantApi.js)

### 3. Annotation and dataset workspace

- Annotation dataset creation.
- Dataset cloning or template-based creation.
- Folder import for YOLO-style datasets.
- Raw image upload into a dataset.
- Dataset archive download.
- Dataset deletion.
- Class creation and deletion.
- Class-level AI knowledge/advice caching.
- Source image detail loading.
- Bounding box drawing, editing, deletion, and save.
- Recognition result assisted annotation.
- Focus overlay for concentrated labeling work.
- Dataset augmentation and train/val split rebuild.
- Training task launch and polling.

Main files:
- [frontend/src/components/annotation/AnnotationWorkspace.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/AnnotationWorkspace.vue)
- [frontend/src/components/annotation/components/DatasetControls.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/DatasetControls.vue)
- [frontend/src/components/annotation/components/DatasetBoard.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/DatasetBoard.vue)
- [frontend/src/components/annotation/components/AnnotateControls.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/AnnotateControls.vue)
- [frontend/src/components/annotation/components/AnnotateBoard.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/AnnotateBoard.vue)
- [frontend/src/components/annotation/components/FocusOverlay.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/FocusOverlay.vue)
- [frontend/src/components/annotation/components/TrainingControls.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/TrainingControls.vue)
- [frontend/src/components/annotation/components/TrainingBoard.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/annotation/components/TrainingBoard.vue)

### 4. Model asset management

- Model upload with optional labels and metadata.
- Public/private model ownership.
- Model archive download.
- Model deletion.
- Active model switching.
- Synchronous training and async training task tracking.

Main files:
- [frontend/src/components/details/DetailsWorkspace.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/details/DetailsWorkspace.vue)
- [plantbackend/model_service.py](/d:/-yolo--main/-yolo--main/plantbackend/model_service.py)
- [plantbackend/train_yolo.py](/d:/-yolo--main/-yolo--main/plantbackend/train_yolo.py)

### 5. Admin console

- User list and user moderation.
- User disable/flag/delete operations.
- Admin model upload.
- Admin dataset archive upload.
- Admin augmentation script upload.
- Active augmentation script switching.
- Shared asset visibility management through admin workflows.

Main files:
- [frontend/src/components/admin/AdminWorkspace.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/admin/AdminWorkspace.vue)
- [frontend/src/lib/adminApi.js](/d:/-yolo--main/-yolo--main/frontend/src/lib/adminApi.js)

### 6. Shared UI and infrastructure

- Branded entry shell and auth dialog.
- Shared workspace navigation.
- Shared file picker field.
- Centralized style tokens and shell styles.

Main files:
- [frontend/src/components/shared/AuthDialog.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/shared/AuthDialog.vue)
- [frontend/src/components/shared/BrandMark.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/shared/BrandMark.vue)
- [frontend/src/components/shared/WorkspaceNav.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/shared/WorkspaceNav.vue)
- [frontend/src/components/shared/FileField.vue](/d:/-yolo--main/-yolo--main/frontend/src/components/shared/FileField.vue)

## Refactor direction used in this pass

- Keep Python as the backend language and FastAPI as the app layer.
- Keep Vue as the frontend framework and preserve the current UI behavior.
- Split backend route registration into grouped modules without changing public endpoints.
- Move frontend workspace component registration out of `App.vue`.
- Add a human-readable feature inventory to support further phased refactors.
