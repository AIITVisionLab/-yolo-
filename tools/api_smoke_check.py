#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


BASE_URL = os.getenv("PLANT_API_BASE_URL", "http://127.0.0.1:7800").rstrip("/")
ADMIN_USERNAME = os.getenv("PLANT_ADMIN_USERNAME") or os.getenv("BOOTSTRAP_ADMIN_USERNAME", "root")
ADMIN_PASSWORD = os.getenv("PLANT_ADMIN_PASSWORD") or os.getenv("BOOTSTRAP_ADMIN_PASSWORD", "")
USER_USERNAME = os.getenv("PLANT_USER_USERNAME") or os.getenv("BOOTSTRAP_USER_USERNAME", "")
USER_PASSWORD = os.getenv("PLANT_USER_PASSWORD") or os.getenv("BOOTSTRAP_USER_PASSWORD", "")
THIRD_USERNAME = os.getenv("PLANT_THIRD_USERNAME", "")
THIRD_PASSWORD = os.getenv("PLANT_THIRD_PASSWORD", "")


def request_json(path, method="GET", token=None, payload=None, expected_status=200):
    url = f"{BASE_URL}{path}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["X-Auth-Token"] = token

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
            status = response.getcode()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        status = exc.code

    if status != expected_status:
        raise RuntimeError(f"{method} {path} expected {expected_status}, got {status}: {body}")
    return json.loads(body) if body else {}


def login(username, password):
    payload = request_json(
        "/auth/login",
        method="POST",
        payload={"username": username, "password": password},
        expected_status=200,
    )
    token = str(payload.get("data", {}).get("token") or "")
    if not token:
        raise RuntimeError(f"Login token missing for user {username}")
    return token, payload


def register_user(username, password, display_name=None):
    payload = request_json(
        "/auth/register",
        method="POST",
        payload={
            "username": username,
            "password": password,
            "display_name": display_name or username,
        },
        expected_status=200,
    )
    token = str(payload.get("data", {}).get("token") or "")
    if not token:
        raise RuntimeError(f"Register token missing for user {username}")
    return token, payload


def assert_true(condition, message):
    if not condition:
        raise RuntimeError(message)


def find_user(users_payload, username):
    for item in users_payload.get("data", {}).get("users", []):
        if str(item.get("username") or "") == username:
            return item
    return None


def login_admin():
    password_candidates = [ADMIN_PASSWORD] if ADMIN_PASSWORD else ["change_me", "root"]
    last_error = None
    for password in password_candidates:
        try:
            return login(ADMIN_USERNAME, password)
        except Exception as exc:
            last_error = exc
    raise RuntimeError(
        "管理员登录失败。请设置 PLANT_ADMIN_USERNAME / PLANT_ADMIN_PASSWORD，"
        "或确认当前环境仍使用 root/change_me（兼容旧环境时也会尝试 root/root）。"
    ) from last_error


def create_ephemeral_user(prefix):
    username = f"{prefix}_{int(time.time())}_{uuid.uuid4().hex[:4]}"
    password = "temp1234"
    token, _ = register_user(username, password, display_name=username)
    return username, token


def resolve_test_user(explicit_username, explicit_password, prefix):
    if explicit_username or explicit_password:
        if not (explicit_username and explicit_password):
            raise RuntimeError(f"{prefix} 凭据不完整，请同时提供用户名和密码。")
        token, _ = login(explicit_username, explicit_password)
        return explicit_username, token, False

    username, token = create_ephemeral_user(prefix)
    return username, token, True


def delete_user_by_username(admin_token, username):
    users_payload = request_json("/users", token=admin_token)
    user = find_user(users_payload, username)
    if not user:
        return
    request_json(f"/admin/users/{int(user['id'])}", method="DELETE", token=admin_token, expected_status=200)


def main():
    health = request_json("/health")
    assert_true(health.get("success") is True, "健康检查接口未返回 success=true")

    admin_token, _ = login_admin()
    user_username, user_token, cleanup_user = resolve_test_user(USER_USERNAME, USER_PASSWORD, "smoke_user")
    third_username, third_token, cleanup_third = resolve_test_user(THIRD_USERNAME, THIRD_PASSWORD, "smoke_third")

    admin_models = request_json("/models", token=admin_token)
    user_models = request_json("/models", token=user_token)
    admin_model_names = admin_models.get("data", {}).get("available_models", [])
    user_model_names = user_models.get("data", {}).get("available_models", [])
    assert_true(bool(admin_model_names), "管理员至少应该能看到一个模型")
    assert_true(
        all(model_name in admin_model_names for model_name in user_model_names),
        "普通用户可见模型必须是管理员可见模型的子集",
    )

    temp_dataset = f"{user_username}_smoke_private_{int(time.time())}"
    created = False
    try:
        request_json(
            "/annotation/datasets",
            method="POST",
            token=user_token,
            payload={"dataset_name": temp_dataset, "is_public": False},
            expected_status=200,
        )
        created = True

        user_classes = request_json("/annotation/classes", token=user_token)
        datasets = user_classes.get("data", {}).get("available_datasets", [])
        assert_true(temp_dataset in datasets, "拥有者应该能看到自己的私有数据集")

        direct_user = request_json(
            f"/annotation/classes?{urllib.parse.urlencode({'dataset': temp_dataset})}",
            token=user_token,
        )
        assert_true(
            direct_user.get("data", {}).get("selected_dataset") == temp_dataset,
            "拥有者应该可以打开自己的私有数据集",
        )

        request_json(
            f"/annotation/classes?{urllib.parse.urlencode({'dataset': temp_dataset})}",
            token=admin_token,
        )

        request_json(
            f"/annotation/classes?{urllib.parse.urlencode({'dataset': temp_dataset})}",
            token=user_token,
        )

        request_json(
            f"/annotation/classes?{urllib.parse.urlencode({'dataset': temp_dataset})}",
            token=third_token,
            expected_status=404,
        )
    finally:
        if created:
            request_json(
                "/annotation/datasets/delete",
                method="POST",
                token=user_token,
                payload={"dataset_name": temp_dataset},
                expected_status=200,
            )
        if cleanup_third:
            delete_user_by_username(admin_token, third_username)
        if cleanup_user:
            delete_user_by_username(admin_token, user_username)

    print("烟雾检查通过。")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"烟雾检查失败：{exc}", file=sys.stderr)
        sys.exit(1)
