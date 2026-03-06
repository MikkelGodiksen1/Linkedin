import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { harvestNetworkBoosterResults, launchNetworkBooster } from '@/lib/phantombuster';

function verifyAuth(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Cron: dagligt kl. 9:00 (man-fre)
 *
 * 1. Harvest output fra gårsdagens Network Booster → opdater leads i DB
 * 2. Get 10 unsent leads → launch ny Network Booster til i morgen
 */
export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Step 1: Harvest gårsdagens connection requests ────────────────────────
  const boosterResults = await harvestNetworkBoosterResults();

  for (const result of boosterResults) {
    if (!result.linkedin_url) continue;

    if (result.status === 'sent') {
      await sql`
        UPDATE leads
        SET connection_status = 'pending',
            invitation_sent_at = NOW(),
            updated_at = NOW()
        WHERE linkedin_url = ${result.linkedin_url}
          AND connection_status = 'not_sent'
      `;
    } else if (result.status === 'already_connected') {
      await sql`
        UPDATE leads
        SET connection_status = 'accepted',
            updated_at = NOW()
        WHERE linkedin_url = ${result.linkedin_url}
      `;
    } else if (result.status === 'error') {
      await sql`
        UPDATE leads
        SET connection_status = 'error',
            updated_at = NOW()
        WHERE linkedin_url = ${result.linkedin_url}
          AND connection_status = 'not_sent'
      `;
    }
  }

  // ── Step 2: Launch ny batch med 10 unsent leads ───────────────────────────
  const leads = await sql`
    SELECT id, linkedin_url, name, company, title
    FROM leads
    WHERE connection_status = 'not_sent'
    ORDER BY created_at ASC
    LIMIT 10
  `;

  if (leads.length > 0) {
    await launchNetworkBooster(
      leads.map(l => ({
        linkedin_url: l.linkedin_url as string,
        name: (l.name as string) ?? '',
        company: (l.company as string) ?? '',
      }))
    );
  }

  console.log(`send-connections: harvested ${boosterResults.length} results, launched ${leads.length} new`);
  return NextResponse.json({
    harvested: boosterResults.length,
    launched: leads.length,
  });
}
