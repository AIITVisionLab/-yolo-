"""ONNX model loading and prediction utilities."""

import io
import json
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import onnxruntime as ort
from PIL import Image

try:
    from .config import settings
    from .model_storage import build_model_name_index, resolve_model_file_path
except ImportError:
    from config import settings
    from model_storage import build_model_name_index, resolve_model_file_path


class ModelService:
    def __init__(self) -> None:
        # Cache inference sessions by filename so model switching does not keep
        # reopening the same ONNX asset during a demo.
        self.sessions: Dict[str, ort.InferenceSession] = {}
        self.model_errors: Dict[str, str] = {}
        self.class_name_cache: Dict[str, List[str]] = {}
        self.input_size_cache: Dict[str, Tuple[int, int]] = {}
        self.session_metadata_cache: Dict[str, Dict[str, Any]] = {}
        self.available_providers = tuple(ort.get_available_providers())
        self.provider_order = self._build_provider_order()
        self._state_lock = threading.RLock()
        self.default_class_names = self._load_class_names(Path(settings.class_names_path))
        self.input_size = (settings.input_width, settings.input_height)
        self.current_model_name: Optional[str] = None
        self.load_error: Optional[str] = None
        self._initialize_default_model()

    @property
    def is_ready(self) -> bool:
        return self.current_model_name is not None and self.current_model_name in self.sessions

    def available_models(self) -> List[str]:
        models_dir = Path(settings.models_dir)
        if not models_dir.exists():
            return []
        return sorted(build_model_name_index(models_dir))

    def set_active_model(self, model_name: str) -> str:
        self.ensure_model_ready(model_name)
        with self._state_lock:
            self.current_model_name = model_name
        return model_name

    def ensure_model_ready(self, model_name: str) -> str:
        session = self._ensure_model_session(model_name)
        if session is None:
            raise RuntimeError(self.model_errors.get(model_name, f"模型尚未就绪：{model_name}"))
        self.load_error = None
        return model_name

    def _initialize_default_model(self) -> None:
        available = self.available_models()
        if not available:
            self.load_error = f"当前没有可用的 ONNX 模型：{settings.models_dir}"
            return

        candidate_order = []
        if settings.default_model_name in available:
            candidate_order.append(settings.default_model_name)
        candidate_order.extend([model_name for model_name in available if model_name not in candidate_order])

        preferred_model_name = candidate_order[0]
        preferred_model_error: Optional[str] = None
        for index, model_name in enumerate(candidate_order):
            try:
                self.set_active_model(model_name)
                return
            except RuntimeError as exc:
                if index == 0:
                    preferred_model_error = str(exc)

        self.current_model_name = preferred_model_name
        self.load_error = preferred_model_error or f"加载 ONNX 模型失败：{preferred_model_name}"

    def _load_class_names(self, class_names_path: Path) -> List[str]:
        # 读取类别名称，让模型输出的索引能映射成病害名称。
        if not class_names_path.exists():
            raise RuntimeError(f"类别名称文件不存在：{class_names_path}")

        with class_names_path.open("r", encoding="utf-8") as file:
            class_names = json.load(file)

        if not isinstance(class_names, list) or not all(
            isinstance(name, str) for name in class_names
        ):
            raise RuntimeError("类别名称文件必须是由字符串组成的 JSON 数组。")

        return class_names

    def _resolve_model_path(self, model_name: str) -> Path:
        models_dir = Path(settings.models_dir)
        resolved = resolve_model_file_path(models_dir, model_name)
        if resolved is not None:
            return resolved
        return models_dir / Path(model_name or "").name

    def _build_provider_order(self) -> List[str]:
        # Prefer hardware-accelerated providers when the runtime exposes them,
        # but always keep CPU as a safe fallback.
        available = list(self.available_providers)
        preferred = [
            "TensorrtExecutionProvider",
            "CUDAExecutionProvider",
            "ROCMExecutionProvider",
            "OpenVINOExecutionProvider",
            "DnnlExecutionProvider",
            "DmlExecutionProvider",
            "CoreMLExecutionProvider",
        ]

        providers: List[str] = []
        for provider in preferred:
            if provider in available and provider not in providers:
                providers.append(provider)

        for provider in available:
            if provider != "CPUExecutionProvider" and provider not in providers:
                providers.append(provider)

        providers.append("CPUExecutionProvider")
        return providers

    def _resolve_model_session_metadata(self, model_name: str, session: ort.InferenceSession) -> Dict[str, Any]:
        with self._state_lock:
            cached = self.session_metadata_cache.get(model_name)
            if cached is not None:
                return cached

        metadata: Dict[str, Any] = {
            "input_name": "",
            "input_size": self.input_size,
        }

        try:
            inputs = session.get_inputs()
            if inputs:
                input_meta = inputs[0]
                metadata["input_name"] = str(getattr(input_meta, "name", "") or "")

                shape = list(getattr(input_meta, "shape", []) or [])
                width = shape[3] if len(shape) >= 4 else None
                height = shape[2] if len(shape) >= 4 else None
                if isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0:
                    metadata["input_size"] = (width, height)
                else:
                    metadata_path = self._resolve_model_path(model_name).with_suffix(".meta.json")
                    if metadata_path.exists():
                        raw_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        imgsz = int(raw_metadata.get("imgsz") or 0)
                        if imgsz > 0:
                            metadata["input_size"] = (imgsz, imgsz)
        except Exception:
            metadata["input_size"] = self.input_size

        with self._state_lock:
            self.session_metadata_cache[model_name] = metadata
        return metadata

    def _resolve_model_class_names(self, model_name: str) -> List[str]:
        with self._state_lock:
            if model_name in self.class_name_cache:
                return self.class_name_cache[model_name]

        model_path = self._resolve_model_path(model_name)
        labels_path = model_path.with_suffix(".labels.json")
        if labels_path.exists():
            try:
                class_names = self._load_class_names(labels_path)
                with self._state_lock:
                    self.class_name_cache[model_name] = class_names
                    return class_names
            except Exception as exc:
                with self._state_lock:
                    self.model_errors[model_name] = f"加载模型标签元数据失败：{model_name}：{exc}"
                    detail = self.model_errors[model_name]
                raise RuntimeError(detail) from exc

        with self._state_lock:
            self.class_name_cache[model_name] = list(self.default_class_names)
            return self.class_name_cache[model_name]

    def _resolve_model_input_size(self, model_name: str, session: ort.InferenceSession) -> Tuple[int, int]:
        with self._state_lock:
            if model_name in self.input_size_cache:
                return self.input_size_cache[model_name]

        session_metadata = self._resolve_model_session_metadata(model_name, session)
        input_size = tuple(session_metadata.get("input_size") or self.input_size)
        with self._state_lock:
            self.input_size_cache[model_name] = input_size
        return input_size

    def _resolve_model_input_name(self, model_name: str, session: ort.InferenceSession) -> str:
        session_metadata = self._resolve_model_session_metadata(model_name, session)
        return str(session_metadata.get("input_name") or "")

    def _ensure_model_session(self, model_name: str) -> Optional[ort.InferenceSession]:
        with self._state_lock:
            if model_name in self.sessions:
                return self.sessions[model_name]

        model_path = self._resolve_model_path(model_name)
        if not model_path.exists() or model_path.stat().st_size == 0:
            with self._state_lock:
                self.model_errors[model_name] = f"ONNX 模型尚未就绪：{model_path}"
            return None

        try:
            session_options = ort.SessionOptions()
            session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            session = None
            last_error: Optional[Exception] = None
            for providers in (self.provider_order, ["CPUExecutionProvider"]):
                try:
                    session = ort.InferenceSession(
                        str(model_path),
                        sess_options=session_options,
                        providers=providers,
                    )
                    break
                except Exception as exc:
                    last_error = exc
                    session = None
            if session is None:
                raise last_error or RuntimeError("加载 ONNX 模型失败。")
            with self._state_lock:
                self.sessions[model_name] = session
                self.model_errors.pop(model_name, None)
            return session
        except Exception as exc:
            with self._state_lock:
                self.model_errors[model_name] = f"加载 ONNX 模型失败：{model_name}：{exc}"
            return None

    def _preprocess(
        self,
        image_bytes: bytes,
        input_size: Tuple[int, int],
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        # Match Ultralytics-style letterbox preprocessing so exported YOLO
        # models keep their expected aspect ratio and box geometry.
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:
            raise ValueError("无效的图片文件。") from exc

        original_size = image.size
        input_w, input_h = input_size
        orig_w, orig_h = original_size
        if orig_w <= 0 or orig_h <= 0:
            raise ValueError("图片尺寸无效。")

        scale = min(input_w / orig_w, input_h / orig_h)
        resized_w = max(1, int(round(orig_w * scale)))
        resized_h = max(1, int(round(orig_h * scale)))
        resized = image.resize((resized_w, resized_h), Image.Resampling.BILINEAR)

        pad_w = input_w - resized_w
        pad_h = input_h - resized_h
        pad_left = int(round(pad_w / 2 - 0.1))
        pad_top = int(round(pad_h / 2 - 0.1))

        canvas = np.full((input_h, input_w, 3), 114, dtype=np.uint8)
        resized_array = np.asarray(resized, dtype=np.uint8)
        canvas[pad_top:pad_top + resized_h, pad_left:pad_left + resized_w] = resized_array

        image_array = canvas.astype(np.float32) / 255.0
        image_array = np.transpose(image_array, (2, 0, 1))
        image_array = np.expand_dims(image_array, axis=0)
        return image_array, {
            "original_size": original_size,
            "input_size": input_size,
            "scale": scale,
            "pad_left": pad_left,
            "pad_top": pad_top,
        }

    def predict(
        self,
        image_bytes: bytes,
        model_name: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        allow_confidence_fallback: bool = True,
    ) -> Dict[str, Any]:
        # Main inference flow: preprocess -> model session -> YOLO postprocess.
        active_model_name = model_name or self.current_model_name
        if not active_model_name:
            detail = self.load_error or "模型会话尚未初始化。"
            raise RuntimeError(detail)

        session = self._ensure_model_session(active_model_name)
        if session is None:
            detail = self.model_errors.get(active_model_name, "模型会话尚未初始化。")
            raise RuntimeError(detail)

        with self._state_lock:
            self.current_model_name = active_model_name
            self.load_error = None

        class_names = self._resolve_model_class_names(active_model_name)
        session_metadata = self._resolve_model_session_metadata(active_model_name, session)
        input_size = tuple(session_metadata.get("input_size") or self.input_size)
        input_tensor, preprocess_meta = self._preprocess(image_bytes, input_size)
        input_name = str(session_metadata.get("input_name") or "")
        raw_output = session.run(None, {input_name: input_tensor})[0]
        squeezed_output = np.squeeze(raw_output, axis=0)

        requested_threshold = settings.confidence_threshold if confidence_threshold is None else max(
            0.0,
            min(1.0, float(confidence_threshold)),
        )

        detections = self._postprocess(
            squeezed_output,
            class_names,
            preprocess_meta,
            confidence_threshold=requested_threshold,
        )
        if allow_confidence_fallback and not detections:
            for fallback_threshold in (0.03, 0.01):
                if requested_threshold <= fallback_threshold:
                    continue
                detections = self._postprocess(
                    squeezed_output,
                    class_names,
                    preprocess_meta,
                    confidence_threshold=fallback_threshold,
                )
                if detections:
                    break
        if not detections:
            return {
                "model_name": active_model_name,
                "predicted_class": "No detection",
                "predicted_index": -1,
                "confidence": 0.0,
                "top_predictions": [],
                "detections": [],
            }

        top_detections = detections[: settings.top_k]
        primary = top_detections[0]

        return {
            "model_name": active_model_name,
            "predicted_class": primary["label"],
            "predicted_index": primary["class_index"],
            "confidence": primary["confidence"],
            "top_predictions": [
                {
                    "label": item["label"],
                    "confidence": item["confidence"],
                    "bbox": item["bbox"],
                }
                for item in top_detections
            ],
            "detections": [
                {
                    "label": item["label"],
                    "confidence": item["confidence"],
                    "bbox": item["bbox"],
                }
                for item in detections
            ],
        }

    def _postprocess(
        self,
        output: np.ndarray,
        class_names: List[str],
        preprocess_meta: Dict[str, Any],
        confidence_threshold: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        # YOLO 检测输出格式是 [channels, anchors]，这里先转成 [anchors, channels]。
        predictions = output.T
        boxes = predictions[:, :4]
        class_scores = predictions[:, 4:]

        if class_scores.shape[1] != len(class_names):
            raise RuntimeError(
                "模型类别数量与当前配置的类别标签不一致。"
            )

        best_class_indices = np.argmax(class_scores, axis=1)
        best_scores = class_scores[np.arange(class_scores.shape[0]), best_class_indices]
        effective_confidence_threshold = settings.confidence_threshold if confidence_threshold is None else max(
            0.0,
            min(1.0, float(confidence_threshold)),
        )
        keep = best_scores >= effective_confidence_threshold

        boxes = boxes[keep]
        best_scores = best_scores[keep]
        best_class_indices = best_class_indices[keep]

        if len(boxes) == 0:
            return []

        scaled_boxes = self._scale_boxes_xywh_to_xyxy(boxes, preprocess_meta)
        keep_indices = self._nms(scaled_boxes, best_scores, settings.iou_threshold)

        detections: List[Dict[str, Any]] = []
        for index in keep_indices:
            class_index = int(best_class_indices[index])
            detections.append(
                {
                    "class_index": class_index,
                    "label": self._resolve_label(class_index, class_names),
                    "confidence": float(best_scores[index]),
                    "bbox": [float(value) for value in scaled_boxes[index]],
                }
            )

        detections.sort(key=lambda item: item["confidence"], reverse=True)
        return detections

    def _scale_boxes_xywh_to_xyxy(
        self,
        boxes: np.ndarray,
        preprocess_meta: Dict[str, Any],
    ) -> np.ndarray:
        # Convert model-space xywh boxes back from letterboxed input space into
        # original image coordinates.
        orig_w, orig_h = preprocess_meta["original_size"]
        input_w, input_h = preprocess_meta["input_size"]
        scale = float(preprocess_meta.get("scale") or 1.0)
        pad_left = float(preprocess_meta.get("pad_left") or 0.0)
        pad_top = float(preprocess_meta.get("pad_top") or 0.0)

        x_center = boxes[:, 0]
        y_center = boxes[:, 1]
        width = boxes[:, 2]
        height = boxes[:, 3]

        x1 = (x_center - width / 2 - pad_left) / scale
        y1 = (y_center - height / 2 - pad_top) / scale
        x2 = (x_center + width / 2 - pad_left) / scale
        y2 = (y_center + height / 2 - pad_top) / scale

        scaled = np.stack([x1, y1, x2, y2], axis=1)
        scaled[:, [0, 2]] = np.clip(scaled[:, [0, 2]], 0, orig_w)
        scaled[:, [1, 3]] = np.clip(scaled[:, [1, 3]], 0, orig_h)
        return scaled

    def _nms(
        self,
        boxes: np.ndarray,
        scores: np.ndarray,
        iou_threshold: float,
    ) -> List[int]:
        # 非极大值抑制：去掉高度重叠的重复检测框。
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]

        areas = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
        order = scores.argsort()[::-1]
        keep: List[int] = []

        while order.size > 0:
            i = int(order[0])
            keep.append(i)
            if order.size == 1:
                break

            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])

            inter_w = np.maximum(0, xx2 - xx1)
            inter_h = np.maximum(0, yy2 - yy1)
            intersection = inter_w * inter_h

            union = areas[i] + areas[order[1:]] - intersection
            iou = np.divide(
                intersection,
                union,
                out=np.zeros_like(intersection),
                where=union > 0,
            )

            remaining = np.where(iou <= iou_threshold)[0]
            order = order[remaining + 1]

        return keep

    def _resolve_label(self, index: int, class_names: List[str]) -> str:
        # 把输出索引转成可读类别名，避免前端只拿到数字。
        if 0 <= index < len(class_names):
            return class_names[index]
        return f"class_{index}"
