/**
 * Mission Control API Routes
 * 
 * Uses remote Hermes API with Bearer token authentication
 * Base URL: https://iyxfrf42-hermes.adacode.ai
 */

import { NextResponse } from 'next/server';

// Configuration from environment
const HERMES_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || 'https://iyxfrf42-hermes.adacode.ai';
const HERMES_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_MS = 10_000;

function getCached(key: string, fetchFn: () => Promise<any>) {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && (now - cached.timestamp) < CACHE_MS) {
    return cached.data;
  }
  
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: now });
    return data;
  });
}

// Headers for API requests
const authHeaders = HERMES_TOKEN ? {
  'Authorization': `Bearer ${HERMES_TOKEN}`,
  'Content-Type': 'application/json'
} : {};

// GET /api/runtime
export async function getRuntime() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/profiles`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    // Response format: { profiles: [...] }
    const profiles = data.profiles || data;
    
    return NextResponse.json({
      profiles: {
        availability: 'available',
        data: Array.isArray(profiles) ? profiles.map((p: any) => ({
          name: p.name,
          model: p.model,
          gateway: p.gateway_running ? 'Running' : 'Stopped',
          skillCount: p.skill_count,
          isDefault: p.is_default
        })) : []
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      profiles: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/tasks
export async function getTasks() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/plugins/kanban/board`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const tasks = data.columns?.flatMap(col => col.tasks || []) || [];
    
    return NextResponse.json({
      tasks: {
        availability: 'available',
        data: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assignee: t.assignee
        }))
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      tasks: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/calendar
export async function getCalendar() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/cron/jobs`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const jobs = await response.json();
    
    return NextResponse.json({
      jobs: {
        availability: 'available',
        data: jobs
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      jobs: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/activity
export async function getActivity() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/sessions?limit=20`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const sessions = data.sessions || [];
    
    return NextResponse.json({
      sessions: {
        availability: 'available',
        data: sessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          preview: s.preview,
          lastActive: new Date(s.last_active * 1000).toLocaleString(),
          isActive: s.is_active
        }))
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      sessions: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/knowledge
export async function getKnowledge() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/skills`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const skills = await response.json();
    
    return NextResponse.json({
      skills: {
        availability: 'available',
        data: Array.isArray(skills) ? skills.map((s: any) => ({
          name: s.name,
          category: s.category || 'unknown',
          enabled: s.enabled,
          usage: s.usage
        })) : []
      },
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      skills: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/channels
export async function getChannels() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/status`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    const channels = Object.entries(data.gateway_platforms || {}).map(([name, info]: [string, any]) => ({
      name,
      status: info.state === 'connected' ? 'Connected' : 'Disconnected'
    }));
    
    return NextResponse.json({
      channels: {
        availability: 'available',
        data: channels
      },
      activeSessions: data.active_sessions || 0,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      channels: {
        availability: 'unavailable',
        data: [],
        error: { code: 'API_ERROR', message: error instanceof Error ? error.message : 'Unknown' }
      },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/office
export async function getOffice() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/profiles`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    const profiles = data.profiles || data;
    
    const stations = (Array.isArray(profiles) ? profiles : []).map((profile: any, index: number) => ({
      id: profile.name,
      name: profile.name,
      role: 'Agent',
      room: index < 2 ? 'Workspace' : 'Lounge',
      state: profile.gateway_running ? 'Working' : 'Offline',
      activity: profile.gateway_running ? 'Active' : 'Idle',
      seat: index + 1,
      freshness: new Date().toISOString()
    }));
    
    const summary = {
      declared: stations.length,
      active: stations.filter(s => s.state === 'Working').length,
      offline: stations.filter(s => s.state === 'Offline').length
    };
    
    return NextResponse.json({
      stations,
      summary,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      stations: [],
      summary: { declared: 0, active: 0, offline: 0 },
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET /api/dashboard
export async function getDashboard() {
  try {
    const [runtime, tasks, calendar, activity, knowledge, channels, office] = await Promise.all([
      getCached('runtime', () => getRuntime()),
      getCached('tasks', () => getTasks()),
      getCached('calendar', () => getCalendar()),
      getCached('activity', () => getActivity()),
      getCached('knowledge', () => getKnowledge()),
      getCached('channels', () => getChannels()),
      getCached('office', () => getOffice())
    ]);
    
    return NextResponse.json({
      runtime: await runtime.json(),
      tasks: await tasks.json(),
      calendar: await calendar.json(),
      activity: await activity.json(),
      knowledge: await knowledge.json(),
      channels: await channels.json(),
      office: await office.json(),
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown',
      fetchedAt: new Date().toISOString()
    }, { status: 500 });
  }
}
