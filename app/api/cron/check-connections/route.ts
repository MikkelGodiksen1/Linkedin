import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { harvestMessageSenderResults, launchMessageSender } from '@/lib/phantombuster';
import { generateOutreachMessage } from '@/lib/ai';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyAuth(request: Request): boolean {
  const header = request.headers.get('authorization')?.trim();
  const secret = (process.env.CRON_SECRET ?? '').trim();
  return !!secret && header === `Bearer ${secret}`;
}

/**
 * Cron: dagligt kl. 10:00 (man-fre)
 *
 * 1. Harvest output fra gårsdagens Message Sender:
 *    - success: true  → personen er connected og fik beskeden → mark accepted + outreach_sent
 *    - success: false → ikke connected endnu → leave as pending
 * 2. Get alle pending leads uden outreach
 * 3. Generer Claude DM for hvert lead
 * 4. Launch ny Message Sender til i morgen
 *
 * NOTE: Message Sender sender KUN til 1st-degree connections.
 * Det er vores måde at tjekke om en person accepterede.
 */
export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    const got = request.headers.get('authorization');
    return NextResponse.json(
      { error: 'Unauthorized', header: got ?? null, secretSet: !!process.env.CRON_SECRET },
      { status: 401 }
    );
  }

  const sql = db();
  const settings = await getSettings([
    'ai_enabled',
    'ai_services',
    'ai_sender_context',
    'manual_outreach_message',
    'linkedin_li_at',
  ]);
  const aiEnabled = (settings.ai_enabled || 'true') === 'true';

  // ── Step 1: Harvest gårsdagens Message Sender resultater ──────────────────
  const msgResults = await harvestMessageSenderResults();
  let accepted = 0;

  for (const result of msgResults) {
    if (!result.linkedin_url) continue;

    if (result.success) {
      // Personen accepterede og fik beskeden
      await sql`
        UPDATE leads
        SET connection_status = 'accepted',
            invitation_accepted_at = NOW(),
            outreach_sent = TRUE,
            outreach_sent_at = NOW(),
            updated_at = NOW()
        WHERE linkedin_url = ${result.linkedin_url}
      `;
      accepted++;
    }
    // Hvis !result.success → stadig pending, ingen opdatering nødvendig
  }

  // ── Step 2: Generer beskeder for alle pending leads ───────────────────────
  const pending = await sql`
    SELECT id, linkedin_url, name, company, title
    FROM leads
    WHERE connection_status = 'pending'
      AND outreach_sent = FALSE
    ORDER BY invitation_sent_at ASC
    LIMIT 50
  `;

  if (pending.length === 0) {
    console.log(`check-connections: ${accepted} accepted. No pending leads to process.`);
    return NextResponse.json({ accepted, launched: 0 });
  }

  // Generer personaliseret Claude besked for hvert lead
  const leadsWithMessages: { linkedin_url: string; message: string }[] = [];

  for (const lead of pending) {
    const name = (lead.name as string) ?? '';
    const title = (lead.title as string) ?? '';
    const company = (lead.company as string) ?? '';

    const message = aiEnabled
      ? await generateOutreachMessage({
          name,
          title,
          company,
          services: settings.ai_services,
          senderContext: settings.ai_sender_context,
        })
      : buildManualOutreach(settings.manual_outreach_message, { name, title, company });

    leadsWithMessages.push({
      linkedin_url: lead.linkedin_url as string,
      message,
    });

    // Gem den genererede besked i DB (til reference)
    await sql`
      UPDATE leads
      SET outreach_message = ${message}, updated_at = NOW()
      WHERE id = ${lead.id}
    `;
  }

  // ── Step 3: Launch Message Sender til i morgen ────────────────────────────
  await launchMessageSender(leadsWithMessages, { sessionCookie: settings.linkedin_li_at || undefined });

  console.log(`check-connections: ${accepted} accepted. Launched message sender for ${leadsWithMessages.length} leads`);
  return NextResponse.json({ accepted, launched: leadsWithMessages.length });
}

function buildManualOutreach(template: string, lead: { name: string; title: string; company: string }): string {
  const base = template || 'Hej {{navn}}, tak for connect. Hvad fokuserer I mest på i {{virksomhed}} lige nu?';
  return base
    .replace(/{{\s*navn\s*}}/gi, lead.name || 'der')
    .replace(/{{\s*titel\s*}}/gi, lead.title || '')
    .replace(/{{\s*virksomhed\s*}}/gi, lead.company || '');
}
