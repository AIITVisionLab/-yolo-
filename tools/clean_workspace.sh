#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

rm -rf \
  .backend-venv \
  .codex-artifacts \
  .logs \
  .playwright-cli \
  .tmp \
  .uv-cache \
  .uv-python \
  .venv \
  .venv-linux \
  frontend/dist \
  frontend/node_modules \
  frontend/test-results \
  plantbackend/.venv \
  plantbackend/.venv-linux \
  plantbackend/.venv-train \
  plantbackend/.venv_linux \
  plantbackend/__pycache__ \
  plantbackend/.vscode \
  tmp_video_frames \
  tmp_video_frames_9 \
  video_frames

rm -f \
  plantbackend/auth.db \
  tmp_remote_8000.html \
  yolo_split_augmented.zip \
  yolo_split_augmented_with_classes.zip

find . -type d -name "__pycache__" -prune -exec rm -rf {} +
find . -type f \( -name "*.pyc" -o -name "*.pyo" \) -delete
