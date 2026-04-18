"""Knowledge-base orchestration for annotation classes and recognition advice."""

from datetime import datetime
from typing import Dict, List, Optional

try:
    from .ai_advice_service import AiAdviceService
    from .knowledge_store import KnowledgeStore
    from .schemas import AiAdviceData, ClassAdviceData
except ImportError:
    from ai_advice_service import AiAdviceService
    from knowledge_store import KnowledgeStore
    from schemas import AiAdviceData, ClassAdviceData


LEGACY_GENERIC_CLASS_ADVICE = [
    "先检查同一植株及周边叶片，确认是否出现类似病斑并及时隔离重病叶片。",
    "保持种植环境通风、降湿，避免叶面长期积水，减少病害继续扩散。",
    "结合当地农技建议或植保方案，尽快选择对应病害的防治措施并持续观察 3 到 5 天。",
]


def _parse_timestamp(value: object) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


class KnowledgeBaseService:
    CLASS_ENTRY_TYPE = "annotation-class"

    def __init__(self, store: KnowledgeStore, ai_service: AiAdviceService) -> None:
        self.store = store
        self.ai_service = ai_service

    def build_cached_detail(self, record: Dict[str, object]) -> Optional[str]:
        parts = ["知识库缓存"]
        entry_type = str(record.get("entry_type") or "").strip()
        if entry_type:
            parts.append(f"条目类型：{entry_type}")
        original_source = str(record.get("source") or "").strip()
        if original_source:
            parts.append(f"原始生成：{original_source}")
        generation_mode = str(record.get("generation_mode") or "").strip()
        if generation_mode:
            parts.append(f"生成方式：{generation_mode}")
        generated_at = _parse_timestamp(record.get("updated_at") or record.get("created_at"))
        if generated_at:
            parts.append(f"更新时间：{generated_at.astimezone().isoformat(timespec='seconds')}")
        original_detail = str(record.get("detail") or "").strip()
        if original_detail:
            parts.append(original_detail)
        return "；".join(part for part in parts if part) or None

    def to_class_advice_data(self, record: Dict[str, object]) -> ClassAdviceData:
        generated_at = _parse_timestamp(record.get("updated_at") or record.get("created_at"))
        return ClassAdviceData(
            class_name=str(record.get("class_name") or record.get("entry_key") or ""),
            summary=str(record.get("summary") or ""),
            advice=[str(item).strip() for item in record.get("advice", []) if str(item).strip()],
            source="knowledge-base",
            detail=self.build_cached_detail(record),
            generated_at=generated_at.astimezone().isoformat(timespec="seconds") if generated_at else None,
        )

    def to_ai_advice_data(self, payload: Dict[str, object], disease_label: str) -> AiAdviceData:
        return AiAdviceData(
            disease_label=str(payload.get("disease_label") or disease_label or "No detection"),
            summary=str(payload.get("summary") or ""),
            advice=[str(item).strip() for item in payload.get("advice", []) if str(item).strip()],
            source=str(payload.get("source") or "builtin"),
            detail=str(payload.get("detail") or "").strip() or None,
        )

    def build_cached_ai_advice(self, record: Dict[str, object], disease_label: str) -> AiAdviceData:
        return AiAdviceData(
            disease_label=str(disease_label or record.get("class_name") or record.get("entry_key") or "No detection"),
            summary=str(record.get("summary") or ""),
            advice=[str(item).strip() for item in record.get("advice", []) if str(item).strip()],
            source="knowledge-base",
            detail=self.build_cached_detail(record),
        )

    def build_generated_class_advice_data(self, payload: Dict[str, object], class_name: str) -> ClassAdviceData:
        return ClassAdviceData(
            class_name=str(class_name or payload.get("class_name") or ""),
            summary=str(payload.get("summary") or ""),
            advice=[str(item).strip() for item in payload.get("advice", []) if str(item).strip()],
            source=str(payload.get("source") or "builtin"),
            detail=str(payload.get("detail") or "").strip() or None,
            generated_at=None,
        )

    def is_legacy_generic_class_advice(self, record: Optional[Dict[str, object]]) -> bool:
        if not record:
            return False
        summary = str(record.get("summary") or "").strip()
        advice = [str(item).strip() for item in record.get("advice", []) if str(item).strip()]
        if summary.startswith("系统根据当前识别结果判断为 "):
            return True
        return advice == LEGACY_GENERIC_CLASS_ADVICE

    def lookup_annotation_class_entry(
        self,
        disease_label: str,
        dataset_name: Optional[str] = None,
    ) -> Optional[Dict[str, object]]:
        safe_label = str(disease_label or "").strip()
        if not safe_label or safe_label == "No detection":
            return None
        if dataset_name:
            return self.store.get_entry(dataset_name, self.CLASS_ENTRY_TYPE, safe_label)
        return self.store.get_latest_entry(self.CLASS_ENTRY_TYPE, safe_label)

    def ensure_annotation_class_advice(
        self,
        dataset_name: str,
        class_name: str,
        current_user: Dict[str, object],
    ) -> ClassAdviceData:
        cached = self.store.get_entry(dataset_name, self.CLASS_ENTRY_TYPE, class_name)
        if cached and not self.is_legacy_generic_class_advice(cached):
            return self.to_class_advice_data(cached)

        generated_payload = self.ai_service.generate_class_knowledge(class_name)
        self.store.upsert_entry(
            dataset_name=dataset_name,
            entry_type=self.CLASS_ENTRY_TYPE,
            entry_key=class_name,
            title=class_name,
            summary=str(generated_payload.get("summary") or ""),
            advice=[str(item).strip() for item in generated_payload.get("advice", []) if str(item).strip()],
            source=str(generated_payload.get("source") or "builtin"),
            detail=str(generated_payload.get("detail") or "").strip() or None,
            generated_by_user_id=int(current_user["id"]),
        )
        stored = self.store.get_entry(dataset_name, self.CLASS_ENTRY_TYPE, class_name)
        if not stored:
            raise RuntimeError(f"类别建议缓存失败：{class_name}")
        return self.to_class_advice_data(stored)

    def build_dataset_class_advices(
        self,
        dataset_name: str,
        class_names: List[str],
        current_user: Optional[Dict[str, object]] = None,
    ) -> List[ClassAdviceData]:
        advice_items: List[ClassAdviceData] = []
        seen: set[str] = set()
        for raw_class_name in class_names:
            class_name = str(raw_class_name or "").strip()
            if not class_name or class_name in seen:
                continue
            seen.add(class_name)

            cached = self.store.get_entry(dataset_name, self.CLASS_ENTRY_TYPE, class_name)
            if cached and not self.is_legacy_generic_class_advice(cached):
                advice_items.append(self.to_class_advice_data(cached))
        return advice_items

    def generate_ai_advice(
        self,
        disease_label: str,
        confidence: float = 0.0,
        top_predictions: Optional[List[Dict[str, object]]] = None,
        image_bytes: Optional[bytes] = None,
        image_content_type: Optional[str] = None,
        dataset_name: Optional[str] = None,
    ) -> AiAdviceData:
        cached = self.lookup_annotation_class_entry(disease_label, dataset_name=dataset_name)
        if cached and not self.is_legacy_generic_class_advice(cached):
            return self.build_cached_ai_advice(cached, disease_label)

        safe_label = str(disease_label or "").strip()
        if not safe_label or safe_label == "No detection":
            payload = self.ai_service.generate(
                disease_label=disease_label,
                confidence=confidence,
                top_predictions=top_predictions or [],
                image_bytes=image_bytes,
                image_content_type=image_content_type,
            )
            return self.to_ai_advice_data(payload, disease_label)

        payload = self.ai_service.generate_class_knowledge(safe_label)
        summary = str(payload.get("summary") or "").strip()
        advice = [str(item).strip() for item in payload.get("advice", []) if str(item).strip()]
        if dataset_name and summary and advice:
            self.store.upsert_entry(
                dataset_name=dataset_name,
                entry_type=self.CLASS_ENTRY_TYPE,
                entry_key=safe_label,
                title=safe_label,
                summary=summary,
                advice=advice,
                source=str(payload.get("source") or "builtin"),
                detail=str(payload.get("detail") or "").strip() or None,
                metadata={
                    "captured_from": "predict",
                    "confidence": float(confidence or 0.0),
                    "top_predictions": list(top_predictions or [])[:5],
                },
            )
        return self.to_ai_advice_data(payload, disease_label)

    def delete_annotation_class_advice(self, dataset_name: str, class_name: str) -> None:
        self.store.delete_entry(dataset_name, self.CLASS_ENTRY_TYPE, class_name)

    def delete_dataset_entries(self, dataset_name: str) -> None:
        self.store.delete_dataset_entries(dataset_name)

    def rebuild_dataset_class_entries(
        self,
        dataset_name: str,
        class_names: List[str],
        current_user: Optional[Dict[str, object]] = None,
    ) -> int:
        updated = 0
        generated_by_user_id = int(current_user["id"]) if current_user and current_user.get("id") is not None else None
        for raw_class_name in class_names:
            class_name = str(raw_class_name or "").strip()
            if not class_name:
                continue
            payload = self.ai_service.generate_class_knowledge(class_name)
            self.store.upsert_entry(
                dataset_name=dataset_name,
                entry_type=self.CLASS_ENTRY_TYPE,
                entry_key=class_name,
                title=class_name,
                summary=str(payload.get("summary") or ""),
                advice=[str(item).strip() for item in payload.get("advice", []) if str(item).strip()],
                source=str(payload.get("source") or "builtin"),
                detail=str(payload.get("detail") or "").strip() or None,
                generated_by_user_id=generated_by_user_id,
            )
            updated += 1
        return updated
