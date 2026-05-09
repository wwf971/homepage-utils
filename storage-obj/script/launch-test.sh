#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
DIR_BASE="$ROOT_DIR"
TEST_CONDA_ENV=""
BACKEND_PORT=""
DB_HOST=""
DB_PORT=""
DB_NAME=""
DB_USER=""
DB_PASSWORD=""
DATABASE_LIST_JSON=""
DATABASE_INDEX=""

if [[ -f "$ROOT_DIR/config/config.js" ]]; then
  TEST_CONDA_ENV="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(config.TEST_CONDA_ENV ?? '')" 2>/dev/null || true
  )"
  BACKEND_PORT="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(String(config.BACKEND_PORT ?? ''))" 2>/dev/null || true
  )"
  DB_HOST="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(config.DB_HOST ?? '')" 2>/dev/null || true
  )"
  DB_PORT="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(String(config.DB_PORT ?? ''))" 2>/dev/null || true
  )"
  DB_NAME="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(config.DB_NAME ?? '')" 2>/dev/null || true
  )"
  DB_USER="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(config.DB_USER ?? '')" 2>/dev/null || true
  )"
  DB_PASSWORD="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(config.DB_PASSWORD ?? '')" 2>/dev/null || true
  )"
  DATABASE_LIST_JSON="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(JSON.stringify(config.DATABASE_LIST ?? []))" 2>/dev/null || true
  )"
  DATABASE_INDEX="$(
    cd "$ROOT_DIR" && node --input-type=module -e "import config from './config/config.js'; process.stdout.write(String(config.DATABASE_INDEX ?? '0'))" 2>/dev/null || true
  )"
fi

is_dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  is_dry_run=true
fi

if [[ -z "$BACKEND_PORT" ]]; then
  BACKEND_PORT="5107"
fi

free_port_if_needed() {
  local port="$1"
  local isDryRun="$2"
  if [[ -z "$port" ]]; then
    return 0
  fi

  local is_port_bindable
  is_port_bindable() {
    local test_port="$1"
    python3 - <<'PY' "$test_port"
import socket
import sys

port = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(("0.0.0.0", port))
except OSError:
    sys.exit(1)
finally:
    s.close()
sys.exit(0)
PY
  }

  local try_index=0
  local max_try=8
  while (( try_index < max_try )); do
    if is_port_bindable "$port"; then
      return 0
    fi

    local pidsText
    pidsText="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -z "$pidsText" ]]; then
      pidsText="$(lsof -tiTCP:"$port" 2>/dev/null || true)"
    fi
    if [[ -n "$pidsText" ]]; then
      echo "Port $port is occupied. Existing pid(s):"
      echo "$pidsText"
      if [[ "$isDryRun" == true ]]; then
        echo "Dry run: would kill pid(s) on port $port"
        return 0
      fi
      while IFS= read -r pid; do
        [[ -z "$pid" ]] && continue
        if (( try_index < max_try - 2 )); then
          kill "$pid" >/dev/null 2>&1 || true
        else
          kill -9 "$pid" >/dev/null 2>&1 || true
        fi
      done <<< "$pidsText"
    fi

    sleep 0.25
    try_index=$((try_index + 1))
  done

  if is_port_bindable "$port"; then
    return 0
  fi
  echo "Failed to free port $port after retries."
  return 1
}

backend_cmd=""

if [[ -f "$BACKEND_DIR/app.py" ]]; then
  backend_cmd="DIR_BASE=\"$DIR_BASE\""
  [[ -n "$TEST_CONDA_ENV" ]] && backend_cmd="$backend_cmd TEST_CONDA_ENV=\"$TEST_CONDA_ENV\""
  [[ -n "$BACKEND_PORT" ]] && backend_cmd="$backend_cmd PORT=\"$BACKEND_PORT\""
  [[ -n "$DB_HOST" ]] && backend_cmd="$backend_cmd DB_HOST=\"$DB_HOST\""
  [[ -n "$DB_PORT" ]] && backend_cmd="$backend_cmd DB_PORT=\"$DB_PORT\""
  [[ -n "$DB_NAME" ]] && backend_cmd="$backend_cmd DB_NAME=\"$DB_NAME\""
  [[ -n "$DB_USER" ]] && backend_cmd="$backend_cmd DB_USER=\"$DB_USER\""
  [[ -n "$DB_PASSWORD" ]] && backend_cmd="$backend_cmd DB_PASSWORD=\"$DB_PASSWORD\""
  [[ -n "$DATABASE_LIST_JSON" ]] && backend_cmd="$backend_cmd DATABASE_LIST_JSON='$DATABASE_LIST_JSON'"
  [[ -n "$DATABASE_INDEX" ]] && backend_cmd="$backend_cmd DATABASE_INDEX=\"$DATABASE_INDEX\""

  if [[ -n "$TEST_CONDA_ENV" ]]; then
    # Important:
    # Do NOT use "conda activate <env> && python3 ..." here.
    # In this non-interactive launcher shell, python3 may still resolve to system python
    # (for example /usr/bin/python3), which makes backend ignore the target conda env.
    # Use conda run to force interpreter and site-packages from TEST_CONDA_ENV.
    backend_cmd="$backend_cmd conda run -n \"$TEST_CONDA_ENV\" python \"$BACKEND_DIR/app.py\""
  else
    backend_cmd="$backend_cmd python3 \"$BACKEND_DIR/app.py\""
  fi
fi

if [[ -z "$backend_cmd" ]]; then
  echo "No backend runnable target found yet."
  echo "Expected:"
  echo "  - $BACKEND_DIR/app.py"
  if [[ "$is_dry_run" == true ]]; then
    echo "Dry run only. Nothing started."
    exit 0
  fi
  exit 1
fi

echo "launch-test root: $ROOT_DIR"
echo "DIR_BASE     : $DIR_BASE"
[[ -n "$TEST_CONDA_ENV" ]] && echo "TEST_CONDA_ENV: $TEST_CONDA_ENV"
[[ -n "$backend_cmd" ]] && echo "backend cmd : $backend_cmd"

if [[ "$is_dry_run" == true ]]; then
  echo "Dry run: would run frontend build: pnpm --dir \"$FRONTEND_DIR\" run build"
  free_port_if_needed "$BACKEND_PORT" true
  echo "Dry run only. Nothing started."
  exit 0
fi

pids=()

cleanup() {
  local exit_code=$?
  if [[ ${#pids[@]} -gt 0 ]]; then
    echo "Stopping child processes..."
    for pid in "${pids[@]}"; do
      kill "$pid" >/dev/null 2>&1 || true
    done
    wait >/dev/null 2>&1 || true
  fi
  exit "$exit_code"
}

trap cleanup INT TERM EXIT

echo "frontend build cmd: pnpm --dir \"$FRONTEND_DIR\" run build"
pnpm --dir "$FRONTEND_DIR" run build

free_port_if_needed "$BACKEND_PORT" false

if [[ -n "$backend_cmd" ]]; then
  bash -lc "$backend_cmd" &
  pids+=("$!")
fi

wait
