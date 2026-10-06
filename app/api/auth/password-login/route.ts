import { NextResponse } from 'next/server';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:9119';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password, provider } = body;
    
    const response = await fetch(`${DASHBOARD_URL}/auth/password-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, provider }),
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: 'Login failed', detail: String(error) },
      { status: 500 }
    );
  }
}
