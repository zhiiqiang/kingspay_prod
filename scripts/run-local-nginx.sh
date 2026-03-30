#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/nginx/docker-compose.yml"

API_ROOT_DEFAULT="http://103.235.75.231:3000"
PORT_DEFAULT="8080"

ACTION="${1:-start}"

print_usage() {
  cat <<'USAGE'
Usage: scripts/run-local-nginx.sh [start|stop|restart]

Runs the app on localhost through the existing nginx/docker-compose setup.

Environment variables:
  API_ROOT   Backend base URL to proxy /api requests (default: http://103.235.75.231:3000)
  PORT       Host port for nginx (default: 8080)
  SKIP_BUILD Set to 1 to skip npm run build even when dist is missing
USAGE
}

run_compose() {
  local action="$1"
  local port="${PORT:-$PORT_DEFAULT}"
  local api_root="${API_ROOT:-$API_ROOT_DEFAULT}"

  (
    cd "$ROOT_DIR"
    PORT="$port" API_ROOT="$api_root" docker compose -f "$COMPOSE_FILE" "$action" "$@"
  )
}

case "$ACTION" in
  -h|--help|help)
    print_usage
    exit 0
    ;;
  start)
    if [[ ! -f "$ROOT_DIR/dist/index.html" && "${SKIP_BUILD:-0}" != "1" ]]; then
      echo "dist/ not found. Building once before starting nginx..."
      (cd "$ROOT_DIR" && npm run build)
    fi

    echo "Starting nginx at http://localhost:${PORT:-$PORT_DEFAULT}"
    echo "Proxying /api to: ${API_ROOT:-$API_ROOT_DEFAULT}"
    run_compose up --build
    ;;
  stop)
    run_compose down
    ;;
  restart)
    run_compose down

    if [[ ! -f "$ROOT_DIR/dist/index.html" && "${SKIP_BUILD:-0}" != "1" ]]; then
      echo "dist/ not found. Building once before starting nginx..."
      (cd "$ROOT_DIR" && npm run build)
    fi

    echo "Restarting nginx at http://localhost:${PORT:-$PORT_DEFAULT}"
    echo "Proxying /api to: ${API_ROOT:-$API_ROOT_DEFAULT}"
    run_compose up --build
    ;;
  *)
    echo "Unknown action: $ACTION"
    print_usage
    exit 1
    ;;
esac
