# Mission Control — Environment Configuration

## Required Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MC_PORT` | `9120` | Port to listen on |
| `MC_HOST` | `0.0.0.0` | Host to bind to |
| `MC_HERMES_DATA` | `/opt/data` | Hermes data directory (contains kanban.db, state.db, gateway_state.json) |
| `MC_HERMES_CLI` | `/opt/hermes/.venv/bin/hermes` | Path to Hermes CLI binary |
| `MC_S6_SVSTAT` | `/command/s6-svstat` | Path to s6-svstat binary |
| `MC_S6_SVC` | `/command/s6-svc` | Path to s6-svc binary |
| `MC_S6_SERVICE_DIR` | `/run/service` | Directory containing s6 services |
| `MC_OPENCODE_BIN` | `/opt/data/.local/npm-global/bin/opencode` | Path to OpenCode binary |
| `MC_OPENCODE_CONFIG` | `/opt/data/home/.config/opencode/opencode.json` | OpenCode config file path |

## Deployment Scenarios

### Local Deployment (Same Server)
```bash
# Use defaults — no environment variables needed
cd /opt/data/mission-control
node server/server.js
```

### Remote Deployment (Different Server)
```bash
# Option 1: Mount Hermes data directory
export MC_HERMES_DATA=/mnt/hermes/data
export MC_HERMES_CLI=/usr/local/bin/hermes
node server/server.js

# Option 2: Copy data to local server
# Copy these files from Hermes server:
#   - kanban.db
#   - */state.db
#   - */gateway_state.json
#   - */cron/jobs.json
#   - */skills/
```

### Docker Deployment
```bash
docker run -d \
  -p 9120:9120 \
  -v /path/to/hermes/data:/data \
  -v /path/to/hermes/cli:/hermes \
  -v /run/service:/run/service:ro \
  -e MC_HERMES_DATA=/data \
  -e MC_HERMES_CLI=/hermes/.venv/bin/hermes \
  -e MC_S6_SVSTAT=/command/s6-svstat \
  mission-control
```

## Example: Multiple Hermes Servers

If you have multiple Hermes instances and want to monitor them all:

```bash
# Primary server (default)
export MC_HERMES_DATA=/opt/data

# Or use a central data directory synced from multiple servers
export MC_HERMES_DATA=/shared/hermes-data
```

Note: Current implementation monitors fixed profiles (default, leadenginer).
To add more profiles, edit `CONFIG.profiles` in server.js.

## Data Requirements

Mission Control needs access to:

1. **Hermes Data Directory** (`MC_HERMES_DATA`)
   - `kanban.db` — task board
   - `{profile}/state.db` — session data
   - `{profile}/gateway_state.json` — platform connections
   - `{profile}/cron/jobs.json` — scheduled jobs
   - `{profile}/skills/` — skills catalog
   - `{profile}/MEMORY.md` — memory files

2. **Hermes CLI** (`MC_HERMES_CLI`)
   - Required for kanban write operations (create, complete, assign, etc.)
   - Optional for read-only monitoring

3. **s6 Supervision** (`MC_S6_SVSTAT`, `MC_S6_SVC`)
   - Required for service state monitoring
   - Optional if running outside s6 environment

4. **OpenCode** (`MC_OPENCODE_BIN`)
   - Required for OpenCode agent status
   - Optional if not using OpenCode

## Health Check

After starting, verify configuration:

```bash
curl http://localhost:9120/api/health
```

Response includes:
```json
{
  "config": {
    "hermes_data": "/opt/data",
    "hermes_cli": "/opt/hermes/.venv/bin/hermes",
    "s6_svstat": "/command/s6-svstat",
    "s6_service_dir": "/run/service",
    "opencode_bin": "/opt/data/.local/npm-global/bin/opencode"
  },
  ...
}
```

Use this to verify which paths are being used.