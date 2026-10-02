# Mission Control — Remote Deployment Guide

## Overview

Mission Control bisa membaca data Hermes dari server lain dengan 3 cara:

1. **Shared Volume** — Mount folder yang sama
2. **Git Sync** — Pull data via git
3. **SCP/Rsync** — Copy data manual

---

## Opsi 1: Shared Volume (Recommended untuk Docker)

```bash
# Di server Hermes, pastikan data ter-expose
# Atau gunakan NFS/Samba

# Di server Mission Control
mkdir -p /mnt/hermes-data
mount -t nfs hermes-server:/opt/data /mnt/hermes-data

# Jalankan Mission Control
export MC_HERMES_DATA=/mnt/hermes-data
node server/server.js
```

**Keuntungan:**
- Real-time (langsung update)
- Tidak perlu sync manual

**Kekurangan:**
- Butuh network storage (NFS, Samba)
- Single point of failure

---

## Opsi 2: Git Sync (Recommended untuk VPS)

### Setup di Server Hermes

```bash
# 1. Inisialisasi git repo untuk data
cd /opt/data
git init
git add kanban.db profiles/*/state.db gateway_state.json channel_directory.json
git commit -m "Hermes data backup"

# 2. Buat remote (private repo)
git remote add origin https://github.com/anto1290/hermes-data.git
git push -u origin main

# 3. Setup cron job untuk auto-push
(crontab -l 2>/dev/null; echo "*/5 * * * * cd /opt/data && git add -A && git commit -m 'auto-sync' && git push") | crontab -
```

### Setup di Server Mission Control

```bash
# 1. Clone repo
mkdir -p /opt/data-remote
git clone https://github.com/anto1290/hermes-data.git /opt/data-remote

# 2. Setup cron job untuk auto-pull
(crontab -l 2>/dev/null; echo "*/5 * * * * cd /opt/data-remote && git pull") | crontab -

# 3. Jalankan Mission Control
export MC_HERMES_DATA=/opt/data-remote
node server/server.js
```

**Keuntungan:**
- Reliable (ada backup di git)
- Bisa di-version control
- Works across different networks

**Kekurangan:**
- Delay max 5 menit (cron interval)
- Butuh git repo

---

## Opsi 3: SCP/Rsync Manual

```bash
# Sync sekali saja
scp -r hermes-server:/opt/data/* /opt/data-remote/

# Atau dengan rsync (lebih cepat)
rsync -avz hermes-server:/opt/data/ /opt/data-remote/
```

---

## Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `MC_HERMES_DATA` | `/opt/data` | Direktori data Hermes |
| `MC_PORT` | `9120` | Port Mission Control |
| `MC_HOST` | `0.0.0.0` | Bind address |
| `MC_HERMES_CLI` | `/opt/hermes/.venv/bin/hermes` | Path CLI Hermes (untuk write ops) |
| `HERMES_REMOTE_HOST` | — | Host remote untuk auto-sync |

---

## Contoh Deployment

### Scenario: VPS Terpisah

```
Server A (Hermes): iyxfrf42-hermes.adacode.ai
Server B (Mission Control): vps-anda.com

Setup:
1. Push data Hermes ke git repo
2. Pull di Server B setiap 5 menit
3. Jalankan Mission Control di Server B
```

### Scenario: Docker

```bash
# docker-compose.yml
version: '3'
services:
  mission-control:
    image: mission-control:latest
    ports:
      - "9120:9120"
    volumes:
      - /path/to/hermes-data:/data  # Shared volume
    environment:
      - MC_HERMES_DATA=/data
      - MC_PORT=9120
```

---

## Verifikasi

```bash
# Cek config yang aktif
curl http://localhost:9120/api/health

# Response:
{
  "config": {
    "hermes_data": "/opt/data-remote",
    ...
  },
  ...
}
```

---

## Catatan Penting

1. **Hermes API URL** (`iyxfrf42-hermes.adacode.ai`) memerlukan login, jadi tidak bisa diakses via HTTP langsung.

2. **Solusi terbaik**: Gunakan Git Sync atau Shared Volume untuk mengakses data lokal Hermes.

3. **Data yang disinkronkan**:
   - `kanban.db` — Task board
   - `*/state.db` — Session data
   - `gateway_state.json` — Platform connections
   - `channel_directory.json` — Channel list
   - `profiles/*/cron/jobs.json` — Scheduled jobs
   - `profiles/*/skills/` — Skills catalog

4. **Write operations** (create task, complete, etc.) memerlukan Hermes CLI di server yang sama. Jika data di remote, write ops akan gagal (read-only mode).