#!/bin/bash
# Mission Control v2 — Next.js + Tailwind CSS
# Starts both the Next.js frontend (port 3000) and legacy API server (port 9120)

set -e

MC_DIR="/opt/data/mission-control"
NEXT_PORT=${MC_NEXT_PORT:-3000}
API_PORT=${MC_API_PORT:-9120}

echo "======================================"
echo "  Mission Control v2"
echo "======================================"
echo ""
echo "  Frontend: http://localhost:$NEXT_PORT"
echo "  API:      http://localhost:$API_PORT/api/"
echo ""

# Check if Next.js is already running
if lsof -ti :$NEXT_PORT > /dev/null 2>&1; then
    echo "[INFO] Next.js already running on port $NEXT_PORT"
else
    echo "[START] Starting Next.js..."
    cd "$MC_DIR" && npm run dev &
    NEXT_PID=$!
    echo "[INFO] Next.js started (PID: $NEXT_PID)"
fi

# Check if API server is already running
if lsof -ti :$API_PORT > /dev/null 2>&1; then
    echo "[INFO] API server already running on port $API_PORT"
else
    echo "[START] Starting API server..."
    cd "$MC_DIR" && node server/server.js &
    API_PID=$!
    echo "[INFO] API server started (PID: $API_PID)"
fi

echo ""
echo "======================================"
echo "  Mission Control is ready!"
echo "======================================"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Wait for signals
wait