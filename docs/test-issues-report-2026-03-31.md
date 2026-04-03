# 测试问题报告（2026-03-31）

## 本次执行的检查

在 `C:\Users\36451\Downloads\-yolo--main\-yolo--main` 下执行了以下验证：

- 前端生产构建：`npm run build`
- 后端语法检查：`.\.python312\install\python.exe -m py_compile plantbackend\app.py plantbackend\asgi.py plantbackend\api_router.py plantbackend\auth_store.py plantbackend\model_service.py`
- 后端健康检查：`GET http://127.0.0.1:7800/health`
- 后端烟雾测试：`.\.backend-venv\Scripts\python.exe .\tools\api_smoke_check.py`
- 后端完整功能检查：`.\.backend-venv\Scripts\python.exe .\tools\full_feature_check.py`
- 前端 E2E 依赖检查：确认 `frontend\node_modules\@playwright\test` 是否存在

## 通过项

- 前端 `vite build` 通过，当前前端代码至少能完成生产构建。
- 后端核心 Python 模块语法检查通过。
- 本地 `http://127.0.0.1:7800/health` 可访问，返回 `success=true`，当前服务报告已加载模型，模型名为 `best_1_1.onnx`。

## 发现的问题

### 1. 后端烟雾测试默认凭据与当前环境不一致，测试直接卡在登录

- 复现结果：`tools/api_smoke_check.py` 执行失败，报错为 `POST /auth/login expected 200, got 401`
- 直接原因：脚本默认使用 `root/root` 与 `root_user/root`
- 代码位置：[tools/api_smoke_check.py](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/tools/api_smoke_check.py#L10)
- 相关配置位置：[plantbackend/.env](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/plantbackend/.env#L17)

说明：

- 烟雾测试脚本中 `ADMIN_PASSWORD` 默认值是 `"root"`，[tools/api_smoke_check.py](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/tools/api_smoke_check.py#L12)
- 同一脚本中 `USER_PASSWORD` 默认值也是 `"root"`，[tools/api_smoke_check.py](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/tools/api_smoke_check.py#L14)
- 但当前环境文件里管理员密码是 `change_me`，普通用户密码为空，[plantbackend/.env](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/plantbackend/.env#L18) [plantbackend/.env](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/plantbackend/.env#L20)

影响：

- 当前仓库自带的烟雾测试在默认配置下不能直接作为回归检查使用。

建议：

- 统一测试脚本与 `.env` 的默认账号策略。
- 或者要求测试脚本必须显式读取 `PLANT_*` 环境变量，不再内置 `root/root` 回退值。

### 2. 完整功能检查脚本依赖不存在的 `best.onnx`，导致启动前即失败

- 复现结果：`tools/full_feature_check.py` 执行失败，报错为 `Missing source model: ... plantbackend\models\best.onnx`
- 代码位置：[tools/full_feature_check.py](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/tools/full_feature_check.py#L29)
- 失败断言位置：[tools/full_feature_check.py](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/tools/full_feature_check.py#L250)

实际仓库中存在的模型文件：

- `best_1.onnx`
- `best_1_1.onnx`
- `best_2.onnx`

相关配置位置：

- [plantbackend/.env](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/plantbackend/.env#L7) 仍然把 `DEFAULT_MODEL_NAME` 写成了 `best.onnx`

影响：

- 完整功能检查无法进入真正的上传、训练、预测、下载流程。
- 当前默认模型配置和仓库实际产物不一致，也有较高概率影响新环境首次启动行为。

建议：

- 将完整功能检查改为自动选择现有模型文件。
- 或者补齐仓库内约定的 `plantbackend/models/best.onnx`。
- 同时把 `.env` 默认模型名改成仓库实际存在的模型。

### 3. 前端 E2E 测试文件存在，但项目未安装 Playwright，也没有测试脚本入口

- 现状：`frontend/tests/e2e` 下已有测试文件，但 `frontend/node_modules/@playwright/test` 不存在
- 代码位置：[frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L1)
- 依赖声明位置：[frontend/package.json](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/package.json#L5)

说明：

- E2E 用例直接 `require('@playwright/test')`，[frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L1)
- 但 `frontend/package.json` 只有 `dev/build/preview`，没有 `test` 或 `e2e` 脚本，[frontend/package.json](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/package.json#L5)
- `devDependencies` 中也没有 `@playwright/test`，[frontend/package.json](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/package.json#L13)

影响：

- 前端 E2E 测试当前属于“仓库内有文件，但无法直接执行”的状态。

建议：

- 在 `frontend/package.json` 中加入 `@playwright/test` 和明确的 `e2e` 脚本。
- 如果这些测试暂时不打算维护，建议移出主仓库或在文档中标注为未启用。

### 4. 前端 E2E 断言中的中文文案已经出现乱码，测试即使补齐依赖也大概率不稳定

- 代码位置：[frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L9)
- 同类问题还出现在多处文案断言中，例如 [frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L15) [frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L32) [frontend/tests/e2e/ui-core.spec.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/ui-core.spec.cjs#L68)

说明：

- 这些断言文本不是正常中文，而是典型乱码字符串，例如 `鐑姏鍥?`。
- 登录辅助函数中的文案仍是正常中文，说明问题并非整个测试目录都损坏，[frontend/tests/e2e/helpers.cjs](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/frontend/tests/e2e/helpers.cjs#L24)

影响：

- 即使补装 Playwright，这些基于文本选择器的断言也很容易全部失败。

建议：

- 统一把 E2E 文件按 UTF-8 重存。
- 对关键节点优先改用稳定的 `data-testid` 或结构选择器，减少中文文案变化和编码问题的影响。

### 5. 根目录 `.venv` 仍然绑定旧的 `D:` 盘解释器，容易继续触发编辑器或脚本异常

- 配置位置：[.venv/pyvenv.cfg](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/.venv/pyvenv.cfg#L1)

说明：

- 根目录 `.venv` 当前仍写着 `D:\-yolo--main\-yolo--main\.python312\install`
- 这与当前项目实际所在的 `C:` 盘不一致
- 相比之下，`.backend-venv` 已经是正确的 `C:` 盘路径，[.backend-venv/pyvenv.cfg](/c:/Users/36451/Downloads/-yolo--main/-yolo--main/.backend-venv/pyvenv.cfg#L1)

影响：

- 如果 VS Code 或脚本错误选中了根目录 `.venv`，仍可能出现 “No Python at ...” 之类的问题。

建议：

- 删除并重建根目录 `.venv`，或在工作区设置中明确指定使用 `.backend-venv`。

## 结论

当前项目的主要问题不是“代码完全跑不起来”，而是“测试与运行环境约定已经漂移”：

- 运行中的后端服务是可用的
- 前端可以构建
- 但仓库自带的自动化检查存在默认凭据失效、模型文件名失配、E2E 依赖缺失和测试文案乱码等问题

## 优先修复顺序

1. 修正 `tools/full_feature_check.py` 与 `.env` 中的默认模型名，先让完整功能检查能启动。
2. 统一 `tools/api_smoke_check.py`、`tools/full_feature_check.py` 与 `.env` 的默认账号密码策略。
3. 决定前端 E2E 是正式启用还是暂时下线；如果启用，就补 `@playwright/test`、补脚本、修乱码。
4. 清理或重建根目录 `.venv`，避免后续开发工具继续误选坏环境。
