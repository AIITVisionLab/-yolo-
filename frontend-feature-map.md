# 功能文件对照

这份文档用于快速定位“某个功能写在哪个文件里”。

项目根目录：`d:\-yolo--main\-yolo--main`

## 1. 应用入口

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 前端启动入口 | `frontend/src/main.js` | `frontend/index.html` | Vue 应用挂载入口，负责启动 `App.vue`。 |
| 前端顶层壳层 | `frontend/src/App.vue` | `frontend/src/appConfig.js` | 登录弹窗、工作区切换、页面框架都在这里。 |
| 工作区注册表 | `frontend/src/workspaces/registry.js` | `frontend/src/App.vue` | 统一注册识别、标注、资产、管理等页面组件。 |
| 后端应用工厂 | `plantbackend/factory.py` | `plantbackend/app.py` | 创建 FastAPI 应用并挂载总路由。 |
| 后端部署入口 | `plantbackend/asgi.py` | `plantbackend/__main__.py` | `uvicorn` 导入入口和命令行启动入口。 |

## 2. 认证与会话

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 登录/注册弹窗 | `frontend/src/components/shared/AuthDialog.vue` | `frontend/src/App.vue` | 实际使用中的认证弹窗。 |
| 会话状态管理 | `frontend/src/composables/useSession.js` | `frontend/src/lib/session.js` | 登录、注册、退出、恢复登录态。 |
| 本地 token 存储 | `frontend/src/lib/session.js` | `frontend/src/appConfig.js` | 浏览器端 token 读写和清理。 |
| 认证接口 | `plantbackend/routes/auth.py` | `plantbackend/api_router.py` | 注册认证相关路由。 |
| 用户与会话存储 | `plantbackend/auth_store.py` | `plantbackend/routes/auth.py` | 用户、会话、权限相关数据库读写。 |

## 3. 基础 API 与数据访问

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 前端通用请求封装 | `frontend/src/lib/api.js` | `frontend/vite.config.js` | 所有前端 API 请求公共入口。 |
| 识别/标注/模型接口 | `frontend/src/lib/plantApi.js` | `frontend/src/lib/api.js` | 普通用户功能的 API 调用封装。 |
| 管理后台接口 | `frontend/src/lib/adminApi.js` | `frontend/src/lib/api.js` | 管理员功能的 API 调用封装。 |
| 后端总处理逻辑 | `plantbackend/api_router.py` | `plantbackend/routes/__init__.py` | 当前大部分后端业务处理函数都在这里。 |

## 4. 健康检查与系统状态

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 根路径与健康检查 | `plantbackend/routes/system.py` | `plantbackend/api_router.py` | `/` 和 `/health` 路由注册。 |
| 前端健康状态展示 | `frontend/src/App.vue` | `frontend/src/lib/api.js` | 顶层页面展示后端在线/离线状态。 |

## 5. 病害识别工作区

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 识别主页面 | `frontend/src/components/recognition/RecognitionWorkspace.vue` | `frontend/src/lib/plantApi.js` | 图片上传、摄像头、录屏、实时识别、结果展示。 |
| 识别悬浮小窗 | `frontend/src/components/recognition/components/RecognitionPictureInPicture.vue` | `frontend/src/components/recognition/RecognitionWorkspace.vue` | 实时识别的小窗和关键结果摘要。 |
| 模型列表与预测请求 | `frontend/src/lib/plantApi.js` | `frontend/src/lib/api.js` | `fetchModels`、`predictImage` 等识别接口。 |
| 识别结果文案整理 | `frontend/src/lib/plantPresentation.js` | `frontend/src/components/recognition/RecognitionWorkspace.vue` | 类别名称、病害说明、展示文案映射。 |
| 图片文件校验 | `frontend/src/lib/imageFiles.js` | `frontend/src/components/recognition/RecognitionWorkspace.vue` | 上传前校验图片格式和大小。 |
| 结果文件下载 | `frontend/src/lib/download.js` | `frontend/src/components/recognition/RecognitionWorkspace.vue` | 下载识别结果图或其他 blob 文件。 |
| 识别路由注册 | `plantbackend/routes/prediction.py` | `plantbackend/api_router.py` | `/predict` 和 AI 建议路由注册。 |
| 模型推理服务 | `plantbackend/model_service.py` | `plantbackend/routes/prediction.py` | 识别推理、模型加载、阈值控制。 |
| AI 建议服务 | `plantbackend/ai_advice_service.py` | `plantbackend/api_router.py` | 基于预测结果生成病害建议。 |

## 6. 标注与训练工作区

### 6.1 总控页面

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 标注训练总页面 | `frontend/src/components/annotation/AnnotationWorkspace.vue` | `frontend/src/lib/plantApi.js` | 串起数据集、标注、增强、训练三个阶段。 |

### 6.2 数据集准备

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 数据集操作侧栏 | `frontend/src/components/annotation/components/DatasetControls.vue` | `frontend/src/components/annotation/AnnotationWorkspace.vue` | 创建、克隆、导入、删除数据集，上传原始图片，管理类别。 |
| 数据集展示面板 | `frontend/src/components/annotation/components/DatasetBoard.vue` | `frontend/src/components/annotation/components/DatasetControls.vue` | 数据集状态、类别信息、图片数量等概览。 |

### 6.3 标注画布

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 标注操作侧栏 | `frontend/src/components/annotation/components/AnnotateControls.vue` | `frontend/src/components/annotation/AnnotationWorkspace.vue` | 选择图片、保存标注、导入识别框、删除框。 |
| 标注主画布 | `frontend/src/components/annotation/components/AnnotateBoard.vue` | `frontend/src/components/annotation/components/FocusOverlay.vue` | 画框、编辑框、查看图片和标注详情。 |
| 专注标注浮层 | `frontend/src/components/annotation/components/FocusOverlay.vue` | `frontend/src/components/annotation/components/AnnotateBoard.vue` | 全屏专注标注模式。 |

### 6.4 增强与训练

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 训练参数面板 | `frontend/src/components/annotation/components/TrainingControls.vue` | `frontend/src/components/annotation/AnnotationWorkspace.vue` | 数据增强参数、训练参数、启动训练。 |
| 训练结果面板 | `frontend/src/components/annotation/components/TrainingBoard.vue` | `frontend/src/components/annotation/components/TrainingControls.vue` | 训练状态、进度、训练结果摘要。 |
| 训练脚本 | `plantbackend/train_yolo.py` | `plantbackend/api_router.py` | YOLO 训练和导出逻辑。 |
| 增强管理 | `plantbackend/augmentation_manager.py` | `plantbackend/augment_yolo.py` | 数据增强脚本管理与增强执行。 |

### 6.5 标注训练接口

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 标注与数据集路由 | `plantbackend/routes/annotation.py` | `plantbackend/api_router.py` | 标注、数据集、增强、图片详情等路由注册。 |
| 标注与数据集接口封装 | `frontend/src/lib/plantApi.js` | `frontend/src/components/annotation/AnnotationWorkspace.vue` | 数据集创建、导入、下载、删除、类别管理。 |
| 标注保存接口 | `frontend/src/lib/plantApi.js` | `frontend/src/components/annotation/components/AnnotateBoard.vue` | 保存单张图片的标注结果。 |
| 训练任务接口 | `frontend/src/lib/plantApi.js` | `frontend/src/components/annotation/components/TrainingBoard.vue` | 启动训练、轮询训练任务状态。 |

## 7. 模型资产工作区

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 模型资产页面 | `frontend/src/components/details/DetailsWorkspace.vue` | `frontend/src/lib/plantApi.js` | 上传模型、查看模型列表、下载模型、切换当前模型。 |
| 通用文件上传组件 | `frontend/src/components/shared/FileField.vue` | `frontend/src/components/details/DetailsWorkspace.vue` | 模型、标签、元数据等文件上传控件。 |
| 模型资产路由 | `plantbackend/routes/models.py` | `plantbackend/api_router.py` | 模型上传、删除、选择、下载、训练路由注册。 |
| 模型资产服务 | `plantbackend/model_service.py` | `plantbackend/admin_asset_service.py` | 模型文件管理、当前模型切换、推理依赖。 |
| 管理资源文件处理 | `plantbackend/admin_asset_service.py` | `plantbackend/routes/models.py` | 上传文件保存、模型与增强脚本资产处理。 |

## 8. 管理后台

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 管理员主页面 | `frontend/src/components/admin/AdminWorkspace.vue` | `frontend/src/lib/adminApi.js` | 用户管理、模型管理、数据集管理、增强脚本管理。 |
| 管理员接口层 | `frontend/src/lib/adminApi.js` | `frontend/src/lib/api.js` | 用户封禁、标记、删除，后台上传等接口。 |
| 管理后台路由 | `plantbackend/routes/admin.py` | `plantbackend/api_router.py` | 管理员控制台、用户管理、后台上传路由注册。 |
| 用户和资源权限判断 | `plantbackend/auth_store.py` | `plantbackend/api_router.py` | 用户角色、资源归属、公开/私有权限控制。 |

## 9. 样式文件

### 9.1 总入口

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 样式总入口 | `frontend/src/styles/index.css` |  | 汇总导入所有全局样式。 |
| 设计 token | `frontend/src/styles/tokens.css` | `frontend/src/styles/variables.css` | 颜色、圆角、阴影、字体等设计变量。 |
| 基础全局样式 | `frontend/src/styles/base.css` |  | `body`、按钮、基础排版等全局样式。 |

### 9.2 壳层样式

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 壳层样式总入口 | `frontend/src/styles/shell/index.css` |  | 导入壳层相关分类样式。 |
| 页面外壳与 landing | `frontend/src/styles/shell/layout.css` | `frontend/src/App.vue` | 顶层框架、landing、console shell。 |
| 导航样式 | `frontend/src/styles/shell/navigation.css` | `frontend/src/components/shared/WorkspaceNav.vue` | 左侧导航、顶部导航、工作区导航样式。 |
| 登录弹窗样式 | `frontend/src/styles/shell/auth-dialog.css` | `frontend/src/components/shared/AuthDialog.vue` | 登录/注册弹窗样式。 |

### 9.3 工作区样式

| 功能 | 主要文件 | 相关文件 | 说明 |
| --- | --- | --- | --- |
| 工作区样式总入口 | `frontend/src/styles/workspaces/index.css` |  | 导入识别、标注、资产、管理等分类样式。 |
| 工作区公共样式 | `frontend/src/styles/workspaces/shared.css` | 多个工作区页面 | 通用面板、输入框、按钮、空状态等样式。 |
| 识别工作区样式 | `frontend/src/styles/workspaces/recognition.css` | `frontend/src/components/recognition/RecognitionWorkspace.vue` | 识别页专属布局和结果样式。 |
| 标注工作区样式 | `frontend/src/styles/workspaces/annotation.css` | 标注相关组件 | 数据集、标注、训练相关样式。 |
| 资产工作区样式 | `frontend/src/styles/workspaces/assets.css` | `frontend/src/components/details/DetailsWorkspace.vue` | 模型资产列表、卡片、操作区样式。 |
| 管理后台样式 | `frontend/src/styles/workspaces/admin.css` | `frontend/src/components/admin/AdminWorkspace.vue` | 用户卡片、增强脚本区、管理页样式。 |

## 10. 示例包装文件

## 11. 常见改动先看哪里

| 想改的功能 | 先看哪个文件 |
| --- | --- |
| 首页、登录入口、工作区切换 | `frontend/src/App.vue` |
| 登录弹窗内容和交互 | `frontend/src/components/shared/AuthDialog.vue` |
| 左侧导航 | `frontend/src/components/shared/WorkspaceNav.vue` |
| 识别页 | `frontend/src/components/recognition/RecognitionWorkspace.vue` |
| 识别悬浮窗 | `frontend/src/components/recognition/components/RecognitionPictureInPicture.vue` |
| 数据集准备页 | `frontend/src/components/annotation/components/DatasetBoard.vue` |
| 数据集操作侧栏 | `frontend/src/components/annotation/components/DatasetControls.vue` |
| 标注画布 | `frontend/src/components/annotation/components/AnnotateBoard.vue` |
| 标注侧栏 | `frontend/src/components/annotation/components/AnnotateControls.vue` |
| 专注标注层 | `frontend/src/components/annotation/components/FocusOverlay.vue` |
| 训练页面 | `frontend/src/components/annotation/components/TrainingBoard.vue` |
| 训练参数面板 | `frontend/src/components/annotation/components/TrainingControls.vue` |
| 模型资产页面 | `frontend/src/components/details/DetailsWorkspace.vue` |
| 管理员控制台 | `frontend/src/components/admin/AdminWorkspace.vue` |
| 后端认证逻辑 | `plantbackend/routes/auth.py`、`plantbackend/auth_store.py` |
| 后端标注与训练逻辑 | `plantbackend/routes/annotation.py`、`plantbackend/api_router.py` |
| 后端模型与预测逻辑 | `plantbackend/routes/models.py`、`plantbackend/routes/prediction.py`、`plantbackend/model_service.py` |

## 12. 文档位置

当前这份文档的路径是：

`d:\-yolo--main\-yolo--main\frontend-feature-map.md`
