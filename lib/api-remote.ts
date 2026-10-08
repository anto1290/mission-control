/**
 * Mission Control API Routes
 *
 * Dual-mode: local Hermes CLI or remote API
 * - Local: Uses Hermes CLI directly (no auth needed)
 * - Remote: Uses Bearer token auth via HERMES_API_URL
 */

const HERMES_API_URL = process.env.NEXT_PUBLIC_HERMES_API_URL || 'https://iyxfrf42-hermes.adacode.ai';
const HERMES_TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';

// Check if we should use remote API
const USE_REMOTE = !!HERMES_TOKEN && !!HERMES_API_URL;

const authHeaders = HERMES_TOKEN ? {
  'Authorization': `Bearer ${HERMES_TOKEN}`,
  'Content-Type': 'application/json'
} : {};

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

export async function getTasks() {
  const response = await fetch(`${HERMES_API_URL}/api/plugins/kanban/board`, { headers: authHeaders });
  const data = await response.json();
  const tasks = data.columns?.flatMap((col: any) => col.tasks || []) || [];
  
  return {
    tasks: {
      availability: 'available',
      data: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignee: t.assignee
      })),
      total: tasks.length
    },
    fetchedAt: new Date().toISOString()
  };
}

export async function getCalendar() {
  const response = await fetch(`${HERMES_API_URL}/api/cron/jobs`, { headers: authHeaders });
  const jobs = await response.json();
  const jobList = Array.isArray(jobs) ? jobs : [];
  
  return {
    calendar: {
      availability: 'available',
      data: jobList,
      total: jobList.length
    },
    fetchedAt: new Date().toISOString()
  };
}

export async function getActivity() {
  const response = await fetch(`${HERMES_API_URL}/api/sessions?limit=20`, { headers: authHeaders });
  const data = await response.json();
  const sessions = data.sessions || [];
  const sessionList = Array.isArray(sessions) ? sessions : [];
  
  return {
    activity: {
      availability: 'available',
      data: sessionList.map((s: any) => ({
        id: s.id,
        title: s.title,
        preview: s.preview,
        lastActive: s.last_active ? new Date(s.last_active * 1000).toLocaleString() : '',
        isActive: s.is_active
      })),
      total: sessionList.length,
      latest: sessionList[0] ? {
        id: sessionList[0].id,
        title: sessionList[0].title,
        preview: sessionList[0].preview,
        lastActive: sessionList[0].last_active ? new Date(sessionList[0].last_active * 1000).toLocaleString() : '',
        isActive: sessionList[0].is_active
      } : undefined
    },
    fetchedAt: new Date().toISOString()
  };
}

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
      })) : [],
      total: Array.isArray(skills) ? skills.length : 0
    },
    fetchedAt: new Date().toISOString()
  };
}

export async function getChannels() {
  const response = await fetch(`${HERMES_API_URL}/api/status`, { headers: authHeaders });
  const data = await response.json();
  
  const channels = Object.entries(data.gateway_platforms || {}).map(([name, info]: [string, any]) => ({
    name,
    status: info.state === 'connected' ? 'Connected' : 'Disconnected'
  }));
  
  const connected = channels.filter((c: any) => c.status === 'Connected').length;
  
  return {
    channels: {
      availability: 'available',
      data: channels,
      total: channels.length,
      connected
    },
    activeSessions: data.active_sessions || 0,
    fetchedAt: new Date().toISOString()
  };
}

export async function getOffice() {
  try {
    const response = await fetch(`${HERMES_API_URL}/api/profiles`, { headers: authHeaders });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const profiles = data.profiles || data;

    const stations = (Array.isArray(profiles) ? profiles : []).map((profile: any, index: number) => ({
      id: profile.name,
      name: profile.name,
      model: profile.model,
      state: profile.gateway_running ? 'Working' : 'Offline',
      room: ['Workspace', 'Lounge', 'Meeting'][index % 3],
      seat: index + 1,
      color: ['#5b9bd5', '#4fb986', '#e07b39', '#9f7aea', '#f59e42', '#f472b6', '#60a5fa', '#a78bfa', '#34d399'][index] || '#5b9bd5',
      freshness: new Date().toISOString()
    }));

    const active = stations.filter(s => s.state === 'Working').length;
    const offline = stations.filter(s => s.state === 'Offline').length;

    return {
      office: {
        availability: 'available',
        declared: stations.length,
        active: active,
        idle: 0,
        offline: offline,
        data: stations
      },
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      office: {
        availability: 'error',
        declared: 0,
        active: 0,
        idle: 0,
        offline: 0,
        data: []
      },
      fetchedAt: new Date().toISOString()
    };
  }
}

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
    runtime: runtime.profiles,
    tasks: tasks.tasks,
    calendar: calendar.calendar,
    activity: activity.activity,
    knowledge: knowledge.skills,
    channels: channels.channels,
    office: office.office,
    fetchedAt: new Date().toISOString()
  };
}
