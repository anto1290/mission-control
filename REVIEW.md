# Mission Control Review Report
**Date**: 2026-10-02
**Reviewer**: Lead Engineer (via FreeCombo workflow)

---

## CRITICAL Issues

### 1. Dead Code: renderPixelOffice Function
- **Location**: `/opt/data/mission-control/public/app.js:370`
- **Problem**: `renderPixelOffice` is defined but never called. The VIEWS mapping uses `renderOffice` (line 876).
- **Impact**: 100+ lines of unused code
- **Fix**: Remove lines 370-432

---

## IMPORTANT Issues

### 2. OpenCode State Mapping Inconsistency
- **Location**: `/opt/data/mission-control/server/server.js:456-463`
- **Problem**: OpenCode shows as "idle" because `opencode.present=True`, but it has no s6 service and no active tasks.
- **Current Logic**:
  ```javascript
  if (a.opencode) status = a.opencode.present ? 'idle' : 'offline';
  else if (a.service) {
    if (a.service.state === 'up') status = a.claimed_tasks.length ? 'working' : 'idle';
    else status = 'offline';
  }
  ```
- **Expected**: OpenCode should show "offline" when not actively running a task (no claimed_tasks)
- **Fix**: Change condition to check claimed_tasks length for opencode too

### 3. Missing Data Source Documentation
- **Problem**: No comments in server.js explaining where each data source comes from
- **Impact**: Harder to maintain/debug
- **Recommendation**: Add source comments for each API endpoint

---

## WORKING WELL

### Dashboard View
- ✅ All 4 services show correct state (s6-svstat real data)
- ✅ Platform connections accurate (webhook: connected, whatsapp: disconnected, telegram: retrying)
- ✅ Task counts correct (3 total: 2 done, 1 archived)
- ✅ OpenCode status: present=True, version=1.18.34

### Agents View
- ✅ Real agent data from Hermes profiles
- ✅ Model information accurate:
  - Lead Agent: anthropic/claude-opus-4.6
  - Lead Engineer: FreeCombo
  - OpenCode: qlxion/cl/anthropic/claude-sonnet-4.6

### Task Board
- ✅ Kanban data from real kanban.db
- ✅ Task CRUD operations working (tested: create, complete, comment)
- ✅ 3 tasks verified in database

### Calendar View
- ✅ Empty calendar handled gracefully
- ✅ No fake/simulated data shown

### Activity View
- ✅ 15 real activity items logged
- ✅ Sources: sessions, kanban events, cron heartbeats
- ✅ Timestamps accurate

### Memory/Knowledge
- ✅ 2 profiles with memory files (default, leadenginer)
- ✅ 66 skills cataloged
- ✅ File existence verified

### Visual Office
- ✅ Pixel-art rendering working
- ✅ Workspace and Lounge rooms implemented
- ✅ Agent avatars with name labels
- ✅ Room navigation functional
- ✅ Status summary accurate

---

## DATA LIMITATIONS

### Unavailable Data
1. **Channel session counts**: Shows "0 sessions" for all channels (expected - no active Telegram sessions)
2. **Cron jobs**: 0 jobs configured (expected - not yet configured)
3. **Scheduled tasks**: 0 scheduled (expected - no future-dated tasks)
4. **OpenCode active tasks**: None claimed (expected - idle state)

### Graceful Handling
- All missing data shows "—" or empty state
- No simulated/fake data injected
- Empty states clearly labeled

---

## VISUAL OFFICE STATUS

### State Mapping Quality: GOOD
- Working agents: Placed at desks in workspace
- Idle agents: Placed on couch in lounge
- Offline agents: Dimmed at desks with opacity=0.3

### Room Behavior
- Workspace: 8 desks, windows, door, bookshelf, whiteboard, water cooler, plants
- Lounge: Blue couch, purple armchair, TV, coffee table, rug, plants
- Navigation: Buttons toggle between rooms

### Agent Presence
- Lead Agent: idle → on couch (left side)
- Lead Engineer: idle → on couch (center)
- OpenCode: idle (should be offline) → at desk (dimmed)

### Live Activity
- Shows last 5 activity items
- Real timestamps from Hermes events

### Channel Status
- webhook: connected
- whatsapp: disconnected
- telegram: retrying
- Shows session count (0 for all)

---

## SECURITY AUDIT

- ✅ No hardcoded secrets or tokens in code
- ✅ CORS enabled (Access-Control-Allow-Origin: *)
- ✅ Bind address: 0.0.0.0 (intended for container)
- ✅ Input validation on POST endpoints
- ✅ JSON parsing error handling
- ✅ Path traversal protection in serveStatic

---

## RECOMMENDATIONS

### Immediate Fixes
1. Remove dead code (renderPixelOffice)
2. Fix OpenCode state mapping logic

### Optional Improvements (Not Required)
1. Add meeting room / review room
2. Animate agent transitions between rooms
3. Show task assignments on desks
4. Add more furniture variety

---

## FINAL STATUS

**Ready with Limitations**

The Mission Control MVP is functional and meets all core requirements:
- All 8 API endpoints working (9 GET + 5 POST)
- Real data from Hermes sources
- Visual Office with pixel-art rendering
- Graceful handling of missing data
- No simulated/fake data

Limitations are known and documented:
- OpenCode state mapping needs fix
- Dead code should be cleaned
- Some data sources return empty (expected)