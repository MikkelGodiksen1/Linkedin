import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET missing' }, { status: 500 });
  }

  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const res = await fetch(`${host}/api/cron/send-connections`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || `Cron failed (${res.status})` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('manual-connect route error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
