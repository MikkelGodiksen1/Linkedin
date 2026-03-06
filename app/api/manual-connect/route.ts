import { NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  harvestSearchResults,
  launchSearchExport,
  harvestNetworkBoosterResults,
  launchNetworkBooster,
} from '@/lib/phantombuster';
import { getSettings } from '@/lib/settings';
import { buildInvitation } from '@/lib/invitation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = db();
    const settings = await getSettings([
      'invitation_message',
      'daily_limit',
      'linkedin_li_at',
      'search_keywords',
      'search_location',
    ]);

    const dailyLimit = Math.min(25, Math.max(1, Number(settings.daily_limit || 10)));
    const invitationTemplate =
      settings.invitation_message ||
      'Hej {{navn}}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte{{virksomhed}}!';

    // Step 1: Harvest search results fra Phantombuster og tilføj leads til DB
    const searchLeads = await harvestSearchResults();
    let added = 0;
    for (const lead of searchLeads) {
      if (!lead.linkedin_url) continue;
      const result = await sql`
        INSERT INTO leads (linkedin_url, name, company, title)
        VALUES (${lead.linkedin_url}, ${lead.name ?? null}, ${lead.company ?? null}, ${lead.title ?? null})
        ON CONFLICT (linkedin_url) DO NOTHING
        RETURNING id
      `;
      if (result.length > 0) added++;
    }

    // Step 2: Harvest resultater fra sidste Network Booster kørsel og opdater statuser
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

    // Step 3: Hent næste batch leads fra DB og send connection requests
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

      // Markér dem som 'pending' med det samme så listen opdateres
      for (const lead of leads) {
        await sql`
          UPDATE leads
          SET connection_status = 'pending',
              invitation_sent_at = NOW(),
              updated_at = NOW()
          WHERE id = ${lead.id as number}
        `;
      }
    }

    // Step 4: Launch ny søgning til næste gang
    const keywords = settings.search_keywords || 'CEO,founder,ejer,direktør';
    const location = settings.search_location || 'Denmark';
    const keywordList = keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    const keyword = keywordList[new Date().getDay() % keywordList.length];
    await launchSearchExport(keyword, location, {
      limit: dailyLimit,
      sessionCookie: settings.linkedin_li_at || undefined,
    });

    return NextResponse.json({
      addedLeads: added,
      harvested: boosterResults.length,
      launched: leads.length,
      dailyLimit,
      nextSearch: keyword,
    });
  } catch (err) {
    console.error('manual-connect route error', err);
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
