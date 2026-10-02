#!/bin/bash
# Run Mission Control with remote Hermes data sync
# Usage: ./run-remote.sh <hermes-host>

HERMES_HOST=$1

if [ -z "$HERMES_HOST" ]; then
    echo "Usage: $0 <hermes-host>"
    echo "Example: $0 hermes-server.example.com"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYNC_SCRIPT="$SCRIPT_DIR/scripts/sync-hermes-data.sh"
REMOTE_DATA="/opt/data-remote"

export MC_HERMES_DATA=$REMOTE_DATA

echo "=========================================="
echo "Mission Control - Remote Hermes Mode"
echo "=========================================="
echo "Remote Hermes: $HERMES_HOST"
echo "Local data dir: $REMOTE_DATA"
echo ""

# Sync data first
bash "$SYNC_SCRIPT" "$HERMES_HOST"

# Start Mission Control
bash "$SCRIPT_DIR/start.sh"