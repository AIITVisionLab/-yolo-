#!/usr/bin/env python3
"""Reset a local Plant user's password.

This is intended for local maintenance when the SQLite auth database already
exists and the configured bootstrap password no longer matches the stored
administrator credentials.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from plantbackend.auth_store import AuthStore
from plantbackend.config import settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset a Plant user's password in the local auth database.")
    parser.add_argument("--username", default="root", help="Username to reset. Defaults to root.")
    parser.add_argument(
        "--password",
        default="",
        help="New password. If omitted, BOOTSTRAP_ADMIN_PASSWORD from the loaded environment is used.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    password = str(args.password or os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")).strip()
    if not password:
        print(
            "未提供新密码。请使用 --password，或先在环境中设置 BOOTSTRAP_ADMIN_PASSWORD。",
            file=sys.stderr,
        )
        return 1

    store = AuthStore(settings.auth_db_path, settings.auth_session_hours)
    try:
        user = store.set_user_password(args.username, password)
    except RuntimeError as exc:
        print(f"重置失败：{exc}", file=sys.stderr)
        return 1

    print(
        f"已重置用户 {user['username']} 的密码，并清理了该账号的现有会话。"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
