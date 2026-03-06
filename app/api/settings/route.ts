import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { saveSetting } from '@/lib/settings';

export async function GET() {
  const sql = db();
  const rows = await sql`SELECT key, value FROM settings ORDER BY key ASC`;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key as string] = (row.value as string) ?? '';
  }
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const entries = Object.entries(body as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (typeof key !== 'string') continue;
    await saveSetting(key, String(value ?? ''));
  }

  return NextResponse.json({ updated: entries.length });
}
