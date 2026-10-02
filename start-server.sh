#!/bin/bash
# Mission Control v2 — Server Startup
# Starts the TypeScript API server from Ruang

set -e

MC_DIR="/opt/data/mission-control"
PORT=${RUANG_PORT:-3001}
HERMES_CLI="/opt/hermes/.venv/bin/hermes"

echo "======================================"
echo "  Mission Control Server"
echo "======================================"
echo ""
echo "  Port:  $PORT"
echo "  API:   http://localhost:$PORT/api/"
echo ""

# Check Hermes CLI
if [ ! -x "$HERMES_CLI" ]; then
    echo "[ERROR] Hermes CLI not found at $HERMES_CLI"
    exit 1
fi

# Start server with Hermes in PATH
echo "[START] Starting server..."
cd "$MC_DIR"
export PATH="/opt/hermes/.venv/bin:$PATH"
export HERMES_CLI="$HERMES_CLI"
export HERMES_DATA="/opt/data"

npx tsx server/index.ts &
SERVER_PID=$!
echo "[INFO] Server started (PID: $SERVER_PID)"

echo ""
echo "======================================"
echo "  Mission Control Server is ready!"
echo "======================================"
echo ""

# Wait for server
wait $SERVER_PID
