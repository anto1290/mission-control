/**
 * Mission Control API Routes
 * 
 * Uses remote Hermes API with Bearer token authentication
 * Base URL: https://iyxfrf42-hermes.adacode.ai
 */

// Configuration from environment
const HERMES_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || 'https://iyxfrf42-hermes.adacode.ai';
const HERMES_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

// Headers for API requests
const authHeaders = HERMES_TOKEN ? {
  'Authorization': `Bearer ${HERMES_TOKEN}`,
  'Content-Type': 'application/json'
} : {};

// GET /api/runtime
export async function getRuntime() {
  const response = await fetch(`${HERMES_API_URL}/api/profiles`, { headers: authHeaders });
  const data = await response.json();
  const profiles = data.profiles || data;
  
  return {
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
  };
}

// GET /api/tasks
export async function getTasks() {
  const response = await fetch(`${HERMES_API_URL}/api/plugins/kanban/board`, { headers: authHeaders });
  const data = await response.json();
  
  // Find all tasks from all columns
  const tasks = data.columns?.flatMap((col: any) => col.tasks || []) || [];
  
  return {
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
  };
}

// GET /api/calendar
export async function getCalendar() {
  const response = await fetch(`${HERMES_API_URL}/api/cron/jobs`, { headers: authHeaders });
  const jobs = await response.json();
  
  return {
    jobs: {
      availability: 'available',
      data: jobs
    },
    fetchedAt: new Date().toISOString()
  };
}

// GET /api/activity
export async function getActivity() {
  const response = await fetch(`${HERMES_API_URL}/api/sessions?limit=20`, { headers: authHeaders });
  const data = await response.json();
  const sessions = data.sessions || [];
  
  return {
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
  };
}

// GET /api/knowledge
export async function getKnowledge() {
  const response = await fetch(`${HERMES_API_URL}/api/skills`, { headers: authHeaders });
  const skills = await response.json();
  
  return {
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
  };
}

// GET /api/channels
export async function getChannels() {
  const response = await fetch(`${HERMES_API_URL}/api/status`, { headers: authHeaders });
  const data = await response.json();
  
  const channels = Object.entries(data.gateway_platforms || {}).map(([name, info]: [string, any]) => ({
    name,
    status: info.state === 'connected' ? 'Connected' : 'Disconnected'
  }));
  
  return {
    channels: {
      availability: 'available',
      data: channels
    },
    activeSessions: data.active_sessions || 0,
    fetchedAt: new Date().toISOString()
  };
}

// GET /api/office
export async function getOffice() {
  const response = await fetch(`${HERMES_API_URL}/api/profiles`, { headers: authHeaders });
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
  
  return { stations, summary, fetchedAt: new Date().toISOString() };
}

// GET /api/dashboard
export async function getDashboard() {
  const [runtime, tasks, calendar, activity, knowledge, channels, office] = await Promise.all([
    getRuntime(),
    getTasks(),
    getCalendar(),
    getActivity(),
    getKnowledge(),
    getChannels(),
    getOffice()
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
}
