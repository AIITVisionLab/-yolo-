"""SQLite-backed storage dedicated to the knowledge base."""

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional


def _utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_knowledge_key(value: str) -> str:
    lowered = str(value or "").strip().lower()
    collapsed = re.sub(r"[_\-\s]+", " ", lowered)
    return re.sub(r"\s+", " ", collapsed).strip()


def infer_generation_mode(source: Optional[str]) -> str:
    safe_source = str(source or "").strip().lower()
    if safe_source.startswith("ai"):
        return "ai"
    if safe_source == "builtin":
        return "builtin"
    if safe_source == "knowledge-base":
        return "knowledge-base"
    return safe_source or "builtin"


class KnowledgeStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS knowledge_base_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dataset_name TEXT NOT NULL,
                    entry_type TEXT NOT NULL,
                    entry_key TEXT NOT NULL,
                    normalized_key TEXT NOT NULL,
                    title TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    advice_json TEXT NOT NULL,
                    source TEXT NOT NULL,
                    detail TEXT,
                    generation_mode TEXT NOT NULL DEFAULT 'builtin',
                    metadata_json TEXT,
                    generated_by_user_id INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE (dataset_name, entry_type, entry_key)
                );

                CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_dataset
                ON knowledge_base_entries(dataset_name, entry_type, updated_at DESC);

                CREATE INDEX IF NOT EXISTS idx_knowledge_base_entries_normalized_key
                ON knowledge_base_entries(entry_type, normalized_key, updated_at DESC);
                """
            )

    def reset(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                DROP TABLE IF EXISTS knowledge_base_entries;
                """
            )
        self._initialize()

    def upsert_entry(
        self,
        dataset_name: str,
        entry_type: str,
        entry_key: str,
        summary: str,
        advice: List[str],
        source: str,
        detail: Optional[str] = None,
        generated_by_user_id: Optional[int] = None,
        generation_mode: Optional[str] = None,
        metadata: Optional[Dict[str, object]] = None,
        title: Optional[str] = None,
    ) -> None:
        safe_dataset = str(dataset_name or "").strip()
        safe_entry_type = str(entry_type or "").strip()
        safe_entry_key = str(entry_key or "").strip()
        safe_title = str(title or safe_entry_key).strip() or safe_entry_key
        if not safe_dataset or not safe_entry_type or not safe_entry_key:
            raise RuntimeError("知识库写入失败：dataset_name、entry_type 或 entry_key 为空。")

        safe_summary = str(summary or "").strip()
        safe_source = str(source or "builtin").strip() or "builtin"
        safe_detail = str(detail or "").strip() or None
        safe_advice = [str(item).strip() for item in advice if str(item).strip()]
        if not safe_summary or not safe_advice:
            raise RuntimeError("知识库写入失败：summary 或 advice 为空。")

        timestamp = _utc_timestamp()
        normalized_key = normalize_knowledge_key(safe_entry_key)
        metadata_payload = json.dumps(metadata, ensure_ascii=False) if metadata else None
        safe_generation_mode = str(generation_mode or infer_generation_mode(safe_source)).strip() or "builtin"

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO knowledge_base_entries (
                    dataset_name,
                    entry_type,
                    entry_key,
                    normalized_key,
                    title,
                    summary,
                    advice_json,
                    source,
                    detail,
                    generation_mode,
                    metadata_json,
                    generated_by_user_id,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(dataset_name, entry_type, entry_key) DO UPDATE SET
                    normalized_key = excluded.normalized_key,
                    title = excluded.title,
                    summary = excluded.summary,
                    advice_json = excluded.advice_json,
                    source = excluded.source,
                    detail = excluded.detail,
                    generation_mode = excluded.generation_mode,
                    metadata_json = excluded.metadata_json,
                    generated_by_user_id = excluded.generated_by_user_id,
                    updated_at = excluded.updated_at
                """,
                (
                    safe_dataset,
                    safe_entry_type,
                    safe_entry_key,
                    normalized_key,
                    safe_title,
                    safe_summary,
                    json.dumps(safe_advice, ensure_ascii=False),
                    safe_source,
                    safe_detail,
                    safe_generation_mode,
                    metadata_payload,
                    int(generated_by_user_id) if generated_by_user_id is not None else None,
                    timestamp,
                    timestamp,
                ),
            )

    def _row_to_entry(self, row: sqlite3.Row) -> Dict[str, object]:
        try:
            advice_items = json.loads(str(row["advice_json"] or "[]"))
        except (TypeError, ValueError, json.JSONDecodeError):
            advice_items = []
        try:
            metadata = json.loads(str(row["metadata_json"] or "{}")) if row["metadata_json"] else {}
        except (TypeError, ValueError, json.JSONDecodeError):
            metadata = {}

        cleaned_advice = [str(item).strip() for item in advice_items if str(item).strip()]
        entry_key = str(row["entry_key"])
        return {
            "id": int(row["id"]) if row["id"] is not None else None,
            "dataset_name": str(row["dataset_name"]),
            "entry_type": str(row["entry_type"]),
            "entry_key": entry_key,
            "class_name": entry_key,
            "normalized_key": str(row["normalized_key"] or normalize_knowledge_key(entry_key)),
            "title": str(row["title"] or entry_key),
            "summary": str(row["summary"]),
            "advice": cleaned_advice,
            "source": str(row["source"] or "builtin"),
            "detail": str(row["detail"] or "").strip() or None,
            "generation_mode": str(row["generation_mode"] or infer_generation_mode(row["source"])),
            "metadata": metadata if isinstance(metadata, dict) else {},
            "generated_by_user_id": int(row["generated_by_user_id"]) if row["generated_by_user_id"] is not None else None,
            "created_at": str(row["created_at"] or ""),
            "updated_at": str(row["updated_at"] or ""),
        }

    def get_entry(self, dataset_name: str, entry_type: str, entry_key: str) -> Optional[Dict[str, object]]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    id,
                    dataset_name,
                    entry_type,
                    entry_key,
                    normalized_key,
                    title,
                    summary,
                    advice_json,
                    source,
                    detail,
                    generation_mode,
                    metadata_json,
                    generated_by_user_id,
                    created_at,
                    updated_at
                FROM knowledge_base_entries
                WHERE dataset_name = ? AND entry_type = ? AND entry_key = ?
                """,
                (str(dataset_name), str(entry_type), str(entry_key)),
            ).fetchone()
        return self._row_to_entry(row) if row else None

    def get_latest_entry(self, entry_type: str, entry_key: str) -> Optional[Dict[str, object]]:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT
                    id,
                    dataset_name,
                    entry_type,
                    entry_key,
                    normalized_key,
                    title,
                    summary,
                    advice_json,
                    source,
                    detail,
                    generation_mode,
                    metadata_json,
                    generated_by_user_id,
                    created_at,
                    updated_at
                FROM knowledge_base_entries
                WHERE entry_type = ? AND normalized_key = ?
                ORDER BY updated_at DESC, created_at DESC
                LIMIT 1
                """,
                (str(entry_type), normalize_knowledge_key(entry_key)),
            ).fetchone()
        return self._row_to_entry(row) if row else None

    def list_entries(self, dataset_name: str, entry_type: Optional[str] = None) -> List[Dict[str, object]]:
        with self._connect() as conn:
            if entry_type:
                rows = conn.execute(
                    """
                    SELECT
                        id,
                        dataset_name,
                        entry_type,
                        entry_key,
                        normalized_key,
                        title,
                        summary,
                        advice_json,
                        source,
                        detail,
                        generation_mode,
                        metadata_json,
                        generated_by_user_id,
                        created_at,
                        updated_at
                    FROM knowledge_base_entries
                    WHERE dataset_name = ? AND entry_type = ?
                    ORDER BY entry_key
                    """,
                    (str(dataset_name), str(entry_type)),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT
                        id,
                        dataset_name,
                        entry_type,
                        entry_key,
                        normalized_key,
                        title,
                        summary,
                        advice_json,
                        source,
                        detail,
                        generation_mode,
                        metadata_json,
                        generated_by_user_id,
                        created_at,
                        updated_at
                    FROM knowledge_base_entries
                    WHERE dataset_name = ?
                    ORDER BY entry_type, entry_key
                    """,
                    (str(dataset_name),),
                ).fetchall()
        return [self._row_to_entry(row) for row in rows]

    def delete_entry(self, dataset_name: str, entry_type: str, entry_key: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM knowledge_base_entries WHERE dataset_name = ? AND entry_type = ? AND entry_key = ?",
                (str(dataset_name), str(entry_type), str(entry_key)),
            )

    def delete_dataset_entries(self, dataset_name: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM knowledge_base_entries WHERE dataset_name = ?",
                (str(dataset_name),),
            )
