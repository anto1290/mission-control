/**
 * Hermes API Client
 * 
 * Simple client that bypasses OAuth by using direct API access
 * Configured via environment variables:
 *   HERMES_DASHBOARD_URL=http://localhost:9119
 *   HERMES_AUTH_TOKEN=your_token
 *   HERMES_AUTH_PROVIDER=telegram|whatsapp
 *   HERMES_AUTH_PROFILE=default|leadenginer
 */

export interface AuthConfig {
  dashboardUrl: string;
  provider?: string;
  profile?: string;
  token?: string;
}

export class HermesClient {
  private config: AuthConfig;

  constructor(config?: Partial<AuthConfig>) {
    this.config = {
      dashboardUrl: config?.dashboardUrl || process.env.HERMES_DASHBOARD_URL || 'http://localhost:9119',
      provider: config?.provider || process.env.HERMES_AUTH_PROVIDER || 'telegram',
      profile: config?.profile || process.env.HERMES_AUTH_PROFILE || 'default',
      token: config?.token || process.env.HERMES_AUTH_TOKEN,
    };
  }

  /**
   * Check if configured with auth bypass
   */
  get isConfigured(): boolean {
    return !!this.config.token || !!this.config.provider;
  }

  /**
   * Start OAuth flow (returns session info)
   */
  async startOAuth(): Promise<{ session_id: string; status: string }> {
    const response = await fetch(
      `${this.config.dashboardUrl}/api/memory/providers/${this.config.provider}/oauth/start?profile=${this.config.profile}`,
      { method: 'POST' }
    );
    return response.json();
  }

  /**
   * Poll OAuth status
   */
  async pollOAuth(): Promise<{ status: string; data?: any }> {
    const response = await fetch(
      `${this.config.dashboardUrl}/api/memory/providers/${this.config.provider}/oauth/status?profile=${this.config.profile}`
    );
    return response.json();
  }

  /**
   * Check auth status via /api/auth/me
   */
  async getAuthStatus(): Promise<{ authenticated: boolean; provider: string | null }> {
    try {
      const response = await fetch(`${this.config.dashboardUrl}/api/auth/me`, {
        headers: this.config.token ? { 'Authorization': `Bearer ${this.config.token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        return { authenticated: true, provider: data.provider || this.config.provider || null };
      }
      return { authenticated: false, provider: null };
    } catch {
      return { authenticated: false, provider: null };
    }
  }

  /**
   * Login with password (basic auth)
   */
  async loginPassword(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.dashboardUrl}/auth/password-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, provider: 'basic' }),
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get runtime status (bypasses auth with token)
   */
  async getRuntime() {
    return this.fetch('/api/runtime');
  }

  /**
   * Get dashboard data
   */
  async getDashboard() {
    return this.fetch('/api/dashboard');
  }

  /**
   * Generic fetch with optional auth
   */
  private async fetch(path: string) {
    const url = `${this.config.dashboardUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  /**
   * Get config (for display)
   */
  getConfig() {
    return {
      ...this.config,
      token: this.config.token ? this.config.token.substring(0, 8) + '...' : undefined,
    };
  }
}

// Singleton
let client: HermesClient | null = null;

export function getHermesClient(config?: Partial<AuthConfig>): HermesClient {
  if (!client) {
    client = new HermesClient(config);
  }
  return client;
}
