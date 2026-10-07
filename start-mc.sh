#!/bin/sh
# ponytail: minimal s6-style service definition for Mission Control (dev mode).
# Upgrade path: if container gains root-protected s6-rc, move this to /run/service
# with proper s6-supervise slots. Next.js build is skipped: prod build SIGKILLs
# at lint step under the 2GB cgroup cap (OOM, verified 2026-10-07).
cd /opt/data/mission-control
export PATH=/opt/hermes/.venv/bin:$PATH
exec /usr/local/bin/node node_modules/.bin/next dev -p 3001 -H 127.0.0.1
