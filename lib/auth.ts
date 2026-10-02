/**
 * Auth utilities for Hermes Dashboard
 * Uses basic auth with credentials from environment
 */

export interface AuthConfig {
  username: string;
  password: string;
  provider: string;
  dashboardUrl: string;
}

let sessionCookies: string | null = null;
let cachedUser: any = null;

export async function login(config: AuthConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.dashboardUrl}/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.username,
        password: config.password,
        provider: config.provider
      }),
      credentials: 'include'
    });
    
    if (response.ok) {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        sessionCookies = setCookie;
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkAuth(config: AuthConfig): Promise<{ authenticated: boolean; user: any }> {
  // If we have cached user and cookies, return them
  if (sessionCookies && cachedUser) {
    return { authenticated: true, user: cachedUser };
  }
  
  try {
    const response = await fetch(`${config.dashboardUrl}/api/auth/me`, {
      headers: sessionCookies ? { 'Cookie': sessionCookies } : {}
    });
    
    if (response.ok) {
      const user = await response.json();
      cachedUser = user;
      return { authenticated: true, user };
    }
    return { authenticated: false, user: null };
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9119'}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch {
    // Ignore errors
  }
  sessionCookies = null;
  cachedUser = null;
}

export function getSessionCookies(): string | null {
  return sessionCookies;
}

export function getCachedUser(): any {
  return cachedUser;
}
