import { NextResponse } from 'next/server';
import { getChannels } from '@/lib/api-remote';

export async function GET() {
  const data = await getChannels();
  return NextResponse.json(data);
}
