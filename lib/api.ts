/**
 * Mission Control API Routes
 * 
 * Direct Next.js API routes that call Hermes CLI
 * Parses text output since --json is not supported
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

// Configuration
const HERMES_CLI = process.env.HERMES_CLI || '/opt/hermes/.venv/bin/hermes';
const HERMES_DATA = process.env.HERMES_DATA || '/opt/data';
const CACHE_MS = 10_000;

// Types
export interface Profile {
  name: string;
  model: string;
  gateway: 'Running' | 'Stopped' | 'Unknown';
}

export interface Source<T> {
  availability: 'available' | 'unavailable';
  data: T;
  error?: { code: 'COMMAND_FAILED' | 'TIMEOUT'; message: string };
}

// Cache
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached(key: string, fetchFn: () => Promise<any>, ms: number = CACHE_MS) {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && (now - cached.timestamp) < ms) {
    return cached.data;
  }
  
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: now });
    return data;
  });
}

// Parse profile list text output
function parseProfileList(stdout: string): Profile[] {
  const lines = stdout.trim().split('\n');
  const profiles: Profile[] = [];

  for (const line of lines) {
    // Skip header lines and separators
    if (line.includes('Profile') || line.includes('─') || line.includes('◆') || !line.trim()) continue;

    // Format: "  default         anthropic/claude-opus-4.6    running      —            —"
    // Split by 2+ spaces and trim
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      profiles.push({
        name: parts[0],
        model: parts[1] || 'unknown',
        gateway: parts[2]?.toLowerCase().includes('running') ? 'Running' : 'Stopped'
      });
    }
  }

  return profiles;
}

// Parse kanban list text output
function parseKanbanList(stdout: string): any[] {
  const lines = stdout.trim().split('\n');
  const tasks: any[] = [];

  for (const line of lines) {
    if (!line.includes('✓')) continue;

    // Format: "✓ t_xxx  done      leadenginer           Title"
    // Match the task ID, status, assignee, and title
    const match = line.match(/✓\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)/);
    if (match) {
      tasks.push({
        id: match[1],
        status: match[2],
        assignee: match[3],
        title: match[4].trim()
      });
    }
  }

  return tasks;
}

// Parse sessions list text output
function parseSessionsList(stdout: string): any[] {
  const lines = stdout.trim().split('\n');
  const sessions: any[] = [];

  for (const line of lines) {
    // Skip headers and separators
    if (line.includes('Title') || line.includes('─') || !line.trim()) continue;

    // Format: "Tidak ada percakapan sebelumny   Cek lagi                                 just now      20261002_041530_b36b60d6"
    // Multiple spaces separate columns
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 4) {
      sessions.push({
        title: parts[0],
        preview: parts[1],
        lastActive: parts[2],
        id: parts[3]
      });
    }
  }

  return sessions;
}

// Parse skills list text output
function parseSkillsList(stdout: string): any[] {
  const lines = stdout.trim().split('\n');
  const skills: any[] = [];

  for (const line of lines) {
    // Skip headers and table borders
    if (line.includes('┏') || line.includes('┃') || line.includes('Name') || line.includes('─') || !line.trim()) continue;

    // Format: "│ ba-requirements         │                      │ local   │ local   │ enabled │"
    // Extract content between │ separators
    const match = line.match(/\│\s*([^\│]+)\│\s*([^\│]+)\│\s*([^\│]+)\│\s*([^\│]+)\│\s*([^\│]+)\│/);
    if (match) {
      skills.push({
        name: match[1].trim(),
        category: match[2].trim() || 'unknown',
        source: match[3].trim() || 'unknown',
        trust: match[4].trim() || 'unknown',
        status: match[5].trim() || 'unknown'
      });
    }
  }

  return skills;
}

// Parse gateway status
function parseGatewayStatus(stdout: string): { running: boolean; pid?: number; platforms: Record<string, any> } {
  const result = {
    running: stdout.includes('running'),
    pid: undefined as number | undefined,
    platforms: {} as Record<string, any>
  };
  
  // Extract PID
  const pidMatch = stdout.match(/PID:\s*(\d+)/);
  if (pidMatch) {
    result.pid = parseInt(pidMatch[1], 10);
  }
  
  // Extract platform status
  const platformLines = stdout.split('\n').filter(l => l.includes('✓') || l.includes('✗'));
  for (const line of platformLines) {
    const match = line.match(/✓\s+(\S+)\s*—\s*(.+)/);
    if (match) {
      result.platforms[match[1]] = { state: 'connected', message: match[2].trim() };
    }
  }
  
  return result;
}

// Hermes CLI commands
async function runHermes(args: string[]): Promise<string> {
  const result = await execFileAsync(HERMES_CLI, args, {
    cwd: HERMES_DATA,
    timeout: 8000,
    env: { ...process.env, HERMES_DATA, PATH: `/opt/hermes/.venv/bin:${process.env.PATH}` }
  });
  return result.stdout;
}

// Runtime endpoint
export async function getSnapshot(now?: number) {
  return getCached('runtime', async () => {
    try {
      const stdout = await runHermes(['profile', 'list']);
      const profiles = parseProfileList(stdout);
      
      return {
        profiles: { availability: 'available', data: profiles },
        openCode: { availability: 'unavailable', data: 'Unknown' },
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        profiles: { 
          availability: 'unavailable', 
          data: [],
          error: { code: 'COMMAND_FAILED', message: error instanceof Error ? error.message : 'Unknown error' }
        },
        openCode: { availability: 'unavailable', data: 'Unknown' },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Dashboard endpoint
export async function getDashboard(now?: number) {
  return getCached('dashboard', async () => {
    const [runtime, tasks, calendar, activity, knowledge, channels, office] = await Promise.all([
      getSnapshot(now),
      getTaskBoard(now),
      getCalendar(now),
      getActivity(now),
      getKnowledge(now),
      getChannels(now),
      getOffice(now)
    ]);
    
    return {
      runtime,
      tasks,
      calendar,
      activity,
      knowledge,
      channels,
      office,
      fetchedAt: new Date().toISOString()
    };
  });
}

// Tasks endpoint
export async function getTaskBoard(now?: number) {
  return getCached('tasks', async () => {
    try {
      const stdout = await runHermes(['kanban', 'list']);
      const tasks = parseKanbanList(stdout);
      
      return {
        tasks: { availability: 'available', data: tasks },
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        tasks: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: String(error) } },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Calendar endpoint
export async function getCalendar(now?: number) {
  return getCached('calendar', async () => {
    try {
      const stdout = await runHermes(['cron', 'list']);
      const hasJobs = !stdout.includes('No scheduled jobs');
      
      return {
        jobs: { availability: 'available', data: hasJobs ? [{ count: 0 }] : [] },
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        jobs: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: String(error) } },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Activity endpoint
export async function getActivity(now?: number) {
  return getCached('activity', async () => {
    try {
      const stdout = await runHermes(['sessions', 'list']);
      const sessions = parseSessionsList(stdout);
      
      return {
        sessions: { availability: 'available', data: sessions },
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        sessions: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: String(error) } },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Knowledge endpoint
export async function getKnowledge(now?: number) {
  return getCached('knowledge', async () => {
    try {
      const stdout = await runHermes(['skills', 'list']);
      const skills = parseSkillsList(stdout);
      
      return {
        skills: { availability: 'available', data: skills },
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        skills: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: String(error) } },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Office endpoint
export async function getOffice(now?: number) {
  return getCached('office', async () => {
    const runtime = await getSnapshot(now);
    const activity = await getActivity(now);
    
    const stations = runtime.profiles.data.map((profile: Profile, index: number) => ({
      id: profile.name,
      name: profile.name,
      role: 'Agent',
      room: index < 2 ? 'Workspace' : 'Lounge',
      roomPosition: index < 2 ? `${index + 1}` : `${index - 1}`,
      state: profile.gateway === 'Running' ? 'Working' : 'Offline',
      currentTask: '',
      recentActivity: '',
      activity: profile.gateway === 'Running' ? 'Active' : 'Idle',
      seat: index + 1,
      provenance: 'hermes-cli',
      freshness: new Date().toISOString()
    }));
    
    const summary = {
      declared: stations.length,
      active: stations.filter(s => s.state === 'Working').length,
      idle: stations.filter(s => s.state === 'Idle').length,
      offline: stations.filter(s => s.state === 'Offline').length,
      unknown: 0,
      gatewaysReachable: stations.filter(s => s.state !== 'Offline').length,
      gatewaysDeclared: stations.length
    };
    
    return { stations, summary, fetchedAt: new Date().toISOString() };
  });
}

// Channels endpoint
export async function getChannels(now?: number) {
  return getCached('channels', async () => {
    try {
      const stdout = await runHermes(['gateway', 'status']);
      const status = parseGatewayStatus(stdout);
      
      const channels = Object.entries(status.platforms).map(([name, info]: [string, any]) => ({
        name,
        status: info.state === 'connected' ? 'Connected' : 'Disconnected'
      }));
      
      return {
        channels: { availability: 'available', data: channels },
        activeSessions: 0,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        channels: { availability: 'unavailable', data: [], error: { code: 'COMMAND_FAILED', message: String(error) } },
        fetchedAt: new Date().toISOString()
      };
    }
  });
}

// Folders endpoint
export async function getFolders() {
  const runtime = await getSnapshot();
  const agents = runtime.profiles.data.map(p => p.name);
  
  return {
    agents: agents.map(name => ({
      profile: name,
      label: name,
      available: true,
      path: join(HERMES_DATA, 'profiles', name)
    })),
    fetchedAt: new Date().toISOString()
  };
}

// Memory endpoint
export async function getMemory() {
  const folders = await getFolders();
  const memory: any[] = [];
  
  for (const agent of folders.agents) {
    try {
      const memoryPath = join(agent.path, 'MEMORY.md');
      if (existsSync(memoryPath)) {
        const content = await import('node:fs').then(fs => fs.default.readFileSync(memoryPath, 'utf8'));
        memory.push({
          profile: agent.profile,
          label: agent.label,
          memory: { content, used: content.length, limit: 2200 }
        });
      }
    } catch {
      memory.push({
        profile: agent.profile,
        label: agent.label,
        memory: null
      });
    }
  }
  
  return memory;
}
