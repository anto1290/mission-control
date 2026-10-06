import { NextResponse } from 'next/server';

const TOKEN = process.env.NEXT_PUBLIC_AUTH_TOKEN || '';
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9119';

export async function GET(request: Request) {
  const { headers } = request;
  const authHeader = headers.get('authorization') || '';
  
  // Extract token from Authorization: Bearer <token>
  let token = TOKEN;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Proxy to dashboard's auth endpoint
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/auth/me`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to authenticate', detail: String(error) },
      { status: 500 }
    );
  }
}
