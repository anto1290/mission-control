#!/bin/bash
# Sync Hermes data from remote server
# Usage: ./sync-hermes-data.sh [remote_host] [remote_path] [local_path]

REMOTE_HOST=${1:-${MC_HERMES_REMOTE_HOST:-}}
REMOTE_PATH=${2:-${MC_HERMES_REMOTE_PATH:-/opt/data}}
LOCAL_PATH=${3:-${MC_HERMES_DATA:-/opt/data-remote}}

if [ -z "$REMOTE_HOST" ]; then
    echo "Usage: $0 <remote_host> [remote_path] [local_path]"
    echo "Or set environment variables:"
    echo "  MC_HERMES_REMOTE_HOST=hermes-server.example.com"
    echo "  MC_HERMES_REMOTE_PATH=/opt/data"
    echo "  MC_HERMES_DATA=/opt/data-remote"
    exit 1
fi

echo "Syncing Hermes data from ${REMOTE_HOST}:${REMOTE_PATH} to ${LOCAL_PATH}"
echo ""

# Create local directory if not exists
mkdir -p "$LOCAL_PATH"

# Sync using rsync over SSH
rsync -avz --delete \
    -e ssh \
    "${REMOTE_HOST}:${REMOTE_PATH}/" \
    "${LOCAL_PATH}/"

echo ""
echo "Sync complete!"