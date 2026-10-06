import { NextResponse } from 'next/server';
import { getKnowledge } from '@/lib/api-remote';

export async function GET() {
  const data = await getKnowledge();
  return NextResponse.json(data);
}
