import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { harvestMessageSenderResults, launchMessageSender } from '@/lib/phantombuster';
import { generateOutreachMessage } from '@/lib/ai';

function verifyAuth(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
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
    return new Response('Unauthorized', { status: 401 });
  }

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
    const message = await generateOutreachMessage({
      name: (lead.name as string) ?? '',
      title: (lead.title as string) ?? '',
      company: (lead.company as string) ?? '',
    });

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
  await launchMessageSender(leadsWithMessages);

  console.log(`check-connections: ${accepted} accepted. Launched message sender for ${leadsWithMessages.length} leads`);
  return NextResponse.json({ accepted, launched: leadsWithMessages.length });
}
