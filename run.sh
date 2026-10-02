#!/bin/bash
# Run Mission Control with automatic Hermes data sync
#
# Usage:
#   # Local (default)
#   ./run.sh
#
#   # Remote Hermes server
#   HERMES_REMOTE_HOST=hermes.example.com ./run.sh
#
#   # With custom data path
#   MC_HERMES_DATA=/mnt/hermes-data ./run.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load config
source "$SCRIPT_DIR/../CONFIG.md" 2>/dev/null || true

# Environment defaults
export MC_PORT=${MC_PORT:-9120}
export MC_HOST=${MC_HOST:-0.0.0.0}
export MC_HERMES_DATA=${MC_HERMES_DATA:-/opt/data}

echo "=========================================="
echo "Mission Control"
echo "=========================================="
echo "Data Source: $MC_HERMES_DATA"
echo "Listen: $MC_HOST:$MC_PORT"
echo ""

# Check if remote sync needed
if [ -n "$HERMES_REMOTE_HOST" ]; then
    echo "Remote sync enabled: $HERMES_REMOTE_HOST"
    bash "$SCRIPT_DIR/scripts/sync-hermes-git.sh" "$HERMES_REMOTE_HOST"
fi

# Validate data exists
REQUIRED_FILES=(
    "kanban.db"
    "profiles/leadenginer/state.db"
    "gateway_state.json"
)

MISSING=0
for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$MC_HERMES_DATA/$f" ]; then
        echo "WARNING: Missing $f"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo ""
    echo "Some data files are missing. Mission Control will run in read-only mode."
    echo "Set MC_HERMES_DATA to point to a directory with Hermes data."
fi

echo ""
echo "Starting Mission Control..."
echo ""

exec node "$SCRIPT_DIR/../server/server.js"