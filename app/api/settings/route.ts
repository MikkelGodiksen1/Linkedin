import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { DEFAULT_SETTINGS, ensureSettingsTable, getSettings, saveSetting } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: 'DATABASE_URL missing on server', settings: DEFAULT_SETTINGS },
      { status: 500 }
    );
  }
  await ensureSettingsTable();
  const settings = await getSettings(Object.keys(DEFAULT_SETTINGS));
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL missing on server' }, { status: 500 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await ensureSettingsTable();
  const entries = Object.entries(body as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (typeof key !== 'string') continue;
    await saveSetting(key, String(value ?? ''));
  }

  return NextResponse.json({ updated: entries.length });
}
