import re
from pathlib import Path
from typing import List, Optional

try:
    from .config import settings
except ImportError:
    from config import settings


def _safe_script_stem(name: Optional[str], fallback: str = "augmentation_algorithm") -> str:
    raw = re.sub(r"[^A-Za-z0-9._-]+", "_", str(name or "").strip())
    raw = re.sub(r"\.py$", "", raw, flags=re.IGNORECASE)
    raw = raw.strip("._")
    if raw:
        return raw
    fallback_stem = re.sub(r"[^A-Za-z0-9._-]+", "_", fallback).strip("._")
    return fallback_stem or "augmentation_algorithm"


def ensure_augmentation_algorithms_dir() -> Path:
    algorithms_dir = Path(settings.augmentation_algorithms_dir)
    algorithms_dir.mkdir(parents=True, exist_ok=True)
    return algorithms_dir


def get_builtin_augmentation_script_path() -> Path:
    return Path(settings.augment_script_path)


def read_active_augmentation_override() -> Optional[str]:
    record_path = Path(settings.active_augmentation_script_record)
    if not record_path.exists():
        return None
    try:
        script_name = record_path.read_text(encoding="utf-8").strip()
    except OSError:
        return None
    return Path(script_name).name if script_name else None


def write_active_augmentation_override(script_name: str) -> None:
    record_path = Path(settings.active_augmentation_script_record)
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path.write_text(Path(script_name).name, encoding="utf-8")


def clear_active_augmentation_override() -> None:
    record_path = Path(settings.active_augmentation_script_record)
    try:
        record_path.unlink(missing_ok=True)
    except TypeError:
        if record_path.exists():
            record_path.unlink()


def resolve_unique_augmentation_script_target(algorithms_dir: Path, desired_stem: str) -> Path:
    stem = _safe_script_stem(desired_stem)
    target = algorithms_dir / f"{stem}.py"
    counter = 1
    while target.exists():
        target = algorithms_dir / f"{stem}_{counter}.py"
        counter += 1
    return target


def list_managed_augmentation_paths() -> List[Path]:
    algorithms_dir = ensure_augmentation_algorithms_dir()
    return sorted(
        [path for path in algorithms_dir.glob("*.py") if path.is_file() and path.stat().st_size > 0],
        key=lambda item: item.name.lower(),
    )


def get_active_augmentation_script_path() -> Path:
    override_name = read_active_augmentation_override()
    if override_name:
        managed_path = ensure_augmentation_algorithms_dir() / Path(override_name).name
        if managed_path.exists():
            return managed_path
        clear_active_augmentation_override()

    return get_builtin_augmentation_script_path()
