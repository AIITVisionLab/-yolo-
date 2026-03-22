import { useEffect, useMemo, useState } from "react";
import { FileField } from "@/components/shared/FileField";
import { buildApiUrl, getApiBaseLabel } from "@/lib/api";
import { saveBlobAsFile } from "@/lib/download";
import {
  deleteModelAsset,
  downloadModelArchive,
  fetchModels,
  selectActiveModel,
  uploadUserModel,
} from "@/lib/plantApi";

function describeHealth(health) {
  if (health.state === "online") {
    return "后端在线";
  }
  if (health.state === "offline") {
    return "后端不可用";
  }
  return "正在检测";
}

function describeModel(health) {
  if (health.state !== "online") {
    return "等待服务响应";
  }
  return health.data?.current_model || "尚未启用模型";
}

function describeOwner(item) {
  return item.owner_display_name || item.owner_username || (item.is_official ? "官方资源" : "当前用户");
}

export function DetailsWorkspace({ token, isAuthenticated, user, health }) {
  const isAdmin = user?.role === "admin";
  const [modelsState, setModelsState] = useState({
    loading: false,
    items: [],
    currentModel: "",
  });
  const [status, setStatus] = useState("模型资产已集中到这里。");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [uploadForm, setUploadForm] = useState({
    modelFile: null,
    labelsFile: null,
    metadataFile: null,
    isPublic: false,
    activate: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setModelsState({
        loading: false,
        items: [],
        currentModel: "",
      });
      return;
    }

    let cancelled = false;
    async function bootstrap() {
      setModelsState((current) => ({ ...current, loading: true }));
      setError("");
      try {
        const payload = await fetchModels(token);
        if (cancelled) {
          return;
        }
        setModelsState({
          loading: false,
          items: payload?.data?.available_model_items || [],
          currentModel: payload?.data?.current_model || "",
        });
        setStatus(payload?.message || "模型资产已加载。");
      } catch (nextError) {
        if (!cancelled) {
          setModelsState({
            loading: false,
            items: [],
            currentModel: "",
          });
          setError(nextError.message || "模型资产加载失败。");
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  const quickFacts = useMemo(() => {
    if (isAdmin) {
      return [
        {
          label: "服务状态",
          value: describeHealth(health),
          note: health.message || "后端健康检查",
        },
        {
          label: "当前在线模型",
          value: describeModel(health),
          note: "识别页会直接调用当前激活模型",
        },
        {
          label: "接口基址",
          value: getApiBaseLabel(),
          note: "部署时默认走同源代理",
        },
        {
          label: "当前会话",
          value: isAuthenticated ? "管理员" : "未登录",
          note: isAuthenticated ? (user?.display_name || user?.username || "已登录") : "登录后可维护平台资源",
        },
      ];
    }

    return [
      {
        label: "可访问模型",
        value: String(modelsState.items.length),
        note: "包含公开模型和你上传的个人模型",
      },
      {
        label: "当前会话",
        value: isAuthenticated ? "普通用户" : "未登录",
        note: isAuthenticated ? (user?.display_name || user?.username || "已登录") : "登录后可上传个人模型",
      },
      {
        label: "当前使用模型",
        value: modelsState.currentModel || describeModel(health),
        note: "识别页会优先调用当前可访问模型",
      },
    ];
  }, [health, isAdmin, isAuthenticated, modelsState.currentModel, modelsState.items.length, user]);

  async function reloadModels(message = "") {
    if (!token) {
      return;
    }
    const payload = await fetchModels(token);
    setModelsState({
      loading: false,
      items: payload?.data?.available_model_items || [],
      currentModel: payload?.data?.current_model || "",
    });
    if (message) {
      setStatus(message);
    }
  }

  async function runAssetAction(key, action) {
    setBusyKey(key);
    setError("");
    try {
      await action();
    } catch (nextError) {
      setError(nextError.message || "模型资产操作失败。");
    } finally {
      setBusyKey("");
    }
  }

  async function handleModelUpload(event) {
    event.preventDefault();
    if (!uploadForm.modelFile) {
      setError("请先选择要上传的 ONNX 模型。");
      return;
    }
    await runAssetAction("upload-user-model", async () => {
      const payload = await uploadUserModel(token, uploadForm);
      setStatus(payload?.message || "个人模型已上传。");
      setUploadForm({
        modelFile: null,
        labelsFile: null,
        metadataFile: null,
        isPublic: false,
        activate: true,
      });
      await reloadModels(payload?.message || "模型资产已刷新。");
    });
  }

  return (
    <section className="native-workspace native-workspace--details">
      <div className="native-workspace__panel native-workspace__panel--controls">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Assets</p>
          <h3>{isAdmin ? "资产与部署" : "模型资产"}</h3>
          <p>
            {isAdmin
              ? "把运行状态、模型资产和部署入口放进一个网页模块里，不再堆大量说明文字。"
              : "普通用户侧只保留模型上传、下载和切换相关能力。"}
          </p>
        </div>

        <div className="ops-metric-grid ops-metric-grid--stacked">
          {(isAdmin ? quickFacts.slice(0, 2) : quickFacts.slice(0, 1)).map((item) => (
            <article key={item.label} className="ops-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>

        {isAdmin ? (
          <div className="native-workspace__group">
            <div className="native-workspace__section-head native-workspace__section-head--tight">
              <h3>部署入口</h3>
              <p>同一个站点下即可定位 API、文档和当前服务状态。</p>
            </div>
            <div className="guide-grid guide-grid--stacked">
              <article className="guide-card">
                <span>接口文档</span>
                <strong>FastAPI Docs</strong>
                <p>部署后可直接用它验证接口是否在线。</p>
                <a className="native-link" href={buildApiUrl("/docs")} target="_blank" rel="noreferrer">
                  打开接口文档
                </a>
              </article>
              <article className="guide-card">
                <span>OpenAPI</span>
                <strong>Schema JSON</strong>
                <p>前后端联调时可直接下载最新 schema。</p>
                <a className="native-link" href={buildApiUrl("/openapi.json")} target="_blank" rel="noreferrer">
                  打开 Schema
                </a>
              </article>
            </div>
          </div>
        ) : null}

        <div className="native-feedback">
          <p>{status}</p>
          {error ? <strong>{error}</strong> : null}
          {modelsState.loading ? <span>正在刷新模型资产...</span> : null}
        </div>
      </div>

      <div className="native-workspace__panel native-workspace__panel--canvas">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Model Assets</p>
          <h3>{isAdmin ? "模型资产中心" : "个人模型中心"}</h3>
          <p>
            {isAdmin
              ? "登录后即可上传、下载和维护自己的模型。管理员还能在这里直接切换当前在线模型。"
              : "登录后即可上传、下载和维护自己的模型。"}
          </p>
        </div>

        <div className="ops-metric-grid">
          {quickFacts.map((item) => (
            <article key={item.label} className="ops-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>

        {!isAuthenticated ? (
          <div className="native-lock-panel">
            <strong>登录后管理模型资产</strong>
            <p>登录后会解锁模型上传、下载、删除和切换能力。</p>
          </div>
        ) : (
          <div className="details-board">
            <section className="asset-collection">
              <div className="asset-collection__head">
                <div>
                  <p className="workspace__section-label">Upload</p>
                  <h3>上传个人模型</h3>
                </div>
              </div>
              <form className="native-form" onSubmit={handleModelUpload}>
                <FileField
                  label="模型文件"
                  accept=".onnx"
                  file={uploadForm.modelFile}
                  onChange={(file) => setUploadForm((current) => ({ ...current, modelFile: file }))}
                  buttonLabel="选择 ONNX"
                />
                <FileField
                  label="标签文件"
                  accept=".json"
                  file={uploadForm.labelsFile}
                  onChange={(file) => setUploadForm((current) => ({ ...current, labelsFile: file }))}
                  buttonLabel="选择标签"
                />
                <FileField
                  label="说明文件"
                  accept=".json"
                  file={uploadForm.metadataFile}
                  onChange={(file) => setUploadForm((current) => ({ ...current, metadataFile: file }))}
                  buttonLabel="选择说明"
                />
                <label className="native-checkbox">
                  <input
                    type="checkbox"
                    checked={uploadForm.isPublic}
                    onChange={(event) => setUploadForm((current) => ({ ...current, isPublic: event.target.checked }))}
                  />
                  <span>上传为公开模型</span>
                </label>
                <label className="native-checkbox">
                  <input
                    type="checkbox"
                    checked={uploadForm.activate}
                    onChange={(event) => setUploadForm((current) => ({ ...current, activate: event.target.checked }))}
                  />
                  <span>上传后立即使用</span>
                </label>
                <button type="submit" className="primary" disabled={busyKey === "upload-user-model"}>
                  {busyKey === "upload-user-model" ? "上传中..." : "上传模型"}
                </button>
              </form>
            </section>

            <section className="asset-collection asset-collection--wide">
              <div className="asset-collection__head">
                <div>
                  <p className="workspace__section-label">Models</p>
                  <h3>可访问模型</h3>
                </div>
                <span className="native-pill native-pill--accent">{modelsState.currentModel || "未启用"}</span>
              </div>
              {!modelsState.items.length ? (
                <div className="native-empty native-empty--compact">
                  <p>当前账号还没有可访问模型。</p>
                </div>
              ) : (
                <div className="asset-list">
                  {modelsState.items.map((model) => (
                    <article key={model.name} className={`asset-row${model.is_active ? " is-active" : ""}`}>
                      <div className="asset-row__main">
                        <div className="asset-row__title">
                          <strong>{model.name}</strong>
                          <div className="asset-row__badges">
                            {model.is_active ? <span className="native-pill native-pill--accent">当前模型</span> : null}
                            <span className="native-pill native-pill--neutral">{model.is_public ? "公开" : "私有"}</span>
                            {model.is_official ? <span className="native-pill native-pill--warm">官方</span> : null}
                          </div>
                        </div>
                        <p>{describeOwner(model)}</p>
                      </div>
                      <div className="asset-row__actions">
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `download-user-model-${model.name}`}
                          onClick={() => runAssetAction(`download-user-model-${model.name}`, async () => {
                            const blob = await downloadModelArchive(token, model.name);
                            saveBlobAsFile(blob, `${model.name.replace(/\.onnx$/i, "")}_model.zip`);
                            setStatus(`模型 ${model.name} 已开始下载。`);
                          })}
                        >
                          下载
                        </button>
                        {user?.role === "admin" ? (
                          <button
                            type="button"
                            className="secondary native-utility-button"
                            disabled={busyKey === `activate-user-model-${model.name}` || model.is_active}
                            onClick={() => runAssetAction(`activate-user-model-${model.name}`, async () => {
                              const payload = await selectActiveModel(token, model.name);
                              await reloadModels(payload?.message || `已切换模型 ${model.name}。`);
                            })}
                          >
                            {model.is_active ? "正在使用" : "设为当前"}
                          </button>
                        ) : null}
                        {model.can_manage ? (
                          <button
                            type="button"
                            className="secondary native-utility-button"
                            disabled={busyKey === `delete-user-model-${model.name}`}
                            onClick={() => {
                              if (!window.confirm(`确定删除模型 ${model.name} 吗？`)) {
                                return;
                              }
                              runAssetAction(`delete-user-model-${model.name}`, async () => {
                                const payload = await deleteModelAsset(token, model.name);
                                await reloadModels(payload?.message || `模型 ${model.name} 已删除。`);
                              });
                            }}
                          >
                            删除
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="asset-collection asset-collection--wide">
              <div className="asset-collection__head">
                <div>
                  <p className="workspace__section-label">Operations</p>
                  <h3>{isAdmin ? "站点使用路径" : "常用操作"}</h3>
                </div>
              </div>
              <div className="guide-grid">
                <article className="guide-card">
                  <span>识别</span>
                  <strong>上传或采集叶片图片</strong>
                  <p>识别页会返回类别、置信度和检测框，并可继续送去标注。</p>
                </article>
                <article className="guide-card">
                  <span>标注</span>
                  <strong>导入识别框并修正</strong>
                  <p>标注页会把图片和 YOLO 标签写入选中的数据集，并继续增强与训练。</p>
                </article>
                {isAdmin ? (
                  <article className="guide-card">
                    <span>部署</span>
                    <strong>统一走同源 /api</strong>
                    <p>构建后前端静态资源和 API 代理可以直接交给反向代理统一发布。</p>
                  </article>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
