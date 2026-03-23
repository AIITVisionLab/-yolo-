# Plant

植物病害智能识别项目，包含组件化比赛展示前端、FastAPI 后端、模型管理、数据标注、增强与训练导出能力。

## 现在的结构

```text
plant/
├─ frontend/                  # Vite + React 前端壳
│  ├─ src/                    # 组件、hooks、API 客户端与样式分层
│  ├─ legacy/                 # 旧工作台，作为嵌入式 legacy workspace 保留
│  ├─ package.json
│  └─ vite.config.js
├─ plantbackend/              # FastAPI 服务与业务逻辑
│  ├─ app.py                  # ASGI 应用工厂入口
│  ├─ asgi.py                 # 部署入口
│  ├─ api_router.py           # 当前集中路由与处理逻辑
│  ├─ config.py               # 单一配置入口
│  ├─ model_service.py
│  ├─ auth_store.py
│  ├─ ai_advice_service.py
│  └─ ...
├─ deploy/                    # Docker / 反向代理部署文件
├─ tools/
└─ Makefile
```

## 本地开发

### 后端

```bash
python3 -m uvicorn plantbackend.asgi:app --host 127.0.0.1 --port 7800
```

如果本机默认 Python 版本对 `torch/ultralytics` 不兼容，可以额外准备 `plantbackend/.venv-train` 作为训练专用环境。后端会自动优先使用这个解释器执行训练任务。

### 前端

```bash
cd frontend
npm install
npm run dev
```

访问地址：

- 前端：`http://127.0.0.1:5500`
- 后端健康检查：`http://127.0.0.1:7800/health`
- 后端文档：`http://127.0.0.1:7800/docs`

如果你想本地预览构建产物而不是开发服务器：

```bash
cd frontend
npm run build
cd ..
python3 serve_frontend.py --host 127.0.0.1 --port 5500
```

`serve_frontend.py` 会把前端的 `/api/*` 请求自动转发到 `http://127.0.0.1:7800`。如果你的后端不在这个地址，可以改成：

```bash
python3 serve_frontend.py --host 127.0.0.1 --port 5500 --api-target http://127.0.0.1:7801
```

## 环境变量

后端开发环境可以从 `plantbackend/.env.example` 复制：

```bash
cp plantbackend/.env.example plantbackend/.env
```

首次空数据库启动前，至少设置管理员密码：

```bash
export BOOTSTRAP_ADMIN_PASSWORD="请改成你自己的强密码"
```

## Docker 部署

部署文件放在 `deploy/`：

```bash
cd deploy
cp backend.env.example backend.env
docker compose -f compose.prod.yml up --build
```

部署后：

- 前端通过 Nginx 提供服务
- `/api` 会自动反代到后端
- React 壳会加载 `/legacy/index.html?embed=1&view=...`
- legacy 工作台与新壳共用同一份 `plant_auth_token`

## 接入实验室大模型

项目现在支持把识别图片和本地识别结果一起发送到 OpenAI 兼容接口。如果远端模型支持视觉输入，会返回基于图片本身的智能分析；如果远端只支持文本，则自动退回为“识别结果 + 大模型建议”；如果完全未配置，则继续使用内置建议。

常用环境变量：

```bash
AI_API_URL=
AI_API_BASE_URL=
AI_API_CHAT_PATH=/v1/chat/completions
AI_API_KEY=
AI_API_MODEL=
AI_API_TIMEOUT=25
AI_API_MAX_IMAGE_BYTES=6291456
AI_API_IMAGE_DETAIL=auto
```

说明：

- `AI_API_URL`：直接填写完整的聊天补全地址时使用，例如 `http://lab-server:8000/v1/chat/completions`
- `AI_API_BASE_URL`：如果你只拿到服务根地址，可以填写这个，例如 `http://lab-server:8000`
- `AI_API_CHAT_PATH`：和 `AI_API_BASE_URL` 组合成最终请求地址，默认是 `/v1/chat/completions`
- `AI_API_KEY`：可选，实验室内网服务如果不校验鉴权可以留空
- `AI_API_MODEL`：实验室服务暴露出来的模型名
- `AI_API_MAX_IMAGE_BYTES`：发送给多模态模型前允许的最大图片体积，超过会自动尝试压缩

如果你们实验室提供的是视觉模型，例如 `Qwen-VL`、`Qwen2.5-VL` 一类，前端“病害识别”页会直接显示基于图片的智能分析；如果是纯文本模型，则只会根据本地识别结果生成建议，不能真正看图。

## 清理工作区

项目提供了统一清理脚本：

```bash
bash tools/clean_workspace.sh
```

它会删除常见缓存和构建产物，例如：

- `.venv*`
- `__pycache__`
- `.codex-artifacts`
- `video_frames`

## 说明

- 当前后端已经拆出稳定的 ASGI 入口，方便继续把 `api_router.py` 按路由域进一步细分。
- 前端已经从“大型静态三件套页面”升级成 `Vite + React` 壳层，旧工作台被隔离到 `frontend/legacy/` 里做渐进迁移。
- 新前端负责品牌、会话、导航和嵌入调度，legacy 继续承载识别、训练和管理细节，后续可以逐块替换。
- 模型文件、数据集和数据库属于运行数据，不算“构建垃圾”，默认不会被清理脚本误删。
