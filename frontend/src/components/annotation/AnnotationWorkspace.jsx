import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addAnnotationClass,
  augmentAnnotationDataset,
  createAnnotationDataset,
  deleteAnnotationClass,
  deleteAnnotationDataset,
  downloadAnnotationDataset,
  fetchAnnotationClasses,
  fetchModels,
  fetchTrainingTask,
  saveAnnotationFile,
  startTrainingTask,
} from "@/lib/plantApi";
import { saveBlobAsFile } from "@/lib/download";
import { validateImageFile } from "@/lib/imageFiles";

function revokeUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function normalizeBox(box) {
  return {
    label: box.label,
    x1: Math.min(box.x1, box.x2),
    y1: Math.min(box.y1, box.y2),
    x2: Math.max(box.x1, box.x2),
    y2: Math.max(box.y1, box.y2),
    source: box.source || "manual",
  };
}

function toFixedBox(box) {
  return {
    label: box.label,
    x1: Number(box.x1.toFixed(2)),
    y1: Number(box.y1.toFixed(2)),
    x2: Number(box.x2.toFixed(2)),
    y2: Number(box.y2.toFixed(2)),
    source: box.source || "manual",
  };
}

function getDatasetMeta(datasetItems, datasetName, fallback = {}) {
  return datasetItems.find((item) => item.name === datasetName) || {
    name: datasetName || "",
    is_public: Boolean(fallback.selected_dataset_is_public),
    is_official: Boolean(fallback.selected_dataset_is_official),
    can_write: Boolean(fallback.selected_dataset_can_write),
    owner_username: String(fallback.selected_dataset_owner_username || ""),
    owner_display_name: String(fallback.selected_dataset_owner_display_name || ""),
  };
}

function boxContainsPoint(box, x, y) {
  return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2;
}

function formatPercent(progress) {
  const numeric = Number(progress);
  if (!Number.isFinite(numeric)) {
    return "0%";
  }
  return `${Math.max(0, Math.min(100, Math.round(numeric * 100)))}%`;
}

function boxStyle(box, imageMeta) {
  if (!imageMeta.width || !imageMeta.height) {
    return null;
  }
  return {
    left: `${(box.x1 / imageMeta.width) * 100}%`,
    top: `${(box.y1 / imageMeta.height) * 100}%`,
    width: `${((box.x2 - box.x1) / imageMeta.width) * 100}%`,
    height: `${((box.y2 - box.y1) / imageMeta.height) * 100}%`,
  };
}

function readPoint(event, frameElement, imageMeta) {
  if (!frameElement || !imageMeta.width || !imageMeta.height) {
    return null;
  }
  const rect = frameElement.getBoundingClientRect();
  const xRatio = (event.clientX - rect.left) / rect.width;
  const yRatio = (event.clientY - rect.top) / rect.height;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) {
    return null;
  }
  return {
    x: xRatio * imageMeta.width,
    y: yRatio * imageMeta.height,
  };
}

export function AnnotationWorkspace({
  token,
  isAuthenticated,
  recognitionPayload = null,
}) {
  const imageInputRef = useRef(null);
  const frameRef = useRef(null);
  const activeTaskRef = useRef("");

  const [datasetState, setDatasetState] = useState({
    loading: false,
    datasetItems: [],
    selectedDataset: "",
    classes: [],
    classAdvices: [],
    datasetMeta: null,
    counts: { source: 0, train: 0, val: 0 },
    hint: "",
  });
  const [models, setModels] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 });
  const [boxes, setBoxes] = useState([]);
  const [draftBox, setDraftBox] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [status, setStatus] = useState("登录后即可在这里管理数据集、框选标注并发起训练任务。");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [augmenting, setAugmenting] = useState(false);
  const [training, setTraining] = useState(false);
  const [datasetCreateName, setDatasetCreateName] = useState("");
  const [datasetPublic, setDatasetPublic] = useState(false);
  const [customClass, setCustomClass] = useState("");
  const [augmentCopies, setAugmentCopies] = useState(2);
  const [focusMode, setFocusMode] = useState(false);
  const [trainForm, setTrainForm] = useState({
    baseModel: "yolov8n.pt",
    modelName: "",
    epochs: 50,
    imgsz: 640,
  });
  const [trainTask, setTrainTask] = useState(null);
  const canOperate = Boolean(isAuthenticated && token);

  useEffect(() => {
    return () => revokeUrl(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) {
      setFocusMode(false);
    }
  }, [imageUrl]);

  useEffect(() => {
    if (!focusMode) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setFocusMode(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusMode]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setDatasetState((current) => ({
        ...current,
        datasetItems: [],
        selectedDataset: "",
        classes: [],
        classAdvices: [],
        datasetMeta: null,
      }));
      setModels([]);
      return;
    }

    let cancelled = false;
    async function bootstrap() {
      setDatasetState((current) => ({ ...current, loading: true }));
      try {
        const [classesPayload, modelsPayload] = await Promise.all([
          fetchAnnotationClasses(token),
          fetchModels(token),
        ]);
        if (cancelled) {
          return;
        }
        applyAnnotationPayload(classesPayload?.data || {});
        const availableModels = Array.isArray(modelsPayload?.data?.available_models) ? modelsPayload.data.available_models : [];
        setModels(availableModels);
        if (availableModels.length && !trainForm.baseModel) {
          setTrainForm((current) => ({ ...current, baseModel: availableModels[0] }));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message || "标注数据初始化失败。");
        }
      } finally {
        if (!cancelled) {
          setDatasetState((current) => ({ ...current, loading: false }));
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token]);

  function applyAnnotationPayload(data) {
    const datasetItems = Array.isArray(data.available_dataset_items) && data.available_dataset_items.length
      ? data.available_dataset_items
      : (data.available_datasets || []).map((name) => ({ name }));
    const selectedDataset = data.selected_dataset || datasetItems[0]?.name || "";
    const classes = Array.isArray(data.classes) ? data.classes : [];
    const classAdvices = Array.isArray(data.class_advices) ? data.class_advices : [];
    const datasetMeta = selectedDataset ? getDatasetMeta(datasetItems, selectedDataset, data) : null;
    setDatasetState({
      loading: false,
      datasetItems,
      selectedDataset,
      classes,
      classAdvices,
      datasetMeta,
      counts: {
        source: Number(data.source_pair_count) || 0,
        train: Number(data.train_pair_count) || 0,
        val: Number(data.val_pair_count) || 0,
      },
      hint: selectedDataset
        ? `数据集 ${selectedDataset} ｜ 原始样本 ${Number(data.source_pair_count) || 0} ｜ train ${Number(data.train_pair_count) || 0} ｜ val ${Number(data.val_pair_count) || 0}`
        : "当前没有可访问数据集。",
    });
    setSelectedClass((current) => (classes.includes(current) ? current : (classes[0] || "")));
  }

  function handleSelectedClassChange(nextClass) {
    setSelectedClass(nextClass);
    if (selectedIndex >= 0) {
      setBoxes((current) => current.map((item, index) => (
        index === selectedIndex ? { ...item, label: nextClass } : item
      )));
    }
  }

  async function reloadAnnotationData(datasetName = datasetState.selectedDataset) {
    if (!token) {
      return;
    }
    setDatasetState((current) => ({ ...current, loading: true }));
    try {
      const payload = await fetchAnnotationClasses(token, datasetName);
      applyAnnotationPayload(payload?.data || {});
    } catch (nextError) {
      setError(nextError.message || "标注数据加载失败。");
    }
  }

  async function handleDatasetCreate() {
    if (!datasetCreateName.trim()) {
      setError("请先输入数据集名称。");
      return;
    }
    try {
      setError("");
      const payload = await createAnnotationDataset(token, {
        dataset_name: datasetCreateName.trim(),
        source_dataset: datasetState.selectedDataset || undefined,
        is_public: datasetPublic,
      });
      applyAnnotationPayload(payload?.data || {});
      setDatasetCreateName("");
      setDatasetPublic(false);
      setStatus(`数据集 ${payload?.data?.selected_dataset || datasetCreateName.trim()} 已创建。`);
    } catch (nextError) {
      setError(nextError.message || "数据集创建失败。");
    }
  }

  async function handleDatasetDelete() {
    if (!datasetState.selectedDataset) {
      return;
    }
    if (!window.confirm(`确定删除数据集“${datasetState.selectedDataset}”吗？`)) {
      return;
    }
    try {
      setError("");
      const payload = await deleteAnnotationDataset(token, datasetState.selectedDataset);
      applyAnnotationPayload(payload?.data || {});
      setStatus(`数据集 ${datasetState.selectedDataset} 已删除。`);
    } catch (nextError) {
      setError(nextError.message || "数据集删除失败。");
    }
  }

  async function handleDatasetDownload() {
    if (!datasetState.selectedDataset) {
      return;
    }
    try {
      const blob = await downloadAnnotationDataset(token, datasetState.selectedDataset);
      saveBlobAsFile(blob, `${datasetState.selectedDataset}_dataset.zip`);
      setStatus(`数据集 ${datasetState.selectedDataset} 已开始下载。`);
    } catch (nextError) {
      setError(nextError.message || "数据集下载失败。");
    }
  }

  async function handleAddClass() {
    if (!customClass.trim() || !datasetState.selectedDataset) {
      setError("请先选择数据集并输入类别名。");
      return;
    }
    try {
      setError("");
      const payload = await addAnnotationClass(token, datasetState.selectedDataset, customClass.trim());
      applyAnnotationPayload(payload?.data || {});
      setSelectedClass((payload?.data?.classes || []).find((item) => item === customClass.trim()) || customClass.trim());
      setCustomClass("");
      setStatus(payload?.message || `类别 ${customClass.trim()} 已加入当前数据集。`);
    } catch (nextError) {
      setError(nextError.message || "类别添加失败。");
    }
  }

  async function handleDeleteClass() {
    if (!datasetState.selectedDataset || !selectedClass) {
      return;
    }
    if (!window.confirm(`确定删除类别“${selectedClass}”吗？`)) {
      return;
    }
    try {
      setError("");
      const deletingClass = selectedClass;
      const payload = await deleteAnnotationClass(token, datasetState.selectedDataset, deletingClass);
      applyAnnotationPayload(payload?.data || {});
      setBoxes((current) => current.filter((item) => item.label !== deletingClass));
      setSelectedIndex(-1);
      setStatus(`类别 ${deletingClass} 已删除。`);
    } catch (nextError) {
      setError(nextError.message || "类别删除失败。");
    }
  }

  function setImageFromFile(file, nextStatus) {
    revokeUrl(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setBoxes([]);
    setDraftBox(null);
    setSelectedIndex(-1);
    setFocusMode(true);
    setStatus(nextStatus);
    setError("");
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setImageFromFile(file, `已载入图片 ${file.name}，现在可以开始框选标注。`);
  }

  function handleUseRecognitionImage() {
    if (!recognitionPayload?.file) {
      setError("当前没有来自识别页的图片。");
      return;
    }
    setImageFromFile(recognitionPayload.file, `已导入识别页图片 ${recognitionPayload.file.name}。`);
  }

  function handleImportDetections() {
    if (!recognitionPayload?.result?.detections?.length || !datasetState.classes.length) {
      setError("当前没有可导入的检测框。");
      return;
    }
    const supported = recognitionPayload.result.detections
      .filter((item) => Array.isArray(item.bbox) && item.bbox.length === 4 && datasetState.classes.includes(item.label))
      .map((item) => normalizeBox({
        label: item.label,
        x1: item.bbox[0],
        y1: item.bbox[1],
        x2: item.bbox[2],
        y2: item.bbox[3],
        source: "assist",
      }));
    if (!supported.length) {
      setError("当前识别结果和数据集类别没有交集，无法直接导入。");
      return;
    }
    setBoxes((current) => current.concat(supported));
    setSelectedIndex(supported.length ? boxes.length + supported.length - 1 : -1);
    setStatus(`已导入 ${supported.length} 个识别框，可继续人工修正。`);
  }

  function handlePointerDown(event) {
    if (!imageMeta.width || !imageMeta.height || !selectedClass) {
      return;
    }
    const point = readPoint(event, frameRef.current, imageMeta);
    if (!point) {
      return;
    }

    for (let index = boxes.length - 1; index >= 0; index -= 1) {
      if (boxContainsPoint(boxes[index], point.x, point.y)) {
        setSelectedIndex(index);
        setSelectedClass(boxes[index].label);
        return;
      }
    }

    setSelectedIndex(-1);
    setDraftBox({
      label: selectedClass,
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
      source: "manual",
    });
  }

  function handlePointerMove(event) {
    if (!draftBox) {
      return;
    }
    const point = readPoint(event, frameRef.current, imageMeta);
    if (!point) {
      return;
    }
    setDraftBox((current) => current ? { ...current, x2: point.x, y2: point.y } : current);
  }

  function finalizeDraft(event) {
    if (!draftBox) {
      return;
    }
    const point = readPoint(event, frameRef.current, imageMeta);
    const nextDraft = point ? { ...draftBox, x2: point.x, y2: point.y } : draftBox;
    const normalized = normalizeBox(nextDraft);
    setDraftBox(null);
    if (normalized.x2 - normalized.x1 < 4 || normalized.y2 - normalized.y1 < 4) {
      return;
    }
    setBoxes((current) => current.concat(normalized));
    setSelectedIndex(boxes.length);
  }

  function handleDeleteSelectedBox() {
    if (selectedIndex < 0 || !boxes[selectedIndex]) {
      return;
    }
    setBoxes((current) => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex(-1);
  }

  async function handleSaveAnnotations() {
    if (!imageFile || !boxes.length || !datasetState.selectedDataset) {
      setError("请先准备图片、标注框和目标数据集。");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = await saveAnnotationFile(token, {
        file: imageFile,
        datasetName: datasetState.selectedDataset,
        annotations: boxes.map(toFixedBox),
      });
      setStatus(`保存成功：${payload?.data?.filename} 已写入数据集 ${payload?.data?.dataset_name}。`);
      await reloadAnnotationData(datasetState.selectedDataset);
    } catch (nextError) {
      setError(nextError.message || "标注保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleAugment() {
    if (!datasetState.selectedDataset) {
      return;
    }
    try {
      setAugmenting(true);
      setError("");
      const payload = await augmentAnnotationDataset(token, {
        dataset_name: datasetState.selectedDataset,
        copies: Number(augmentCopies),
        train_ratio: 0.8,
      });
      setStatus(`增强完成：${payload?.data?.dataset_name || datasetState.selectedDataset}，train ${payload?.data?.train_count ?? 0} / val ${payload?.data?.val_count ?? 0}。`);
      await reloadAnnotationData(datasetState.selectedDataset);
    } catch (nextError) {
      setError(nextError.message || "数据增强失败。");
    } finally {
      setAugmenting(false);
    }
  }

  async function handleTrain() {
    if (!datasetState.selectedDataset) {
      return;
    }
    try {
      setTraining(true);
      setError("");
      const payload = await startTrainingTask(token, {
        dataset_name: datasetState.selectedDataset,
        base_model: trainForm.baseModel,
        model_name: trainForm.modelName || undefined,
        epochs: Number(trainForm.epochs),
        imgsz: Number(trainForm.imgsz),
      });
      const task = payload?.data || null;
      if (!task?.task_id) {
        throw new Error("训练任务创建成功，但没有返回 task_id。");
      }
      activeTaskRef.current = task.task_id;
      setTrainTask(task);
      setStatus(`训练任务已启动：${task.task_id}`);
    } catch (nextError) {
      setTraining(false);
      setError(nextError.message || "训练任务启动失败。");
    }
  }

  useEffect(() => {
    if (!trainTask?.task_id || !training) {
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const payload = await fetchTrainingTask(token, trainTask.task_id);
        if (cancelled || activeTaskRef.current !== trainTask.task_id) {
          return;
        }
        const nextTask = payload?.data || null;
        setTrainTask(nextTask);
        if (nextTask?.status === "completed") {
          setTraining(false);
          setStatus(`训练完成：${nextTask?.result?.model_name || "新模型"} 已生成。`);
          return;
        }
        if (nextTask?.status === "failed") {
          setTraining(false);
          setError(nextTask?.error || nextTask?.message || "训练失败。");
          return;
        }
        window.setTimeout(poll, 2000);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message || "训练进度获取失败。");
          setTraining(false);
        }
      }
    }
    const timer = window.setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, trainTask, training]);

  const draftStyle = useMemo(() => (draftBox ? boxStyle(normalizeBox(draftBox), imageMeta) : null), [draftBox, imageMeta]);
  const canWrite = Boolean(datasetState.datasetMeta?.can_write);
  const selectedClassAdvice = useMemo(
    () => datasetState.classAdvices.find((item) => item.class_name === selectedClass) || null,
    [datasetState.classAdvices, selectedClass],
  );
  const selectedBox = selectedIndex >= 0 ? boxes[selectedIndex] || null : null;

  function renderAnnotationStageSurface(stageClassName = "annotation-stage") {
    return (
      <div className={stageClassName}>
        {imageUrl ? (
          <div
            ref={frameRef}
            className="annotation-stage__frame"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finalizeDraft}
            onPointerLeave={finalizeDraft}
          >
            <img
              src={imageUrl}
              alt="标注图片"
              onLoad={(event) => {
                setImageMeta({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />
            <div className="annotation-stage__overlay" aria-hidden="true">
              {boxes.map((box, index) => {
                const style = boxStyle(box, imageMeta);
                if (!style) {
                  return null;
                }
                return (
                  <button
                    key={`${box.label}-${index}-${box.x1}`}
                    type="button"
                    className={`annotation-box${selectedIndex === index ? " is-active" : ""}${box.source === "assist" ? " is-assist" : ""}`}
                    style={style}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedIndex(index);
                      setSelectedClass(box.label);
                    }}
                  >
                    <span>{box.label}</span>
                  </button>
                );
              })}
              {draftStyle ? <span className="annotation-box annotation-box--draft" style={draftStyle} /> : null}
            </div>
          </div>
        ) : (
          <div className="native-empty">
            <strong>还没有标注图片</strong>
            <p>可以单独上传图片，也可以直接接收识别页中的图片和检测框。</p>
          </div>
        )}
      </div>
    );
  }

  const focusOverlay = focusMode && imageUrl ? createPortal(
    <div className="annotation-focus" role="dialog" aria-modal="true" aria-label="专注标注模式">
      <div className="annotation-focus__shell">
        <header className="annotation-focus__toolbar">
          <div className="annotation-focus__toolbar-group">
            <div className="annotation-focus__meta">
              <span>数据集</span>
              <strong>{datasetState.selectedDataset || "--"}</strong>
            </div>
            <label className="native-field annotation-focus__field">
              <span>当前类别</span>
              <select value={selectedClass} onChange={(event) => handleSelectedClassChange(event.target.value)} disabled={!canOperate || !datasetState.classes.length}>
                {!datasetState.classes.length ? <option value="">暂无类别</option> : null}
                {datasetState.classes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="annotation-focus__quick-input"
              value={customClass}
              onChange={(event) => setCustomClass(event.target.value)}
              placeholder="新增类别"
              disabled={!canOperate || !canWrite}
            />
            <button type="button" className="secondary" onClick={handleAddClass} disabled={!canOperate || !canWrite || !customClass.trim()}>
              添加类别
            </button>
          </div>
          <div className="annotation-focus__toolbar-group annotation-focus__toolbar-group--actions">
            <button type="button" className="secondary" onClick={() => imageInputRef.current?.click()} disabled={!canOperate}>
              更换图片
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleImportDetections}
              disabled={!canOperate || !recognitionPayload?.result?.detections?.length || !imageFile}
            >
              导入识别框
            </button>
            <button type="button" className="secondary" onClick={handleDeleteSelectedBox} disabled={!canOperate || selectedIndex < 0}>
              删除选中框
            </button>
            <button type="button" className="primary" onClick={handleSaveAnnotations} disabled={!canOperate || !canWrite || !imageFile || !boxes.length || saving}>
              {saving ? "保存中..." : "保存标注"}
            </button>
            <button type="button" className="secondary" onClick={() => setFocusMode(false)}>
              退出全屏
            </button>
          </div>
        </header>

        <div className="annotation-focus__stage-wrap">
          {renderAnnotationStageSurface("annotation-stage annotation-stage--focus")}
        </div>

        <footer className="annotation-focus__dock">
          <div className="annotation-focus__summary">
            <span>当前状态</span>
            <strong>{selectedBox ? `已选中 ${selectedBox.label}` : "拖拽画布开始标注"}</strong>
            <p>
              {selectedBox
                ? `坐标 ${Math.round(selectedBox.x1)}, ${Math.round(selectedBox.y1)} · ${Math.round(selectedBox.x2)}, ${Math.round(selectedBox.y2)}`
                : "按 Esc 或右上角按钮退出全屏，普通页保留数据集管理和训练功能。"}
            </p>
          </div>
          <div className="annotation-focus__summary">
            <span>标注进度</span>
            <strong>{boxes.length} 个框</strong>
            <p>{selectedClassAdvice?.summary || "当前类别建议已收起到普通页左侧，专注模式只保留标注必需信息。"}</p>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <section className="native-workspace native-workspace--annotation">
      <div className="native-workspace__panel native-workspace__panel--controls annotation-sidebar">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Annotation</p>
          <h3>标注与训练</h3>
          <p>左侧只保留数据集和类别上下文，图片操作与保存放到画布附近，增强与训练移到下方流程区。</p>
        </div>

        <div className="native-workspace__group annotation-sidebar__section">
          <div className="annotation-sidebar__section-head">
            <div>
              <p className="workspace__section-label">01 Dataset</p>
              <h4>数据集与写入权限</h4>
            </div>
            <span className={`native-pill ${canWrite ? "native-pill--accent" : "native-pill--neutral"}`}>
              {canWrite ? "可写入" : "只读"}
            </span>
          </div>
          <label className="native-field">
            <span>当前数据集</span>
            <select
              value={datasetState.selectedDataset}
              onChange={(event) => reloadAnnotationData(event.target.value)}
              disabled={!canOperate || datasetState.loading}
            >
              {!datasetState.datasetItems.length ? <option value="">{datasetState.loading ? "正在加载..." : "暂无数据集"}</option> : null}
              {datasetState.datasetItems.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="native-hint">{datasetState.hint || "创建数据集后即可开始保存标注。"}</p>
          <div className="annotation-sidebar__stats">
            <article className="annotation-sidebar__stat">
              <span>原始样本</span>
              <strong>{datasetState.counts.source}</strong>
            </article>
            <article className="annotation-sidebar__stat">
              <span>Train</span>
              <strong>{datasetState.counts.train}</strong>
            </article>
            <article className="annotation-sidebar__stat">
              <span>Val</span>
              <strong>{datasetState.counts.val}</strong>
            </article>
          </div>
          <label className="native-field">
            <span>新建数据集</span>
            <input
              value={datasetCreateName}
              onChange={(event) => setDatasetCreateName(event.target.value)}
              placeholder="例如 tomato_leaf_v2"
              disabled={!canOperate}
            />
          </label>
          <label className="native-checkbox">
            <input type="checkbox" checked={datasetPublic} onChange={(event) => setDatasetPublic(event.target.checked)} disabled={!canOperate} />
            <span>创建为公开数据集</span>
          </label>
          <div className="native-inline-actions">
            <button type="button" className="secondary" onClick={handleDatasetCreate} disabled={!canOperate}>
              创建并切换
            </button>
            <button type="button" className="secondary" onClick={handleDatasetDownload} disabled={!canOperate || !datasetState.selectedDataset}>
              下载数据集
            </button>
            <button type="button" className="secondary" onClick={handleDatasetDelete} disabled={!canOperate || !datasetState.selectedDataset || !canWrite}>
              删除数据集
            </button>
          </div>
        </div>

        <div className="native-workspace__group annotation-sidebar__section">
          <div className="annotation-sidebar__section-head">
            <div>
              <p className="workspace__section-label">02 Classes</p>
              <h4>类别库与建议</h4>
            </div>
            <span className="native-pill native-pill--neutral">{datasetState.classes.length} 类</span>
          </div>
          <label className="native-field">
            <span>当前类别</span>
            <select value={selectedClass} onChange={(event) => handleSelectedClassChange(event.target.value)} disabled={!canOperate || !datasetState.classes.length}>
              {!datasetState.classes.length ? <option value="">暂无类别</option> : null}
              {datasetState.classes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="native-inline-actions">
            <input value={customClass} onChange={(event) => setCustomClass(event.target.value)} placeholder="新增类别" disabled={!canOperate || !canWrite} />
            <button type="button" className="secondary" onClick={handleAddClass} disabled={!canOperate || !canWrite}>
              添加
            </button>
            <button type="button" className="secondary" onClick={handleDeleteClass} disabled={!canOperate || !canWrite || !selectedClass || datasetState.classes.length <= 1}>
              删除
            </button>
          </div>
          {selectedClassAdvice ? (
            <div className="annotation-advice-card">
              <div className="annotation-advice-card__head">
                <strong>{selectedClassAdvice.class_name}</strong>
                <span>知识库建议</span>
              </div>
              <p>{selectedClassAdvice.summary}</p>
              {selectedClassAdvice.detail ? <p className="annotation-advice-card__meta">{selectedClassAdvice.detail}</p> : null}
              <ul className="native-list native-list--stacked">
                {selectedClassAdvice.advice.map((item) => (
                  <li key={item} className="native-list__item native-list__item--stacked">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="annotation-advice-card annotation-advice-card--placeholder">
              <div className="annotation-advice-card__head">
                <strong>{selectedClass || "尚未选择类别"}</strong>
                <span>建议区</span>
              </div>
              <p>新增类别后会自动调用实验室大模型生成建议并写入知识库缓存，后续识别和推荐会直接复用。</p>
            </div>
          )}
        </div>

        <div className="native-feedback">
          <p>{status}</p>
          {error ? <strong>{error}</strong> : null}
        </div>
      </div>

      <div className="native-workspace__panel native-workspace__panel--canvas annotation-board">
        <div className="native-workspace__section-head">
          <p className="workspace__section-label">Canvas</p>
          <h3>标注画面</h3>
          <p>图片导入、辅助框导入、清空与保存都贴近画布；增强和训练留在画布下方，不再打断框选流程。</p>
        </div>

        <input ref={imageInputRef} className="native-file-input" type="file" accept="image/*" onChange={handleImageChange} disabled={!canOperate} />

        <div className="annotation-toolbar">
          <div className="annotation-toolbar__group">
            <button type="button" className="primary" onClick={() => setFocusMode(true)} disabled={!imageUrl}>
              专注标注
            </button>
            <button type="button" className="secondary" onClick={() => imageInputRef.current?.click()} disabled={!canOperate}>
              选择标注图片
            </button>
            <button type="button" className="secondary" onClick={handleUseRecognitionImage} disabled={!canOperate || !recognitionPayload?.file}>
              使用识别图片
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleImportDetections}
              disabled={!canOperate || !recognitionPayload?.result?.detections?.length || !imageFile}
            >
              导入识别框
            </button>
          </div>
          <div className="annotation-toolbar__group">
            <button type="button" className="secondary" onClick={() => setBoxes([])} disabled={!canOperate || !boxes.length}>
              清空标注
            </button>
            <button type="button" className="secondary" onClick={handleDeleteSelectedBox} disabled={!canOperate || selectedIndex < 0}>
              删除选中框
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleSaveAnnotations}
              disabled={!canOperate || !canWrite || !imageFile || !boxes.length || saving}
            >
              {saving ? "保存中..." : "保存标注"}
            </button>
          </div>
        </div>

        <div className="annotation-board__main">
          <div className="annotation-stage-wrap">
            {renderAnnotationStageSurface()}

            <div className="annotation-stage__caption">
              <span>拖拽画布即可框选。点击已有框可以快速切换到对应类别。</span>
              <strong>{selectedBox ? `当前选中：${selectedBox.label}` : "当前未选中任何标注框"}</strong>
            </div>
          </div>

          <aside className="annotation-context">
            <div className="annotation-context-card">
              <p className="workspace__section-label">Selected</p>
              <h4>当前选中项</h4>
              {selectedBox ? (
                <ul className="annotation-context-list">
                  <li>
                    <span>类别</span>
                    <strong>{selectedBox.label}</strong>
                  </li>
                  <li>
                    <span>来源</span>
                    <strong>{selectedBox.source === "assist" ? "识别辅助" : "手动标注"}</strong>
                  </li>
                  <li>
                    <span>坐标</span>
                    <strong>
                      {Math.round(selectedBox.x1)}, {Math.round(selectedBox.y1)} · {Math.round(selectedBox.x2)}, {Math.round(selectedBox.y2)}
                    </strong>
                  </li>
                </ul>
              ) : (
                <p>点击画布中的任意标注框后，这里会显示类别、来源和坐标。</p>
              )}
            </div>
          </aside>
        </div>

        <div className="annotation-workflow-grid">
          <section className="asset-collection">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Boxes</p>
                <h3>标注列表</h3>
              </div>
              <span className="native-pill native-pill--neutral">{boxes.length} 个框</span>
            </div>
            {!boxes.length ? (
              <div className="native-empty native-empty--compact">
                <p>开始框选或导入识别框后，这里会显示所有标注项。</p>
              </div>
            ) : (
              <ul className="native-list native-list--stacked">
                {boxes.map((box, index) => (
                  <li key={`${box.label}-${index}`} className={`native-list__item native-list__item--stacked${selectedIndex === index ? " is-active" : ""}`}>
                    <button
                      type="button"
                      className="native-list__button"
                      onClick={() => {
                        setSelectedIndex(index);
                        setSelectedClass(box.label);
                      }}
                    >
                      <strong>{box.label}</strong>
                      <span>{box.source === "assist" ? "识别辅助" : "手动标注"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="asset-collection">
            <div className="asset-collection__head">
              <div>
                <p className="workspace__section-label">Workflow</p>
                <h3>增强与训练</h3>
              </div>
              <span className={`native-pill ${training ? "native-pill--warm" : "native-pill--neutral"}`}>
                {trainTask?.status || "待启动"}
              </span>
            </div>

            <div className="annotation-training-grid">
              <label className="native-field">
                <span>增强份数</span>
                <input type="number" min="1" value={augmentCopies} onChange={(event) => setAugmentCopies(event.target.value)} disabled={!canOperate || !canWrite} />
              </label>
              <div className="annotation-training-action">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleAugment}
                  disabled={!canOperate || !canWrite || !datasetState.selectedDataset || augmenting}
                >
                  {augmenting ? "增强中..." : "执行增强并划分 train/val"}
                </button>
              </div>
              <label className="native-field">
                <span>基础模型</span>
                <input
                  list="annotation-base-models"
                  value={trainForm.baseModel}
                  onChange={(event) => setTrainForm((current) => ({ ...current, baseModel: event.target.value }))}
                  placeholder="例如 yolov8n.pt"
                  disabled={!canOperate}
                />
                <datalist id="annotation-base-models">
                  {models.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
              <label className="native-field">
                <span>输出模型名</span>
                <input
                  value={trainForm.modelName}
                  onChange={(event) => setTrainForm((current) => ({ ...current, modelName: event.target.value }))}
                  placeholder="可选"
                  disabled={!canOperate}
                />
              </label>
              <label className="native-field">
                <span>Epochs</span>
                <input type="number" min="1" value={trainForm.epochs} onChange={(event) => setTrainForm((current) => ({ ...current, epochs: event.target.value }))} disabled={!canOperate} />
              </label>
              <label className="native-field">
                <span>Imgsz</span>
                <input type="number" min="32" value={trainForm.imgsz} onChange={(event) => setTrainForm((current) => ({ ...current, imgsz: event.target.value }))} disabled={!canOperate} />
              </label>
            </div>

            <button type="button" className="primary" onClick={handleTrain} disabled={!canOperate || !datasetState.selectedDataset || training}>
              {training ? "训练中..." : "启动训练"}
            </button>

            <div className="recognition-advice">
              <div className="native-workspace__section-head native-workspace__section-head--tight">
                <h3>训练进度</h3>
                <p>训练启动后在这里持续刷新状态，不再占用左侧配置区。</p>
              </div>
              {trainTask ? (
                <div className="train-progress">
                  <div className="train-progress__bar">
                    <span style={{ width: formatPercent(trainTask.progress) }} />
                  </div>
                  <div className="train-progress__meta">
                    <strong>{formatPercent(trainTask.progress)}</strong>
                    <span>{trainTask.message || trainTask.stage || trainTask.status}</span>
                  </div>
                  <ul className="native-list native-list--stacked">
                    <li className="native-list__item native-list__item--stacked">
                      <span>状态：{trainTask.status}</span>
                    </li>
                    <li className="native-list__item native-list__item--stacked">
                      <span>轮次：{trainTask.current_epoch || 0} / {trainTask.total_epochs || "--"}</span>
                    </li>
                    {trainTask.result?.model_name ? (
                      <li className="native-list__item native-list__item--stacked">
                        <span>输出模型：{trainTask.result.model_name}</span>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : (
                <div className="native-empty native-empty--compact">
                  <p>启动训练任务后，这里会显示进度、阶段和结果模型。</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
      {focusOverlay}
    </>
  );
}
