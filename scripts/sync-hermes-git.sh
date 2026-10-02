#!/bin/bash
# Sync Hermes data from remote server using git
# This script:
# 1. Pulls latest data from remote Hermes server
# 2. Runs Mission Control
#
# Setup:
#   1. Create git repo di server Hermes: /opt/data/.git (atau pakai private repo)
#   2. Install di server Mission Control
#   3. Jalankan via cron setiap 5 menit

set -e

REMOTE_REPO="${MC_REM