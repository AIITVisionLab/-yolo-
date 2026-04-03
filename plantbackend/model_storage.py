"""Helpers for storing model assets in per-user public/private directories."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple


def safe_storage_segment(value: Optional[str], fallback: str = "system") -> str:
    raw = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value or "").strip())
    normalized = raw.strip("._")
    return normalized or fallback


def build_user_model_dir(models_root: Path, owner_username: Optional[str], is_public: bool) -> Path:
    owner_segment = safe_storage_segment(owner_username, "system")
    visibility_segment = "public" if is_public else "private"
    return models_root / "users" / owner_segment / visibility_segment


def iter_model_file_paths(models_root: Path) -> Iterable[Path]:
    if not models_root.exists():
        return []
    return sorted(
        path
        for path in models_root.rglob("*.onnx")
        if path.is_file() and path.stat().st_size > 0
    )


def build_model_name_index(models_root: Path) -> Dict[str, Path]:
    index: Dict[str, Path] = {}
    for path in iter_model_file_paths(models_root):
        index.setdefault(path.name, path)
    return index


def resolve_model_file_path(models_root: Path, model_name: str) -> Optional[Path]:
    normalized_name = Path(model_name or "").name
    if not normalized_name:
        return None

    direct_path = models_root / normalized_name
    if direct_path.exists() and direct_path.is_file():
        return direct_path

    return build_model_name_index(models_root).get(normalized_name)


def resolve_model_asset_paths(models_root: Path, model_name: str) -> Tuple[Optional[Path], Optional[Path], Optional[Path]]:
    model_path = resolve_model_file_path(models_root, model_name)
    if model_path is None:
        return None, None, None
    return (
        model_path,
        model_path.with_suffix(".labels.json"),
        model_path.with_suffix(".meta.json"),
    )


def resolve_unique_model_targets(
    models_root: Path,
    desired_stem: str,
    owner_username: Optional[str],
    is_public: bool,
) -> Tuple[str, Path, Path, Path]:
    target_dir = build_user_model_dir(models_root, owner_username, is_public)
    target_dir.mkdir(parents=True, exist_ok=True)

    existing_names = set(build_model_name_index(models_root))
    stem = desired_stem
    counter = 1
    while f"{stem}.onnx" in existing_names:
        stem = f"{desired_stem}{counter}"
        counter += 1

    onnx_path = target_dir / f"{stem}.onnx"
    return (
        onnx_path.name,
        onnx_path,
        target_dir / f"{stem}.labels.json",
        target_dir / f"{stem}.meta.json",
    )


def infer_visibility_from_path(models_root: Path, model_path: Path) -> Tuple[Optional[str], Optional[bool]]:
    try:
        relative_parts = model_path.resolve().relative_to(models_root.resolve()).parts
    except ValueError:
        return None, None

    if len(relative_parts) >= 4 and relative_parts[0] == "users":
        owner_username = relative_parts[1]
        visibility_part = relative_parts[2]
        if visibility_part == "public":
            return owner_username, True
        if visibility_part == "private":
            return owner_username, False
    return None, None


def move_model_assets(model_path: Path, destination_model_path: Path) -> None:
    destination_model_path.parent.mkdir(parents=True, exist_ok=True)
    asset_pairs = [
        (model_path, destination_model_path),
        (model_path.with_suffix(".labels.json"), destination_model_path.with_suffix(".labels.json")),
        (model_path.with_suffix(".meta.json"), destination_model_path.with_suffix(".meta.json")),
    ]
    for source_path, target_path in asset_pairs:
        if not source_path.exists():
            continue
        if source_path.resolve() == target_path.resolve():
            continue
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if target_path.exists():
            target_path.unlink()
        shutil.move(str(source_path), str(target_path))


def cleanup_empty_parent_directories(start_dir: Path, models_root: Path) -> None:
    current = start_dir
    resolved_root = models_root.resolve()
    while True:
        if not current.exists() or not current.is_dir():
            current = current.parent
            continue
        try:
            current.resolve().relative_to(resolved_root)
        except ValueError:
            break
        if current.resolve() == resolved_root:
            break
        if any(current.iterdir()):
            break
        current.rmdir()
        current = current.parent
