/**
 * Hermes OAuth Flow Handler
 * 
 * Handles OAuth authentication for Hermes Dashboard API
 * Supports: Telegram, WhatsApp, and other messaging platforms
 */

export interface OAuthSession {
  provider: string;
  sessionId: string;
  status: 'idle' | 'pending' | 'connected' | 'error';
  error?: string;
  startedAt: number;
  expiresAt?: number;
}

export interface OAuthProvider {
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
}

export class HermesOAuth {
  private dashboardUrl: string;
  private cookieJar: Map<string, string> = new Map();
  private sessions: Map<string, OAuthSession> = new Map();

  constructor(dashboardUrl: string = `http://localhost:${process.env.HERMES_DASHBOARD_PORT || '9119'}`) {
    this.dashboardUrl = dashboardUrl;
  }

  /**
   * Get available OAuth providers
   */
  async getProviders(): Promise<OAuthProvider[]> {
    const response = await fetch(`${this.dashboardUrl}/api/providers/oauth`);
    if (!response.ok) throw new Error(`Failed to get providers: ${response.statusText}`);
    return response.json();
  }

  /**
   * Start OAuth flow for a provider
   */
  async startOAuth(provider: string, profile?: string): Promise<OAuthSession> {
    const url = new URL(`${this.dashboardUrl}/api/memory/providers/${provider}/oauth/start`);
    if (profile) url.searchParams.set('profile', profile);

    const response = await fetch(url.toString(), { method: 'POST' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start OAuth');
    }

    const data = await response.json();
    const session: OAuthSession = {
      provider,
      sessionId: data.session_id || this.generateSessionId(),
      status: 'pending',
      startedAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 minutes
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * Poll OAuth status
   */
  async pollStatus(provider: string, sessionId: string, profile?: string): Promise<{ status: string; data?: any }> {
    const url = new URL(`${this.dashboardUrl}/api/memory/providers/${provider}/oauth/status`);
    url.searchParams.set('session_id', sessionId);
    if (profile) url.searchParams.set('profile', profile);

    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Failed to poll status: ${response.statusText}`);
    
    return response.json();
  }

  /**
   * Submit OAuth token (for manual entry)
   */
  async submitOAuth(provider: string, token: string, profile?: string): Promise<any> {
    const url = new URL(`${this.dashboardUrl}/api/providers/oauth/${provider}/submit`);
    if (profile) url.searchParams.set('profile', profile);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) throw new Error(`Failed to submit OAuth: ${response.statusText}`);
    return response.json();
  }

  /**
   * Poll OAuth session
   */
  async pollSession(provider: string, sessionId: string): Promise<any> {
    const response = await fetch(
      `${this.dashboardUrl}/api/providers/oauth/${provider}/poll/${sessionId}`,
      { method: 'GET' }
    );

    if (!response.ok) throw new Error(`Failed to poll session: ${response.statusText}`);
    return response.json();
  }

  /**
   * Delete OAuth session
   */
  async deleteSession(provider: string, sessionId: string): Promise<void> {
    const response = await fetch(
      `${this.dashboardUrl}/api/providers/oauth/${provider}/${sessionId}`,
      { method: 'DELETE' }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to delete session: ${response.statusText}`);
    }
  }

  /**
   * Check auth status
   */
  async getAuthStatus(): Promise<{ authenticated: boolean; provider: string | null }> {
    try {
      const response = await fetch(`${this.dashboardUrl}/api/auth/me`);
      if (response.ok) {
        const data = await response.json();
        return { authenticated: true, provider: data.provider || null };
      }
      return { authenticated: false, provider: null };
    } catch {
      return { authenticated: false, provider: null };
    }
  }

  /**
   * Login with password
   */
  async loginPassword(username: string, password: string): Promise<boolean> {
    const response = await fetch(`${this.dashboardUrl}/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, provider: 'basic' }),
      credentials: 'include',
    });

    if (response.ok) {
      // Store cookies
      const setCookies = response.headers.get('set-cookie');
      if (setCookies) {
        this.cookieJar.set('auth', setCookies);
      }
      return true;
    }
    return false;
  }

  /**
   * Get current session
   */
  getSession(sessionId: string): OAuthSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all sessions
   */
  listSessions(): OAuthSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt && session.expiresAt < now) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Singleton instance
let oauthInstance: HermesOAuth | null = null;

export function getOAuthClient(dashboardUrl?: string): HermesOAuth {
  if (!oauthInstance) {
    oauthInstance = new HermesOAuth(dashboardUrl);
  }
  return oauthInstance;
}
