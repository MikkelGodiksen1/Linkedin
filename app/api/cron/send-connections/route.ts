import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { harvestNetworkBoosterResults, launchNetworkBooster } from '@/lib/phantombuster';
import { getSettings } from '@/lib/settings';
import { buildInvitation } from '@/lib/invitation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyAuth(request: Request): boolean {
  const header = request.headers.get('authorization')?.trim();
  const secret = (process.env.CRON_SECRET ?? '').trim();
  return !!secret && header === `Bearer ${secret}`;
}

/**
 * Cron: dagligt kl. 9:00 (man-fre)
 *
 * 1. Harvest output fra gårsdagens Network Booster → opdater leads i DB
 * 2. Get 10 unsent leads → launch ny Network Booster til i morgen
 */
export async function GET(request: Request) {
  try {
    if (!verifyAuth(request)) {
      const got = request.headers.get('authorization');
      return NextResponse.json(
        { error: 'Unauthorized', header: got ?? null, secretSet: !!process.env.CRON_SECRET },
        { status: 401 }
      );
    }

    const sql = db();
    const settings = await getSettings([
      'invitation_message',
      'daily_limit',
      'linkedin_li_at',
    ]);

    const dailyLimit = Math.min(25, Math.max(1, Number(settings.daily_limit || 10)));
    const invitationTemplate =
      settings.invitation_message ||
      'Hej {{navn}}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte{{virksomhed}}!';

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
      LIMIT ${dailyLimit}
    `;

    if (leads.length > 0) {
      const leadsWithMessage = leads.map(l => ({
        linkedin_url: l.linkedin_url as string,
        message: buildInvitation(invitationTemplate, {
          name: (l.name as string) ?? '',
          company: (l.company as string) ?? '',
          title: (l.title as string) ?? '',
        }),
      }));

      await launchNetworkBooster(leadsWithMessage, {
        sessionCookie: settings.linkedin_li_at || undefined,
      });
    }

    console.log(`send-connections: harvested ${boosterResults.length} results, launched ${leads.length} new`);
    return NextResponse.json({
      harvested: boosterResults.length,
      launched: leads.length,
      dailyLimit,
    });
  } catch (err) {
    console.error('send-connections error', err);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
