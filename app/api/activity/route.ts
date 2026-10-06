import { NextResponse } from 'next/server';
import { getActivity } from '@/lib/api-remote';

export async function GET() {
  const data = await getActivity();
  return NextResponse.json(data);
}
