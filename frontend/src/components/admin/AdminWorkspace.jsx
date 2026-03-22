import { useEffect, useMemo, useState } from "react";
import { FileField } from "@/components/shared/FileField";
import {
  deleteUserAccount,
  fetchAdminConsole,
  fetchUsers,
  selectAdminAugmentation,
  setUserDisabled,
  setUserFlagged,
  uploadAdminAugmentation,
  uploadAdminDataset,
  uploadAdminModel,
} from "@/lib/adminApi";
import { saveBlobAsFile } from "@/lib/download";
import {
  deleteAnnotationDataset,
  deleteModelAsset,
  downloadAnnotationDataset,
  downloadModelArchive,
  selectActiveModel,
} from "@/lib/plantApi";

function formatBytes(sizeBytes) {
  const value = Number(sizeBytes);
  if (!Number.isFinite(value) || value < 0) {
    return "--";
  }
  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current.toFixed(current >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) {
    return "时间未知";
  }
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function describeOwner(item) {
  return item.owner_display_name || item.owner_username || (item.is_official ? "官方资源" : "当前用户");
}

function buildUserTone(user) {
  if (user.role === "admin") {
    return "管理员";
  }
  if (user.is_disabled) {
    return "已封禁";
  }
  if (user.is_flagged) {
    return "重点关注";
  }
  return "普通用户";
}

export function AdminWorkspace({ token, isAuthenticated, user }) {
  const isAdmin = user?.role === "admin";
  const [consoleData, setConsoleData] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("管理员登录后可以在这里统一维护用户、模型、数据集和增强脚本。");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [selectedAugmentation, setSelectedAugmentation] = useState("");
  const [modelForm, setModelForm] = useState({
    modelFile: null,
    labelsFile: null,
    metadataFile: null,
    isPublic: true,
    activate: true,
  });
  const [datasetForm, setDatasetForm] = useState({
    datasetFile: null,
    datasetName: "",
    isPublic: true,
  });
  const [augmentationForm, setAugmentationForm] = useState({
    scriptFile: null,
    activate: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !token || !isAdmin) {
      setConsoleData(null);
      setUsers([]);
      setSelectedAugmentation("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      setError("");
      try {
        const [consolePayload, usersPayload] = await Promise.all([
          fetchAdminConsole(token),
          fetchUsers(token),
        ]);
        if (cancelled) {
          return;
        }
        setConsoleData(consolePayload?.data || null);
        setUsers(usersPayload?.data?.users || []);
        setSelectedAugmentation(
          consolePayload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
        );
        setStatus(consolePayload?.message || "管理员总控已加载。");
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message || "管理员总控加载失败。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isAuthenticated, token]);

  const metrics = useMemo(() => {
    const managedModels = consoleData?.managed_models || [];
    const managedDatasets = consoleData?.managed_datasets || [];
    const augmentations = consoleData?.managed_augmentation_scripts || [];
    return [
      {
        label: "当前在线模型",
        value: consoleData?.current_model || "--",
        note: `${managedModels.length} 个可管理模型`,
      },
      {
        label: "数据集资源",
        value: String(managedDatasets.length),
        note: "可直接下载或删除",
      },
      {
        label: "增强脚本",
        value: consoleData?.active_augmentation_script || consoleData?.builtin_augmentation_script || "--",
        note: `${augmentations.length} 个外部脚本`,
      },
      {
        label: "平台用户",
        value: String(users.length),
        note: `${users.filter((item) => item.is_flagged).length} 个重点关注`,
      },
    ];
  }, [consoleData, users]);

  async function reloadAdminState(message = "") {
    if (!token) {
      return;
    }
    const [consolePayload, usersPayload] = await Promise.all([
      fetchAdminConsole(token),
      fetchUsers(token),
    ]);
    setConsoleData(consolePayload?.data || null);
    setUsers(usersPayload?.data?.users || []);
    setSelectedAugmentation(
      consolePayload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
    );
    if (message) {
      setStatus(message);
    }
  }

  async function runAdminAction(key, action) {
    setBusyKey(key);
    setError("");
    try {
      await action();
    } catch (nextError) {
      setError(nextError.message || "管理员操作失败。");
    } finally {
      setBusyKey("");
    }
  }

  async function handleAdminModelUpload(event) {
    event.preventDefault();
    if (!modelForm.modelFile) {
      setError("请先选择要上传的 ONNX 模型。");
      return;
    }
    await runAdminAction("upload-model", async () => {
      const payload = await uploadAdminModel(token, modelForm);
      setConsoleData(payload?.data || null);
      setSelectedAugmentation(
        payload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || selectedAugmentation
      );
      setStatus(payload?.message || "模型已上传。");
      setModelForm({
        modelFile: null,
        labelsFile: null,
        metadataFile: null,
        isPublic: true,
        activate: true,
      });
      const usersPayload = await fetchUsers(token);
      setUsers(usersPayload?.data?.users || []);
    });
  }

  async function handleDatasetUpload(event) {
    event.preventDefault();
    if (!datasetForm.datasetFile) {
      setError("请先选择数据集压缩包。");
      return;
    }
    await runAdminAction("upload-dataset", async () => {
      const payload = await uploadAdminDataset(token, datasetForm);
      await reloadAdminState(payload?.message || "数据集已导入。");
      setDatasetForm({
        datasetFile: null,
        datasetName: "",
        isPublic: true,
      });
    });
  }

  async function handleAugmentationUpload(event) {
    event.preventDefault();
    if (!augmentationForm.scriptFile) {
      setError("请先选择增强脚本。");
      return;
    }
    await runAdminAction("upload-augmentation", async () => {
      const payload = await uploadAdminAugmentation(token, augmentationForm);
      setConsoleData(payload?.data || null);
      setSelectedAugmentation(
        payload?.data?.managed_augmentation_scripts?.find((item) => item.is_active)?.name || ""
      );
      setStatus(payload?.message || "增强脚本已上传。");
      setAugmentationForm({
        scriptFile: null,
        activate: true,
      });
    });
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <section className="native-workspace native-workspace--admin">
        <div className="native-workspace__panel native-workspace__panel--controls">
          <div className="native-workspace__section-head">
            <p className="workspace__section-label">Admin</p>
            <h3>平台管理</h3>
            <p>用户、模型、数据集和增强脚本都会在管理员登录后显示。</p>
          </div>
        </div>
        <div className="native-workspace__panel native-workspace__panel--canvas">
          <div className="native-lock-panel">
            <strong>{isAuthenticated ? "当前账号暂无管理员权限" : "当前模块需要管理员权限"}</strong>
            <p>
              {isAuthenticated
                ? "请切换到管理员账号后再维护平台用户、模型、数据集和增强脚本。"
                : "登录管理员账号后，这里会显示平台用户、资源分配和模型维护能力。"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="native-workspace native-workspace--admin">
      <div className="native-workspace__panel native-workspace__panel--controls">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Admin</p>
          <h3>平台管理</h3>
          <p>统一处理模型资产、数据集导入、增强算法切换和平台用户状态。</p>
        </div>

        <div className="ops-metric-grid ops-metric-grid--stacked">
          {metrics.slice(0, 2).map((item) => (
            <article key={item.label} className="ops-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>

        <div className="native-workspace__group">
          <div className="native-workspace__section-head native-workspace__section-head--tight">
            <h3>上传模型</h3>
            <p>支持 `.onnx` 主文件，可选标签文件和说明文件。</p>
          </div>
          <form className="native-form" onSubmit={handleAdminModelUpload}>
            <FileField
              label="模型文件"
              accept=".onnx"
              file={modelForm.modelFile}
              onChange={(file) => setModelForm((current) => ({ ...current, modelFile: file }))}
              buttonLabel="选择 ONNX"
            />
            <FileField
              label="标签文件"
              accept=".json"
              file={modelForm.labelsFile}
              onChange={(file) => setModelForm((current) => ({ ...current, labelsFile: file }))}
              buttonLabel="选择标签"
            />
            <FileField
              label="说明文件"
              accept=".json"
              file={modelForm.metadataFile}
              onChange={(file) => setModelForm((current) => ({ ...current, metadataFile: file }))}
              buttonLabel="选择说明"
            />
            <label className="native-checkbox">
              <input
                type="checkbox"
                checked={modelForm.isPublic}
                onChange={(event) => setModelForm((current) => ({ ...current, isPublic: event.target.checked }))}
              />
              <span>上传为公开模型</span>
            </label>
            <label className="native-checkbox">
              <input
                type="checkbox"
                checked={modelForm.activate}
                onChange={(event) => setModelForm((current) => ({ ...current, activate: event.target.checked }))}
              />
              <span>上传后立即启用</span>
            </label>
            <button type="submit" className="primary" disabled={busyKey === "upload-model"}>
              {busyKey === "upload-model" ? "上传中..." : "上传模型"}
            </button>
          </form>
        </div>

        <div className="native-workspace__group">
          <div className="native-workspace__section-head native-workspace__section-head--tight">
            <h3>导入数据集</h3>
            <p>直接导入压缩包，导入后可在标注工作区继续编辑和训练。</p>
          </div>
          <form className="native-form" onSubmit={handleDatasetUpload}>
            <FileField
              label="数据集压缩包"
              accept=".zip"
              file={datasetForm.datasetFile}
              onChange={(file) => setDatasetForm((current) => ({ ...current, datasetFile: file }))}
              buttonLabel="选择 ZIP"
            />
            <label className="native-field">
              <span>数据集名称</span>
              <input
                value={datasetForm.datasetName}
                onChange={(event) => setDatasetForm((current) => ({ ...current, datasetName: event.target.value }))}
                placeholder="留空则使用压缩包文件名"
              />
            </label>
            <label className="native-checkbox">
              <input
                type="checkbox"
                checked={datasetForm.isPublic}
                onChange={(event) => setDatasetForm((current) => ({ ...current, isPublic: event.target.checked }))}
              />
              <span>上传为公开数据集</span>
            </label>
            <button type="submit" className="secondary" disabled={busyKey === "upload-dataset"}>
              {busyKey === "upload-dataset" ? "导入中..." : "导入数据集"}
            </button>
          </form>
        </div>

        <div className="native-workspace__group">
          <div className="native-workspace__section-head native-workspace__section-head--tight">
            <h3>增强脚本</h3>
            <p>上传 Python 增强脚本，或切回内置增强算法。</p>
          </div>
          <form className="native-form" onSubmit={handleAugmentationUpload}>
            <FileField
              label="增强脚本"
              accept=".py"
              file={augmentationForm.scriptFile}
              onChange={(file) => setAugmentationForm((current) => ({ ...current, scriptFile: file }))}
              buttonLabel="选择脚本"
            />
            <label className="native-checkbox">
              <input
                type="checkbox"
                checked={augmentationForm.activate}
                onChange={(event) => setAugmentationForm((current) => ({ ...current, activate: event.target.checked }))}
              />
              <span>上传后立即启用</span>
            </label>
            <div className="native-inline-actions">
              <button type="submit" className="secondary" disabled={busyKey === "upload-augmentation"}>
                {busyKey === "upload-augmentation" ? "上传中..." : "上传脚本"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busyKey === "select-builtin"}
                onClick={() => runAdminAction("select-builtin", async () => {
                  const payload = await selectAdminAugmentation(token);
                  setConsoleData(payload?.data || null);
                  setSelectedAugmentation("");
                  setStatus(payload?.message || "已切回内置增强算法。");
                })}
              >
                切回内置增强
              </button>
            </div>
          </form>
        </div>

        <div className="native-feedback">
          <p>{status}</p>
          {error ? <strong>{error}</strong> : null}
          {loading ? <span>正在刷新管理员数据...</span> : null}
        </div>
      </div>

      <div className="native-workspace__panel native-workspace__panel--canvas">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Control Board</p>
          <h3>资源总控</h3>
          <p>全部资源都在同一页集中展示，减少在旧工作台和新页面之间来回切换。</p>
        </div>

        <div className="ops-metric-grid">
          {metrics.map((item) => (
            <article key={item.label} className="ops-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>

        <div className="admin-board">
          <section className="asset-collection asset-collection--wide">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Users</p>
                <h3>平台用户</h3>
              </div>
              <button type="button" className="secondary native-utility-button" onClick={() => runAdminAction("refresh-admin", async () => reloadAdminState("管理员数据已刷新。"))}>
                刷新
              </button>
            </div>
            {!users.length ? (
              <div className="native-empty native-empty--compact">
                <p>当前还没有可展示的用户。</p>
              </div>
            ) : (
              <div className="admin-user-grid">
                {users.map((user) => (
                  <article key={user.id} className="admin-user-card">
                    <div className="admin-user-card__head">
                      <div>
                        <strong>{user.display_name || user.username}</strong>
                        <span>@{user.username}</span>
                      </div>
                      <span className={`native-pill native-pill--${user.role === "admin" ? "accent" : user.is_disabled ? "critical" : user.is_flagged ? "warm" : "neutral"}`}>
                        {buildUserTone(user)}
                      </span>
                    </div>
                    <div className="admin-user-card__stats">
                      <span>{user.dataset_count} 个数据集</span>
                      <span>{user.model_count} 个模型</span>
                    </div>
                    {user.role !== "admin" ? (
                      <div className="asset-row__actions">
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `flag-${user.id}`}
                          onClick={() => runAdminAction(`flag-${user.id}`, async () => {
                            const payload = await setUserFlagged(token, user.id, !user.is_flagged);
                            setUsers(payload?.data?.users || []);
                            setStatus(payload?.message || "用户关注状态已更新。");
                          })}
                        >
                          {user.is_flagged ? "取消关注" : "重点关注"}
                        </button>
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `disable-${user.id}`}
                          onClick={() => runAdminAction(`disable-${user.id}`, async () => {
                            const payload = await setUserDisabled(token, user.id, !user.is_disabled);
                            setUsers(payload?.data?.users || []);
                            setStatus(payload?.message || "用户封禁状态已更新。");
                          })}
                        >
                          {user.is_disabled ? "解除封禁" : "封禁用户"}
                        </button>
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `delete-user-${user.id}`}
                          onClick={() => {
                            if (!window.confirm(`确定删除用户 ${user.username} 吗？这会同时清理其模型和数据集。`)) {
                              return;
                            }
                            runAdminAction(`delete-user-${user.id}`, async () => {
                              const payload = await deleteUserAccount(token, user.id);
                              setUsers(payload?.data?.users || []);
                              await reloadAdminState(payload?.message || "用户已删除。");
                            });
                          }}
                        >
                          删除
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="asset-collection asset-collection--wide">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Models</p>
                <h3>模型资源</h3>
              </div>
              <span className="native-pill native-pill--accent">{consoleData?.current_model || "未启用"}</span>
            </div>
            {!consoleData?.managed_models?.length ? (
              <div className="native-empty native-empty--compact">
                <p>还没有模型资源。</p>
              </div>
            ) : (
              <div className="asset-list">
                {consoleData.managed_models.map((model) => (
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
                      <p>{describeOwner(model)} · {formatBytes(model.size_bytes)} · {formatDate(model.uploaded_at)}</p>
                    </div>
                    <div className="asset-row__actions">
                      <button
                        type="button"
                        className="secondary native-utility-button"
                        disabled={busyKey === `download-model-${model.name}`}
                        onClick={() => runAdminAction(`download-model-${model.name}`, async () => {
                          const blob = await downloadModelArchive(token, model.name);
                          saveBlobAsFile(blob, `${model.name.replace(/\.onnx$/i, "")}_model.zip`);
                          setStatus(`模型 ${model.name} 已开始下载。`);
                        })}
                      >
                        下载
                      </button>
                      <button
                        type="button"
                        className="secondary native-utility-button"
                        disabled={busyKey === `select-model-${model.name}` || model.is_active}
                        onClick={() => runAdminAction(`select-model-${model.name}`, async () => {
                          const payload = await selectActiveModel(token, model.name);
                          await reloadAdminState(payload?.message || `已切换模型 ${model.name}。`);
                        })}
                      >
                        {model.is_active ? "正在使用" : "设为当前"}
                      </button>
                      {model.can_manage ? (
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `delete-model-${model.name}`}
                          onClick={() => {
                            if (!window.confirm(`确定删除模型 ${model.name} 吗？`)) {
                              return;
                            }
                            runAdminAction(`delete-model-${model.name}`, async () => {
                              const payload = await deleteModelAsset(token, model.name);
                              await reloadAdminState(payload?.message || `模型 ${model.name} 已删除。`);
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

          <section className="asset-collection">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Datasets</p>
                <h3>数据集资源</h3>
              </div>
            </div>
            {!consoleData?.managed_datasets?.length ? (
              <div className="native-empty native-empty--compact">
                <p>还没有可管理的数据集。</p>
              </div>
            ) : (
              <div className="asset-list asset-list--compact">
                {consoleData.managed_datasets.map((dataset) => (
                  <article key={dataset.name} className="asset-row asset-row--compact">
                    <div className="asset-row__main">
                      <div className="asset-row__title">
                        <strong>{dataset.name}</strong>
                        <div className="asset-row__badges">
                          <span className="native-pill native-pill--neutral">{dataset.is_public ? "公开" : "私有"}</span>
                          {dataset.is_official ? <span className="native-pill native-pill--warm">官方</span> : null}
                        </div>
                      </div>
                      <p>{describeOwner(dataset)} · {formatDate(dataset.uploaded_at)}</p>
                    </div>
                    <div className="asset-row__actions">
                      <button
                        type="button"
                        className="secondary native-utility-button"
                        disabled={busyKey === `download-dataset-${dataset.name}`}
                        onClick={() => runAdminAction(`download-dataset-${dataset.name}`, async () => {
                          const blob = await downloadAnnotationDataset(token, dataset.name);
                          saveBlobAsFile(blob, `${dataset.name}_dataset.zip`);
                          setStatus(`数据集 ${dataset.name} 已开始下载。`);
                        })}
                      >
                        下载
                      </button>
                      {dataset.can_manage ? (
                        <button
                          type="button"
                          className="secondary native-utility-button"
                          disabled={busyKey === `delete-dataset-${dataset.name}`}
                          onClick={() => {
                            if (!window.confirm(`确定删除数据集 ${dataset.name} 吗？`)) {
                              return;
                            }
                            runAdminAction(`delete-dataset-${dataset.name}`, async () => {
                              const payload = await deleteAnnotationDataset(token, dataset.name);
                              await reloadAdminState(payload?.message || `数据集 ${dataset.name} 已删除。`);
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

          <section className="asset-collection">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Augmentation</p>
                <h3>增强脚本</h3>
              </div>
              <span className="native-pill native-pill--neutral">
                {consoleData?.active_augmentation_script || consoleData?.builtin_augmentation_script || "--"}
              </span>
            </div>
            <div className="native-field">
              <span>快速切换</span>
              <select
                value={selectedAugmentation}
                onChange={(event) => setSelectedAugmentation(event.target.value)}
              >
                <option value="">内置增强算法</option>
                {(consoleData?.managed_augmentation_scripts || []).map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="native-inline-actions">
              <button
                type="button"
                className="secondary"
                disabled={busyKey === "apply-augmentation"}
                onClick={() => runAdminAction("apply-augmentation", async () => {
                  const payload = await selectAdminAugmentation(token, selectedAugmentation);
                  setConsoleData(payload?.data || null);
                  setStatus(payload?.message || "增强脚本已切换。");
                })}
              >
                应用当前选择
              </button>
            </div>
            {!consoleData?.managed_augmentation_scripts?.length ? (
              <div className="native-empty native-empty--compact">
                <p>还没有外部增强脚本，当前使用内置增强。</p>
              </div>
            ) : (
              <div className="asset-list asset-list--compact">
                {consoleData.managed_augmentation_scripts.map((script) => (
                  <article key={script.name} className={`asset-row asset-row--compact${script.is_active ? " is-active" : ""}`}>
                    <div className="asset-row__main">
                      <div className="asset-row__title">
                        <strong>{script.name}</strong>
                        {script.is_active ? <span className="native-pill native-pill--accent">当前脚本</span> : null}
                      </div>
                      <p>{formatBytes(script.size_bytes)} · {formatDate(script.uploaded_at)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
