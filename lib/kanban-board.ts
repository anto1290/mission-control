/**
 * Kanban board service — direct Hermes CLI bridge for the Mission Control board page.
 *
 * Reads:
 *   - boards list / task list / assignees / diagnostics via `hermes kanban ... --json`
 *   - subtask progress + comment counts read-only from the board's SQLite DB (node:sqlite)
 *
 * Writes (actions):
 *   create / complete / block / unblock / promote / archive / assign / comment / nudge / new-board
 *
 * No global state is mutated: every command targets a board via `--board <slug>`,
 * so the CLI's active-board pointer is never switched.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const execFileAsync = promisify(execFile);

const HERMES_CLI = process.env.HERMES_CLI || '/opt/hermes/.venv/bin/hermes';

export const LANES = [
  'triage',
  'todo',
  'scheduled',
  'ready',
  'running',
  'review',
  'blocked',
  'done',
] as const;

export type LaneKey = (typeof LANES)[number];

export interface BoardTask {
  id: string;
  title: string;
  body: string | null;
  assignee: string | null;
  status: string;
  priority: number;
  tenant: string | null;
  created_by: string | null;
  created_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  skills: string[];
  result: string | null;
  n_comments: number;
  children_total: number;
  children_done: number;
  has_diagnostic: boolean;
}

export interface BoardInfo {
  slug: string;
  name: string;
  counts: Record<string, number>;
  total: number;
  is_current: boolean;
  archived: boolean;
  db_path: string;
}

export interface AssigneeInfo {
  name: string;
  on_disk: boolean;
  counts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

function runKananbanArgs(board: string | undefined, args: string[]): string[] {
  const full: string[] = ['kanban'];
  if (board) full.push('--board', board);
  return [...full, ...args];
}

function kanbanJson(board: string | undefined, args: string[], timeout = 30_000): Promise<any> {
  return execFileAsync(HERMES_CLI, runKananbanArgs(board, args), {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  })
    .then(({ stdout }) => {
      const out = stdout.trim();
      if (!out) return [];
      return JSON.parse(out);
    })
    .catch((e: any) => {
      const detail = [e.message, e.stdout?.trim(), e.stderr?.trim()].filter(Boolean).join(' | ');
      throw new Error(detail);
    });
}

function kanbanText(board: string | undefined, args: string[], timeout = 60_000): Promise<string> {
  return execFileAsync(HERMES_CLI, runKananbanArgs(board, args), {
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  })
    .then(({ stdout }) => stdout.trim())
    .catch((e: any) => {
      const detail = [e.message, e.stdout?.trim(), e.stderr?.trim()].filter(Boolean).join(' | ');
      throw new Error(detail);
    });
}

// ---------------------------------------------------------------------------
// SQLite read-only helpers (subtask progress + comment counts)
// ---------------------------------------------------------------------------

interface DbCounts {
  progress: Map<string, { total: number; done: number }>;
  comments: Map<string, number>;
}

function readBoardCounts(dbPath: string): DbCounts {
  const empty: DbCounts = { progress: new Map(), comments: new Map() };
  if (!dbPath || !existsSync(dbPath)) return empty;

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const progRows = db
      .prepare(
        `SELECT l.parent_id AS parent_id,
                COUNT(*) AS total,
                SUM(CASE WHEN c.status IN ('done','archived') THEN 1 ELSE 0 END) AS done
         FROM task_links l
         JOIN tasks c ON c.id = l.child_id
         GROUP BY l.parent_id`
      )
      .all() as any[];
    const progress = new Map<string, { total: number; done: number }>();
    for (const r of progRows) {
      progress.set(r.parent_id, { total: r.total, done: Number(r.done ?? 0) });
    }

    const commRows = db
      .prepare('SELECT task_id, COUNT(*) AS n FROM task_comments GROUP BY task_id')
      .all() as any[];
    const comments = new Map<string, number>();
    for (const r of commRows) comments.set(r.task_id, Number(r.n));

    return { progress, comments };
  } catch {
    return empty;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore close errors */
    }
  }
}

// ---------------------------------------------------------------------------
// Data fetch (GET /api/board)
// ---------------------------------------------------------------------------

export interface BoardData {
  board: BoardInfo;
  boards: BoardInfo[];
  tasks: BoardTask[];
  assignees: AssigneeInfo[];
  tenants: string[];
  diagnostics: any[];
}

export async function fetchBoardData(opts: {
  board?: string;
  archived?: boolean;
  assignee?: string;
  q?: string;
}): Promise<BoardData> {
  // 1) boards (global) — also gives us the current slug + db_path
  const boards = (await kanbanJson(undefined, ['boards', 'list', '--json'])) as BoardInfo[];
  if (!Array.isArray(boards) || boards.length === 0) {
    throw new Error('No kanban boards found — run `hermes kanban init` first');
  }
  const current = boards.find((b) => b.is_current) ?? boards[0];
  const slug = opts.board ?? current.slug;
  const board = boards.find((b) => b.slug === slug) ?? current;

  // 2) tasks + assignees + diagnostics in parallel, all scoped to the board
  const listArgs: string[] = ['list', '--json'];
  if (opts.archived) listArgs.push('--archived');
  if (opts.assignee) listArgs.push('--assignee', opts.assignee);

  const [tasksRaw, assignees, diagnostics] = await Promise.all([
    kanbanJson(board.slug, listArgs),
    kanbanJson(board.slug, ['assignees', '--json']),
    kanbanJson(board.slug, ['diagnostics', '--json']).catch(() => []),
  ]);

  // 3) DB-level counts for the selected board
  const { progress, comments } = readBoardCounts(board.db_path);
  const diagTaskIds = new Set(
    (diagnostics as any[]).map((d) => String(d.task_id)).filter(Boolean)
  );

  let tasks: BoardTask[] = (Array.isArray(tasksRaw) ? tasksRaw : []).map((t: any) => ({
    id: t.id,
    title: t.title,
    body: t.body ?? null,
    assignee: t.assignee ?? null,
    status: t.status,
    priority: t.priority ?? 0,
    tenant: t.tenant ?? null,
    created_by: t.created_by ?? null,
    created_at: t.created_at ?? null,
    started_at: t.started_at ?? null,
    completed_at: t.completed_at ?? null,
    skills: Array.isArray(t.skills) ? t.skills : [],
    result: t.result ?? null,
    n_comments: comments.get(t.id) ?? 0,
    children_total: progress.get(t.id)?.total ?? 0,
    children_done: progress.get(t.id)?.done ?? 0,
    has_diagnostic: diagTaskIds.has(String(t.id)),
  }));

  // 4) client-side search filter
  const q = opts.q?.trim().toLowerCase();
  if (q) {
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        (t.assignee ?? '').toLowerCase().includes(q)
    );
  }

  const tenants = Array.from(new Set(tasks.map((t) => t.tenant).filter((x): x is string => !!x)));

  return {
    board,
    boards,
    tasks,
    assignees: Array.isArray(assignees) ? assignees : [],
    tenants,
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
  };
}

// ---------------------------------------------------------------------------
// Task detail (GET /api/board/task/[id])
// ---------------------------------------------------------------------------

export interface TaskDetail {
  task: any;
  parents: string[];
  children: string[];
  comments: any[];
  events: any[];
  runs: any[];
  diagnostics: any[];
}

export async function fetchTaskDetail(board: string, taskId: string): Promise<TaskDetail> {
  const [shown, diagnostics] = await Promise.all([
    kanbanJson(board, ['show', taskId, '--json']),
    kanbanJson(board, ['diagnostics', '--json', '--task', taskId]).catch(() => []),
  ]);
  return {
    task: shown?.task ?? shown,
    parents: shown?.parents ?? [],
    children: shown?.children ?? [],
    comments: (shown?.comments ?? []).slice().reverse(),
    events: (shown?.events ?? []).slice(0, 30),
    runs: [],
    diagnostics: Array.isArray(diagnostics) ? diagnostics : [],
  };
}

// ---------------------------------------------------------------------------
// Actions (POST /api/board)
// ---------------------------------------------------------------------------

export type BoardAction =
  | 'create'
  | 'complete'
  | 'block'
  | 'unblock'
  | 'promote'
  | 'archive'
  | 'assign'
  | 'comment'
  | 'nudge'
  | 'new-board';

export async function boardAction(
  action: BoardAction,
  board: string | undefined,
  p: Record<string, any>
): Promise<any> {
  switch (action) {
    case 'create': {
      if (!p.title) throw new Error('title is required');
      const args = ['create', String(p.title)];
      if (p.body) args.push('--body', String(p.body));
      if (p.assignee) args.push('--assignee', String(p.assignee));
      if (p.parent) args.push('--parent', String(p.parent));
      if (p.triage) args.push('--triage');
      if (p.priority != null) args.push('--priority', String(p.priority));
      args.push('--json');
      return kanbanJson(board, args);
    }
    case 'complete': {
      if (!p.id) throw new Error('id is required');
      const args = ['complete', String(p.id)];
      if (p.result) args.push('--result', String(p.result));
      return kanbanText(board, args);
    }
    case 'block': {
      if (!p.id) throw new Error('id is required');
      const args = ['block', String(p.id)];
      if (p.reason) args.push(...String(p.reason).split(' '));
      return kanbanText(board, args);
    }
    case 'unblock': {
      if (!p.id) throw new Error('id is required');
      return kanbanText(board, ['unblock', String(p.id)]);
    }
    case 'promote': {
      if (!p.id) throw new Error('id is required');
      const args = ['promote', String(p.id)];
      if (p.reason) args.push(...String(p.reason).split(' '));
      return kanbanText(board, args, 30_000);
    }
    case 'archive': {
      if (!p.id) throw new Error('id is required');
      return kanbanText(board, ['archive', String(p.id)]);
    }
    case 'assign': {
      if (!p.id || !p.profile) throw new Error('id and profile are required');
      return kanbanText(board, ['assign', String(p.id), String(p.profile)]);
    }
    case 'comment': {
      if (!p.id || !p.text) throw new Error('id and text are required');
      return kanbanText(board, ['comment', String(p.id), String(p.text)]);
    }
    case 'nudge': {
      // One dispatcher pass: reclaim stale claims, promote ready, spawn workers.
      return kanbanJson(board, ['dispatch', '--json'], 60_000);
    }
    case 'new-board': {
      if (!p.slug) throw new Error('slug is required');
      const args = ['boards', 'create', String(p.slug)];
      if (p.name) args.push('--name', String(p.name));
      if (p.switchAfter) args.push('--switch');
      return kanbanJson(board, args);
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
