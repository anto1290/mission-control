import { NextResponse } from 'next/server';
import { getCalendar } from '@/lib/api-remote';

export async function GET() {
  const data = await getCalendar();
  return NextResponse.json(data);
}
