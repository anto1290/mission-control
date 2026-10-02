import { NextResponse } from 'next/server';
import { getFolders } from '@/lib/api';

export async function GET() {
  const data = await getFolders();
  return NextResponse.json(data);
}
