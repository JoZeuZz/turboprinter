#!/usr/bin/env bash
# scripts/build-ui.sh — builds the React WebUI into resource/public/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_DIR="$REPO_ROOT/webui-react"

if [[ ! -d "$UI_DIR/node_modules" ]]; then
  echo "[build-ui] Installing npm dependencies…"
  npm --prefix "$UI_DIR" install
fi

echo "[build-ui] Building React app…"
npm --prefix "$UI_DIR" run build

echo "[build-ui] Done — output in resource/public/"
