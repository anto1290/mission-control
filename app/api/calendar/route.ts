import { NextResponse } from 'next/server';
import { getCalendar } from '@/lib/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fresh = searchParams.get('fresh') === '1';
  const now = fresh ? Date.now() + 8000 : Date.now();
  
  const data = await getCalendar(now);
  return NextResponse.json(data);
}
