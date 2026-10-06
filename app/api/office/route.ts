import { NextResponse } from 'next/server';
import { getOffice } from '@/lib/api-remote';

export async function GET() {
  const data = await getOffice();
  return NextResponse.json(data);
}
