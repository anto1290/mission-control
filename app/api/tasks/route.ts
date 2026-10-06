import { NextResponse } from 'next/server';
import { getTasks } from '@/lib/api-remote';

export async function GET() {
  const data = await getTasks();
  return NextResponse.json(data);
}
