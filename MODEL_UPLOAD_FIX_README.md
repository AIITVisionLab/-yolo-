# 模型上传与显示问题修复说明

## 1. 背景

本次排查围绕下面几类现象展开：

- 上传模型后，前端只显示少量模型，容易误判为“只能显示 2 个或 3 个”
- 普通用户上传为“个人私有模型”后，前端看不到自己的模型
- 上传新模型后，原来的模型像是“消失了”，删除新模型后旧模型又恢复
- 管理区和普通用户区都存在“像被旧布局遮挡”的视觉问题

这次修复的重点不是只改 UI，而是同时修正：

1. 前端模型列表的展示方式
2. 前端旧共享样式造成的裁切
3. 后端模型存储与索引的同名冲突问题

---

## 2. 根因结论

## 2.1 前端层

前端不是“每次上传都新建一个窗口”，真正的问题主要有两类：

- 管理区和普通用户区的模型列表以前更像分页/轮播式展示，视觉上容易误判为“后面的模型没显示”
- 共享样式里曾残留固定宽高规则，导致资源面板和模型行被裁切，看起来像“叠层”或“被遮挡”

已经移除的旧样式问题可概括为：

```diff
-.asset-row {
-  height: 100px;
-  width: 500px;
-}

-.workspace__main .asset-collection {
-  width: 550px;
-  height: 500px;
-}
```

## 2.2 后端层

真正导致“上传新模型后原模型消失”的核心原因在后端。

当前后端虽然已经把文件放进了按用户区分的目录：

```text
models/users/<username>/public/
models/users/<username>/private/
```

但是模型注册和索引仍然是按 **文件名** 工作的：

- `model_ownership.model_name` 仍然是主键
- 模型扫描索引也仍然按 `path.name` 建表

这意味着如果两个模型最终 basename 相同，就会出现：

- 索引只保留一个
- 权限记录被覆盖或指向错误
- 前端看到的 `/models` 列表像是“旧模型消失”

也就是说，这次最关键的问题不是前端挡住了模型，而是后端仍然把“文件名”当成全局唯一标识。

---

## 3. 已做修改

## 3.1 普通用户模型页改为完整列表显示

文件：

- `frontend/src/components/details/DetailsWorkspace.vue`

现在模型区直接遍历 `modelsState.items`，不再额外做前端截断：

```vue
<div v-else class="asset-list asset-list--models">
  <article
    v-for="model in modelsState.items"
    :key="model.name"
    :class="['asset-row', 'asset-row--model', { 'is-active': model.is_active }]"
  >
    <div class="asset-row__main">
      <div class="asset-row__title">
        <strong>{{ model.name }}</strong>
        <div class="asset-row__badges">
          <span v-if="model.is_active" class="native-pill native-pill--accent">当前模型</span>
          <span class="native-pill native-pill--neutral">{{ model.is_public ? "公开" : "私有" }}</span>
          <span v-if="model.is_official" class="native-pill native-pill--warm">官方</span>
        </div>
      </div>
      <p>{{ describeOwner(model) }}</p>
    </div>
  </article>
</div>
```

上传后会重新拉取 `/models`，而不是依赖旧本地分页状态：

```js
const reloadModels = async (message = "") => {
  if (!props.token) return

  const payload = await fetchModels(props.token)
  modelsState.value = {
    loading: false,
    items: payload?.data?.available_model_items || [],
    currentModel: payload?.data?.current_model || "",
  }
}

const handleModelUpload = async (event) => {
  event.preventDefault()
  await runAssetAction("upload-user-model", async () => {
    const payload = await uploadUserModel(props.token, uploadForm.value)
    await reloadModels(payload?.message || "模型资产已刷新。")
  })
}
```

并增加了本地样式覆盖，避免模型行被旧布局压扁：

```css
.asset-list--models {
  gap: 0.85rem;
}

.asset-list--models .asset-row--model {
  width: 100%;
  min-height: 0;
  height: auto;
}
```

---

## 3.2 管理员模型页改为完整列表显示

文件：

- `frontend/src/components/admin/AdminWorkspace.vue`

管理员模型列表同样改为直接渲染全部 `managed_models`：

```vue
<div v-else class="asset-list asset-list--models">
  <article
    v-for="model in consoleData.managed_models"
    :key="model.name"
    :class="['asset-row', 'asset-row--model', { 'is-active': model.is_active }]"
  >
    <div class="asset-row__main">
      <div class="asset-row__title">
        <strong>{{ model.name }}</strong>
        <div class="asset-row__badges">
          <span v-if="model.is_active" class="native-pill native-pill--accent">当前模型</span>
          <span class="native-pill native-pill--neutral">{{ model.is_public ? '公开' : '私有' }}</span>
          <span v-if="model.is_official" class="native-pill native-pill--warm">官方</span>
        </div>
      </div>
    </div>
  </article>
</div>
```

同时增加本地样式覆盖，保证管理员模型行不会再被历史样式裁切：

```css
.asset-list--models {
  gap: 0.85rem;
}

.asset-list--models .asset-row--model {
  width: 100%;
  height: auto;
  min-height: 0;
  align-items: flex-start;
  box-sizing: border-box;
}
```

---

## 3.3 后端模型目录改为按用户和公开/私有分层

文件：

- `plantbackend/model_storage.py`

关键逻辑如下：

```python
def build_user_model_dir(models_root: Path, owner_username: Optional[str], is_public: bool) -> Path:
    owner_segment = safe_storage_segment(owner_username, "system")
    visibility_segment = "public" if is_public else "private"
    return models_root / "users" / owner_segment / visibility_segment
```

模型文件按目录递归扫描：

```python
def iter_model_file_paths(models_root: Path) -> Iterable[Path]:
    if not models_root.exists():
        return []
    return sorted(
        path
        for path in models_root.rglob("*.onnx")
        if path.is_file() and path.stat().st_size > 0
    )
```

上传时目标路径会先根据“用户名 + 公开/私有”计算，再自动避开重名：

```python
def resolve_unique_model_targets(
    models_root: Path,
    owner_username: Optional[str],
    is_public: bool,
    desired_stem: str,
) -> Tuple[str, Path, Path, Path]:
    target_dir = build_user_model_dir(models_root, owner_username, is_public)
    target_dir.mkdir(parents=True, exist_ok=True)

    existing_names = set(build_model_name_index(models_root))
    stem = desired_stem
    counter = 1
    while f"{stem}.onnx" in existing_names:
        stem = f"{desired_stem}_{counter}"
        counter += 1
```

---

## 3.4 增加“同名模型自动去冲突”同步逻辑

文件：

- `plantbackend/api_router.py`

这是这次最关键的修复。

在同步模型注册表时，先递归扫描所有 ONNX 文件，再把同名模型拆开，给冲突项自动分配唯一名称：

```python
def normalize_duplicate_model_assets(models_dir: Path, admin_user: Dict[str, object]) -> None:
    grouped_paths: Dict[str, List[Path]] = {}
    for path in iter_model_file_paths(models_dir):
        grouped_paths.setdefault(path.name, []).append(path)

    for model_name, candidate_paths in grouped_paths.items():
        if len(candidate_paths) < 2:
            continue

        registered_owner = auth_store.get_model_owner(model_name)
        canonical_path = select_canonical_model_path(models_dir, candidate_paths, registered_owner)

        for path in candidate_paths:
            if path == canonical_path:
                continue

            inferred_owner_username, inferred_is_public = infer_visibility_from_path(models_dir, path)
            inferred_owner = auth_store.get_user_by_username(inferred_owner_username) if inferred_owner_username else None
            owner_user = inferred_owner or admin_user
            is_public = True if inferred_is_public is None else bool(inferred_is_public)
            desired_stem = safe_model_stem(Path(model_name).stem, "uploaded_model")
            new_name, target_path, _, _ = resolve_unique_model_targets(
                models_dir,
                desired_stem,
                str(owner_user.get("username") or ""),
                is_public,
            )
            move_model_assets(path, target_path)
            cleanup_empty_parent_directories(path.parent, models_dir)
            auth_store.ensure_model_owner(
                new_name,
                int(owner_user["id"]),
                is_public=is_public,
                overwrite_existing=False,
            )
```

然后在注册同步入口最前面执行：

```python
def sync_model_registry() -> None:
    models_dir = Path(settings.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    admin_user = auth_store.get_primary_admin_user()
    if not admin_user:
        return
    normalize_duplicate_model_assets(models_dir, admin_user)
    for path in build_model_name_index(models_dir).values():
        ...
```

这样做以后，即使出现：

- 不同用户上传了同名模型
- 同一用户重复上传同名模型
- 历史遗留平铺文件和新目录文件重名

也不会再出现“新模型把旧模型顶掉，前端看起来旧模型消失”的情况。

---

## 4. 前端排查结论

这次排查里，前端确认过以下几点：

- 用户模型页直接使用 `/models` 返回的 `available_model_items`
- 标注页使用 `/models` 返回的 `available_models`
- 请求层没有对 `/models` 做缓存
- 没有发现前端仍然保留“只显示前 2 个模型”的逻辑

当前仍然保留的一个旧交互是：

- `frontend/src/components/recognition/RecognitionWorkspace.vue`

识别页还有一个“每页最多 4 个模型”的轮播壳。它不是“总共只显示 4 个”，只是分页显示：

```vue
第 {{ recognitionModelCarouselPage + 1 }} / {{ recognitionModelPages.length }} 页 · 每页最多 4 个模型
```

这不是本次“旧模型被覆盖”的根因，但如果后续想统一体验，建议也改成和模型资产页一致的完整列表。

---

## 5. 仍需注意的技术债

当前修复已经能解决现象层问题，但从设计上看，后端还有一个长期建议：

- 现在 `model_ownership.model_name` 仍然是主键
- 模型系统仍然依赖 basename 作为主标识

虽然这次已经通过“上传时避重名 + 同步时自动拆冲突”把问题兜住了，但长期更稳的方案仍然是：

1. 为模型引入真正的 `model_id`
2. 数据库保存 `model_id + file_path + owner_user_id + is_public`
3. 前端操作下载、删除、切换时优先传 `model_id`

这样就可以彻底摆脱“同名模型天然冲突”的结构性风险。

---

## 6. 验证方式

后端语法检查：

```powershell
& .\.python312\install\python.exe -m py_compile `
  plantbackend\api_router.py `
  plantbackend\model_storage.py `
  plantbackend\model_service.py `
  plantbackend\auth_store.py
```

前端构建检查：

```powershell
cd frontend
npm run build
```

开发时建议用带热重载的后端启动方式：

```powershell
cd C:\Users\36451\Downloads\-yolo--main\-yolo--main\plantbackend
& ..\.backend-venv\Scripts\python.exe -m uvicorn asgi:app --host 127.0.0.1 --port 7800 --reload
```

---

## 7. 本次涉及文件

- `frontend/src/components/details/DetailsWorkspace.vue`
- `frontend/src/components/admin/AdminWorkspace.vue`
- `frontend/src/styles/workspaces/shared.css`
- `plantbackend/model_storage.py`
- `plantbackend/model_service.py`
- `plantbackend/admin_asset_service.py`
- `plantbackend/api_router.py`
- `plantbackend/auth_store.py`

---

## 8. 总结

本次问题表面上像“前端遮挡”或“前端只显示 2 个模型”，但真正的核心根因是：

- 前端确实有旧布局问题，导致视觉上像被裁切
- 但后端同名模型索引冲突，才是“上传新模型后旧模型消失”的关键原因

因此最终方案必须同时处理：

1. 前端完整列表展示
2. 删除旧固定尺寸样式
3. 后端改为按用户/公开私有目录管理
4. 后端同步时自动拆分同名模型冲突

只有这四层一起处理，模型上传、私有可见性、历史模型保留这条链路才会真正稳定。
