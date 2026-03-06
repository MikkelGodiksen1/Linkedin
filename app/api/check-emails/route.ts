import { NextResponse } from 'next/server';
import { getTodaysEmails } from '@/lib/gmail';
import { classifyImportantEmails } from '@/lib/ai';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getSettings([
    'gmail_client_id',
    'gmail_client_secret',
    'gmail_refresh_token',
  ]);

  if (!settings.gmail_client_id || !settings.gmail_client_secret || !settings.gmail_refresh_token) {
    return NextResponse.json(
      { error: 'Gmail er ikke konfigureret. Gå til Settings og udfyld Gmail-felterne.' },
      { status: 400 }
    );
  }

  try {
    const emails = await getTodaysEmails(
      settings.gmail_client_id,
      settings.gmail_client_secret,
      settings.gmail_refresh_token
    );

    if (emails.length === 0) {
      return NextResponse.json({ emails: [], important: [] });
    }

    const important = await classifyImportantEmails(emails);
    return NextResponse.json({ emails, important });
  } catch (err) {
    console.error('check-emails fejl', err);
    const message = err instanceof Error ? err.message : 'Ukendt fejl';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
