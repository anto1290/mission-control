import { NextResponse } from 'next/server';
import { getCalendar } from '@/lib/api-remote';

export async function GET() {
  try {
    const data = await getCalendar();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
}
