/**
 * Mission Control API Routes
 * 
 * Direct Next.js API routes that call Hermes CLI
 * Replaces the separate Raum server
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
      const stdout = await runHermes(['profile', 'list', '--json']);
      const profiles = JSON.parse(stdout);
      
      const data: Profile[] = profiles.map((p: any) => ({
        name: p.name,
        model: p.model || 'unknown',
        gateway: p.gateway?.state === 'running' ? 'Running' : 'Stopped'
      }));
      
      return {
        profiles: { availability: 'available', data },
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
      const stdout = await runHermes(['kanban', 'list', '--json']);
      const tasks = JSON.parse(stdout);
      
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
      const stdout = await runHermes(['cron', 'list', '--json']);
      const jobs = JSON.parse(stdout);
      
      return {
        jobs: { availability: 'available', data: jobs },
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
      const stdout = await runHermes(['sessions', 'list', '--json']);
      const sessions = JSON.parse(stdout);
      
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
      const stdout = await runHermes(['skills', 'list', '--json']);
      const skills = JSON.parse(stdout);
      
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
      const stdout = await runHermes(['gateway', 'status', '--json']);
      const status = JSON.parse(stdout);
      
      const channels: any[] = [];
      for (const [name, info] of Object.entries(status.platforms || {})) {
        channels.push({
          name,
          status: (info as any).state === 'connected' ? 'Connected' : 'Disconnected'
        });
      }
      
      return {
        channels: { availability: 'available', data: channels },
        activeSessions: status.active_sessions || 0,
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
  
  return { agents: memory, fetchedAt: new Date().toISOString() };
}
