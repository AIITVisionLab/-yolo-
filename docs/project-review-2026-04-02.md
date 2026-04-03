# 项目审视报告

审视日期：2026-04-02

后续修复说明：该报告基于 2026-04-02 当时工作区现态生成。报告完成后，已补上前端默认端口与 `strictPort`、`.venv-train` 启动脚本探测、Compose 对知识库/增强脚本状态的持久化挂载、清理与打包脚本边界，以及根 `README.md` 的关键漂移项。

## 1. 审视范围与方法

本次审视基于当前工作区的真实文件内容完成，重点检查了以下目录与文件：

- `frontend/src`、`frontend/tests/e2e`
- `plantbackend`
- `deploy`
- `tools`
- 根目录 `README.md`、`frontend-feature-map.md`、`MODEL_UPLOAD_FIX_README.md`
- `docs/` 下已有文档

补充说明：

- 当前目录不是一个已初始化的 Git 仓库，因此这次审视无法利用提交历史、分支信息或 blame 信息，只能基于现态文件判断。
- 我额外做了两项轻量验证：
  - `python3 -m py_compile plantbackend/app.py plantbackend/asgi.py plantbackend/api_router.py plantbackend/auth_store.py plantbackend/model_service.py plantbackend/knowledge_base_service.py plantbackend/knowledge_store.py` 通过。
  - 前端构建未能在当前 Linux/WSL 环境直接完成，原因不是源码语法错误，而是当前 `frontend/node_modules` 来自其他平台：第一次失败于 `frontend/node_modules/.bin/vite` 权限，随后改用 `node ./node_modules/vite/bin/vite.js build` 继续失败，`esbuild` 明确提示当前目录存在 `@esbuild/win32-x64`，但本机需要 `@esbuild/linux-x64`。

## 2. 一句话结论

这是一个已经具备完整业务闭环的植物病害平台：前端负责识别、标注、训练、模型资产与管理台，后端负责认证、推理、数据集管理、增强、训练导出和 AI 建议；但当前项目同时存在明显的文档漂移、运行数据与源码混放、后端核心逻辑集中、训练任务状态存于内存、以及生产持久化边界不完整等结构性问题。

## 3. 项目定位与技术栈

### 3.1 项目定位

从代码真实能力看，这个项目不是单纯的“图片识别 Demo”，而是一个围绕植物病害识别建立的工作台，覆盖了：

- 用户注册、登录、会话恢复
- ONNX 模型推理
- 识别结果展示与 AI 建议
- 数据集创建、导入、类别维护、框选标注
- 数据增强、YOLO 训练、ONNX 导出
- 模型上传、切换、下载、删除
- 管理员对用户、模型、数据集、增强脚本的统一管理

### 3.2 实际技术栈

- 前端：Vue 3 + Vite + Playwright
- 后端：Python + FastAPI + Uvicorn
- 推理：ONNX Runtime
- 训练：Ultralytics YOLO + PyTorch
- 持久化：SQLite
- 部署：Docker Compose + Nginx
- AI 建议：OpenAI 兼容接口 + 本地内置回退

## 4. 仓库现状

### 4.1 目录职责

- `frontend/`：Vue 单页应用，包含四个工作区与 E2E 测试
- `plantbackend/`：FastAPI 服务、推理、认证、知识库、增强、训练
- `deploy/`：Dockerfile、Compose、Nginx 配置
- `tools/`：烟雾检查、全链路回归、打包、清理脚本
- `docs/`：已有项目盘点文档与测试问题报告
- `output/`：示例数据与演示产物

### 4.2 源码与运行数据混放

当前工作区不只是源码仓库，而是“源码 + 依赖 + 模型 + 训练产物 + 临时文件”的混合状态：

- 工作区总体积约 `2.0G`
- `frontend/node_modules` 约 `35M`
- `frontend/dist` 约 `436K`
- `plantbackend/models` 约 `20M`
- `plantbackend/training_runs` 约 `181M`
- `plantbackend/annotation_datasets` 约 `664K`

这类混放方式对本地调试方便，但会削弱以下能力：

- 目录可移植性
- 构建环境一致性
- 交付包边界清晰度
- 文档与实际状态的一致性

### 4.3 代码体量概览

按 `frontend/src`、`plantbackend`、`deploy`、`tools`、`docs` 中的源码/配置/文档文本文件统计，当前约有：

- 90 个核心文本类文件
- 28617 行文本内容

其中最重的几个文件是：

- `plantbackend/api_router.py`：3509 行
- `frontend/src/components/recognition/RecognitionWorkspace.vue`：2779 行
- `frontend/src/components/annotation/AnnotationWorkspace.vue`：1413 行
- `plantbackend/ai_advice_service.py`：1233 行
- `frontend/src/components/admin/AdminWorkspace.vue`：1060 行
- `frontend/src/components/details/DetailsWorkspace.vue`：866 行
- `plantbackend/auth_store.py`：772 行

这说明当前项目的复杂度已经不低，而且复杂度集中在少数“大文件”里。

## 5. 前端架构总结

### 5.1 顶层结构

前端入口是：

- `frontend/src/main.js`
- `frontend/src/App.vue`
- `frontend/src/appConfig.js`
- `frontend/src/workspaces/registry.js`

`App.vue` 承担了顶层壳层职责：

- 区分未登录 landing 与已登录 console shell
- 管理工作区切换
- 轮询后端健康状态
- 管理认证弹窗
- 把会话、识别结果等状态传递给子工作区

前端真实框架是 Vue 3，不是 React。

### 5.2 四个工作区

前端按工作区组织，四个核心页面分别是：

- `recognition`：病害识别
- `annotation`：标注与训练
- `details`：模型资产
- `admin`：平台管理

#### 识别工作区

`frontend/src/components/recognition/RecognitionWorkspace.vue` 不是简单上传页，而是一个较完整的识别控制台，具备：

- 图片上传识别
- 摄像头采集
- 屏幕共享
- 屏幕录制与下载
- 轻量实时识别循环
- 画中画窗口
- 识别框与热力图双视图
- 模型切换
- 知识库数据集选择
- AI 分析展示
- 一键把识别结果送去标注

这是整个前端里功能最丰富的单页模块之一。

#### 标注与训练工作区

`frontend/src/components/annotation/AnnotationWorkspace.vue` 把标注闭环串在一个页面中，主要能力包括：

- 数据集切换
- 按模板创建数据集
- 复制现有类别库创建数据集
- 导入本地 YOLO 数据集目录
- 上传原始图片
- 类别创建/删除
- 类别知识库建议
- 标注框绘制、选择、删除、保存
- 从识别结果导入检测框
- 专注标注模式
- 执行增强并重建 `train/val`
- 发起训练任务并轮询进度

从职责看，这个页面已经接近一个小型“前端应用中的前端应用”。

#### 模型资产工作区

`frontend/src/components/details/DetailsWorkspace.vue` 负责：

- 浏览当前可访问模型
- 上传个人模型
- 下载模型归档
- 删除可管理模型
- 管理员切换当前在线模型
- 为管理员提供 `/docs` 和 `/openapi.json` 的快捷入口

#### 管理台工作区

`frontend/src/components/admin/AdminWorkspace.vue` 负责：

- 用户列表与封禁/关注/删除
- 管理员模型上传
- 数据集 ZIP 或目录导入
- 增强脚本上传与切换
- 查看平台模型、数据集、用户、增强脚本

### 5.3 前端会话与安全存储

会话逻辑集中在：

- `frontend/src/composables/useSession.js`
- `frontend/src/lib/session.js`

其特点是：

- 令牌优先走浏览器 `IndexedDB + Web Crypto AES-GCM` 加密封装
- 如果环境不支持，再退回普通 `localStorage`
- 登录、注册、恢复会话、退出都已经封装完整
- 顶层页面会监听存储变化并同步会话状态

这块设计明显比普通演示项目更认真。

### 5.4 前端接口层

接口调用分为三层：

- `frontend/src/lib/api.js`：通用请求封装
- `frontend/src/lib/plantApi.js`：普通业务接口
- `frontend/src/lib/adminApi.js`：管理员接口

这种分层方式是合理的，也让工作区组件不会直接把所有 `fetch` 细节写死在模板里。

### 5.5 前端测试

前端存在 Playwright E2E：

- `frontend/tests/e2e/ui-core.spec.cjs`
- `frontend/tests/e2e/auth-persistence.spec.cjs`
- `frontend/tests/e2e/helpers.cjs`

覆盖范围包括：

- 管理员登录
- 识别主流程
- 送去标注
- 模型资产页访问
- 管理页访问
- 会话持久化
- 标注框绘制

但这些测试依赖外部运行环境，不是自启动测试。

## 6. 后端架构总结

### 6.1 应用入口

后端入口拆分得比较清楚：

- `plantbackend/factory.py`：创建 FastAPI 应用
- `plantbackend/app.py`：兼容导入壳层
- `plantbackend/asgi.py`：稳定 ASGI 入口
- `plantbackend/__main__.py`：`python -m plantbackend` 启动入口

这部分结构是干净的。

### 6.2 路由层真实状态

虽然目录里已经有：

- `plantbackend/routes/system.py`
- `plantbackend/routes/auth.py`
- `plantbackend/routes/models.py`
- `plantbackend/routes/annotation.py`
- `plantbackend/routes/admin.py`
- `plantbackend/routes/prediction.py`

但真实业务逻辑仍然集中在 `plantbackend/api_router.py`。`routes/` 目前主要做的是“按域注册路由”，实际 handler 仍然引用 `api_router.py` 中的函数。

这意味着后端已经开始做模块化过渡，但还没有完成真正的业务拆分。

### 6.3 核心服务对象

#### `ModelService`

`plantbackend/model_service.py` 负责：

- 扫描可用 ONNX 模型
- 缓存推理 session
- 解析标签与输入尺寸
- 预处理图片
- 运行 YOLO 风格推理
- 做后处理与 NMS

这是识别能力的核心。

#### `AuthStore`

`plantbackend/auth_store.py` 使用 SQLite 保存：

- `users`
- `sessions`
- `dataset_ownership`
- `model_ownership`

认证模型包括：

- 用户密码 PBKDF2 哈希
- Session 令牌管理
- 普通用户与管理员角色
- 模型/数据集公私有与归属关系
- 用户禁用与标记

#### 知识库与 AI 建议

这部分由三层组成：

- `plantbackend/ai_advice_service.py`
- `plantbackend/knowledge_store.py`
- `plantbackend/knowledge_base_service.py`

功能上分为两类：

- 针对识别结果生成 AI 建议
- 针对标注类别生成并缓存知识库条目

其运行逻辑是：

- 若配置 OpenAI 兼容接口，则优先远端生成
- 若模型支持图像输入，则可做真正图像上下文建议
- 若远端不可用或不支持，则退回文本或内置建议
- 若指定了数据集知识库，则会优先查缓存并在必要时回写

#### 模型与增强资产管理

模型与增强资产相关逻辑分散在：

- `plantbackend/model_storage.py`
- `plantbackend/admin_asset_service.py`
- `plantbackend/augmentation_manager.py`
- `plantbackend/augment_yolo.py`

当前设计支持：

- 模型按用户与公私有目录存储
- 模型配套标签与元数据文件
- 增强脚本上传
- 增强脚本元数据维护
- 激活当前增强脚本

#### 训练导出

`plantbackend/train_yolo.py` 负责：

- 调用 Ultralytics 训练
- 输出训练进度
- 加载最佳权重
- 导出 ONNX
- 兼容旧版 C2f 层导出补丁

训练的基础权重默认是 `yolov8n.pt`。

### 6.4 后端接口域

从 `api_router.py` 暴露的接口面看，主要包括：

- `/`、`/health`
- `/auth/*`
- `/users`
- `/admin/users/*`
- `/admin/console`
- `/models/*`
- `/models/train/*`
- `/annotation/*`
- `/ai/recommendation`
- `/predict`

也就是说，当前后端确实已经覆盖了从登录到训练再到部署前管理的大多数关键环节。

## 7. 关键业务流梳理

### 7.1 识别主链路

主链路是：

1. 用户登录
2. 前端加载模型列表
3. 用户上传图片或接入摄像头/屏幕共享
4. 后端 `ModelService` 推理
5. `KnowledgeBaseService` / `AiAdviceService` 生成建议
6. 前端展示检测框、候选结果、热力图、智能分析
7. 可将结果直接送入标注工作区

### 7.2 标注与训练链路

主链路是：

1. 选择或创建数据集
2. 配置类别库
3. 上传原始图像或导入现成数据集
4. 对图片做框选和保存
5. 需要时执行增强
6. 启动训练任务
7. 轮询训练进度
8. 导出 ONNX
9. 新模型回到模型资产工作区继续管理

### 7.3 管理链路

管理员链路包括：

- 查看用户与资源分布
- 上传平台模型
- 导入共享数据集
- 上架增强脚本
- 切换当前增强脚本
- 管理用户封禁与删除

## 8. 部署、启动与测试现状

### 8.1 本地启动路径

当前项目存在三套本地使用方式：

- `cd frontend && npm run dev`：走 Vite，默认读取 `frontend/vite.config.js`，端口是 `3000`
- `start_frontend.ps1`：显式把 Vite 端口切到 `5500`
- `serve_frontend.py`：要求 `frontend/dist` 已存在，提供静态预览并代理 `/api`

后端可通过：

- `python -m plantbackend`
- `uvicorn plantbackend.asgi:app`
- `start_backend.ps1`

启动。

### 8.2 生产部署路径

生产部署入口是：

- `deploy/backend.Dockerfile`
- `deploy/frontend.Dockerfile`
- `deploy/nginx.default.conf`
- `deploy/compose.prod.yml`

部署方式是：

- 后端容器运行 FastAPI
- 前端容器由 Nginx 托管静态文件
- `/api/` 由 Nginx 反向代理到后端

### 8.3 自动化检查

项目现有三类自动化能力：

- `tools/api_smoke_check.py`：轻量接口烟雾检查
- `tools/full_feature_check.py`：重型全链路回归
- `frontend/tests/e2e/*`：前端 Playwright E2E

但它们都依赖“已有运行环境和约定账号/数据”，并不属于零配置即可执行的 CI 级自举测试。

## 9. 发现的主要问题与风险

### 9.1 文档与真实代码明显漂移

最明显的漂移包括：

- 根 `README.md` 仍把前端描述成 `Vite + React` 壳层，并提到 `frontend/legacy/`
- 实际代码是 Vue 3，且当前目录里不存在 `frontend/legacy/`
- `README.md` 中关于前端开发端口、`strictPort` 等描述与真实 `vite.config.js` 不一致
- `docs/project-feature-inventory.md` 与 `docs/test-issues-report-2026-03-31.md` 中大量链接仍指向旧的 Windows 绝对路径
- `docs/test-issues-report-2026-03-31.md` 已经落后于当前代码，例如它声称前端没有 `@playwright/test` 和 `e2e` 脚本，但当前 `frontend/package.json` 已经包含这两项

### 9.2 后端核心逻辑过于集中

`plantbackend/api_router.py` 已达 3509 行，仍然承载了：

- 认证 handler
- 模型管理
- 数据集管理
- 训练任务管理
- 预测逻辑
- 管理员逻辑

虽然 `routes/` 已经搭了外壳，但业务逻辑本体尚未按域拆开，后续继续演进时维护成本会持续上升。

### 9.3 前端工作区组件过重

几个核心页面已经承担了过多状态与流程编排：

- `RecognitionWorkspace.vue`
- `AnnotationWorkspace.vue`
- `AdminWorkspace.vue`
- `DetailsWorkspace.vue`

这会直接带来：

- 状态变更难以定位
- 回归范围越来越大
- E2E 用例稳定性压力增加

### 9.4 训练任务状态只保存在当前进程内存

`api_router.py` 中存在：

- `TRAINING_TASKS`
- `ACTIVE_TRAINING_TASK_ID`
- `threading.Thread(...)`

这意味着：

- 训练任务状态不会跨进程共享
- 服务重启后内存态任务记录会消失
- 当前实现天然偏单机、单实例
- 如果未来上多实例或容器重启，训练状态一致性会变差

### 9.5 生产持久化边界不完整

`compose.prod.yml` 当前挂载了：

- `models`
- `annotation_datasets`
- `training_runs`
- `plant_auth.db`

但默认没有挂载：

- `plantbackend/data/knowledge_base.db`
- `plantbackend/augmentation_algorithms/`
- `plantbackend/active_augmentation_script.txt`

结合 `config.py` 的默认路径，这会导致两个明显风险：

- 知识库缓存默认不会随容器重建持久化
- 上传的增强脚本与当前生效脚本选择默认也不保证持久化

### 9.6 环境可移植性不足

这次前端构建失败暴露了当前目录存在典型的“跨平台拷贝 `node_modules`”问题：

- `node_modules/.bin/vite` 权限不一致
- `esbuild` 平台二进制与当前系统不匹配

这说明当前工作区更像一个已经在 Windows 使用过、再拿到 Linux/WSL 继续使用的目录快照，而不是严格可复现的干净源码目录。

### 9.7 默认模型约定与当前模型目录不一致

`plantbackend/.env.example` 里默认是：

- `DEFAULT_MODEL_NAME=best.onnx`

但当前实际模型目录里可见的是：

- `plantbackend/models/plant_disease.onnx`
- `plantbackend/models/users/root/public/SpecTriGate.onnx`
- `plantbackend/models/users/root/public/uploaded_model.onnx`

这会让“新环境按文档启动”与“当前现态可用模型”之间出现预期偏差。

### 9.8 启动脚本与推荐环境存在脱节

根 README 明确强调训练推荐使用 `.venv-train`，但 `start_backend.ps1` 实际只探测：

- 根目录 `.venv`
- 根目录 `.backend-venv`
- `plantbackend/.venv`

没有覆盖 `.venv-train`。这会让“推荐运行方式”和“便捷脚本行为”不一致。

## 10. 当前最值得优先做的事

如果你接下来要继续维护这个项目，我建议优先级按下面顺序推进：

1. 修正文档基线  
   先把根 `README.md`、`docs/project-feature-inventory.md`、`docs/test-issues-report-2026-03-31.md` 更新到与当前代码一致，至少修正 Vue/React、端口、绝对路径、测试依赖状态这些误导项。

2. 把持久化边界补齐  
   在生产部署里补齐知识库数据库、增强脚本目录和激活记录的挂载，避免管理台操作在重启后丢失。

3. 拆分 `api_router.py`  
   优先按 `auth`、`models`、`annotation`、`admin`、`prediction` 五个域迁出真正的业务实现，而不是只保留薄路由包装层。

4. 收敛前端超大组件  
   先从 `RecognitionWorkspace.vue` 和 `AnnotationWorkspace.vue` 入手，把“状态管理”和“画布/展示组件”继续拆开。

5. 清理运行态目录边界  
   让 `node_modules`、`dist`、模型、训练产物、数据集、数据库更明确地区分“源码态”和“运行态”，避免当前这种目录快照式工作区继续膨胀。

## 11. 结论

从功能完整度看，这个项目已经不是早期原型，而是一个具备较强实用性的植物病害工作台。它的优点是业务闭环完整、前后端职责清楚、AI 建议与知识库结合得较有层次、管理员侧能力也比较成型。

从工程状态看，它现在正处在“功能已经堆出来，但工程边界还没完全收拢”的阶段。最大的挑战不是再加一个功能，而是把现有能力重新梳理成更稳定、更可维护、更可部署的结构。
