#!/bin/bash
# Mission Control startup script with environment validation
set -e

# Load defaults (can be overridden by environment)
export MC_PORT=${MC_PORT:-9120}
export MC_HOST=${MC_HOST:-0.0.0.0}
export MC_HERMES_DATA=${MC_HERMES_DATA:-/opt/data}
export MC_HERMES_CLI=${MC_HERMES_CLI:-/opt/hermes/.venv/bin/hermes}
export MC_S6_SVSTAT=${MC_S6_SVSTAT:-/command/s6-svstat}
export MC_S6_SVC=${MC_S6_SVC:-/command/s6-svc}
export MC_S6_SERVICE_DIR=${MC_S6_SERVICE_DIR:-/run/service}
export MC_OPENCODE_BIN=${MC_OPENCODE_BIN:-/opt/data/.local/npm-global/bin/opencode}
export MC_OPENCODE_CONFIG=${MC_OPENCODE_CONFIG:-/opt/data/home/.config/opencode/opencode.json}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "Mission Control Startup"
echo "=========================================="
echo "PORT: $MC_PORT"
echo "HOST: $MC_HOST"
echo "HERMES_DATA: $MC_HERMES_DATA"
echo "HERMES_CLI: $MC_HERMES_CLI $(test -f "$MC_HERMES_CLI" && echo '(found)' || echo '(NOT FOUND)')"
echo "S6_SVSTAT: $MC_S6_SVSTAT $(test -f "$MC_S6_SVSTAT" && echo '(found)' || echo '(NOT FOUND)')"
echo "OPENCODE: $MC_OPENCODE_BIN $(test -f "$MC_OPENCODE_BIN" && echo '(found)' || echo '(NOT FOUND)')"
echo "=========================================="
echo ""

# Validate required files exist
ERRORS=0

if [ ! -d "$MC_HERMES_DATA" ]; then
    echo "ERROR: Hermes data directory not found: $MC_HERMES_DATA"
    ERRORS=$((ERRORS + 1))
fi

if [ ! -f "$MC_HERMES_CLI" ]; then
    echo "WARNING: Hermes CLI not found: $MC_HERMES_CLI"
    echo "         Kanban writes will not work (read-only mode)"
fi

if [ ! -f "$MC_S6_SVSTAT" ]; then
    echo "WARNING: s6-svstat not found: $MC_S6_SVSTAT"
    echo "         Service supervision will show 's6-unavailable'"
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "FATAL: $ERRORS error(s) found. Check configuration."
    exit 1
fi

echo ""
echo "Starting Mission Control..."
echo ""

# Start the server
exec node "$SCRIPT_DIR/server/server.js"