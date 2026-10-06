import { NextResponse } from 'next/server';
import { getRuntime } from '@/lib/api-remote';

export async function GET() {
  const data = await getRuntime();
  return NextResponse.json(data);
}
