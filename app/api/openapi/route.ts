import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function GET() {
  try {
    const specPath = join(process.cwd(), 'openapi.json');
    const spec = readFileSync(specPath, 'utf8');
    return NextResponse.json(JSON.parse(spec));
  } catch {
    return NextResponse.json({ error: 'OpenAPI spec not found' }, { status: 500 });
  }
}
