#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.override.yml"
BRANCH="${DEPLOY_BRANCH:-main}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()  { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

compose_args=("-f" "$COMPOSE_FILE")
if [[ -f "$OVERRIDE_FILE" ]]; then
  compose_args+=("-f" "$OVERRIDE_FILE")
fi

wait_for_http() {
  local name="$1"
  local url="$2"

  for _ in {1..20}; do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "$name OK"
      return 0
    fi
    sleep 3
  done

  warn "$name did not respond at $url"
  return 1
}

# Pre-flight checks
command -v docker >/dev/null 2>&1 || die "docker is not installed"
command -v curl >/dev/null 2>&1 || die "curl is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"
[[ -f "$COMPOSE_FILE" ]] || die "docker-compose.yml not found at $COMPOSE_FILE"

if [[ ! -f "$OVERRIDE_FILE" ]]; then
  warn "No docker-compose.override.yml found."
  warn "Production secrets are not configured outside docker-compose.yml."
  warn "Create one before deploying a real production instance."
  read -r -p "Continue anyway? [y/N] " confirm
  [[ "${confirm,,}" == "y" ]] || exit 1
fi

# Pull latest code when this folder is a git repository.
cd "$SCRIPT_DIR"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "Pulling latest code from origin/$BRANCH..."
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  COMMIT="$(git rev-parse --short HEAD)"
else
  warn "This directory is not a git repository; skipping git pull."
  COMMIT="local"
fi

log "Deploying commit $COMMIT"

# Build and start services.
log "Building images..."
docker compose "${compose_args[@]}" build --pull

log "Starting database..."
docker compose "${compose_args[@]}" up -d db

log "Starting backend..."
docker compose "${compose_args[@]}" up -d backend

read -r -p "Seed test users now? [y/N] " seed_confirm
if [[ "${seed_confirm,,}" == "y" ]]; then
  log "Seeding test users..."
  docker compose "${compose_args[@]}" exec -T backend npm run db:seed
else
  warn "Skipping seed. Make sure the deployed database has usable test credentials."
fi

log "Starting frontend..."
docker compose "${compose_args[@]}" up -d frontend

# Health checks.
log "Running health checks..."
ALL_HEALTHY=true
wait_for_http "backend" "http://localhost:3002/health" || ALL_HEALTHY=false
wait_for_http "frontend" "http://localhost:8080" || ALL_HEALTHY=false

log "Pruning dangling images..."
docker image prune -f

if $ALL_HEALTHY; then
  log "Deploy complete. Commit $COMMIT is live."
else
  warn "Deploy finished, but one or more health checks failed."
  warn "Inspect logs with: docker compose -f $COMPOSE_FILE logs --tail=50 <service>"
  exit 1
fi
