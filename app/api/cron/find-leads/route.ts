import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { harvestSearchResults, launchSearchExport } from '@/lib/phantombuster';

function verifyAuth(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Cron: dagligt kl. 8:00 (man-fre)
 *
 * 1. Harvest output fra gårsdagens Search Export → indsæt nye leads i DB
 * 2. Launch ny Search Export til i morgen
 */
export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sql = db();

  // ── Step 1: Harvest gårsdagens søgeresultater ─────────────────────────────
  const leads = await harvestSearchResults();
  let added = 0;

  for (const lead of leads) {
    if (!lead.linkedin_url) continue;

    const result = await sql`
      INSERT INTO leads (linkedin_url, name, company, title)
      VALUES (${lead.linkedin_url}, ${lead.name ?? null}, ${lead.company ?? null}, ${lead.title ?? null})
      ON CONFLICT (linkedin_url) DO NOTHING
      RETURNING id
    `;

    if (result.length > 0) added++;
  }

  // ── Step 2: Launch ny søgning til i morgen ────────────────────────────────
  const keywords = process.env.LEAD_SEARCH_KEYWORDS ?? 'CEO,founder,ejer,direktør';
  const location = process.env.LEAD_SEARCH_LOCATION ?? 'Denmark';

  // Kør med hvert keyword (Search Export tager én søgefrase ad gangen)
  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
  const keyword = keywordList[new Date().getDay() % keywordList.length]; // rotér keywords dagligt
  await launchSearchExport(keyword, location);

  console.log(`find-leads: harvested ${leads.length} → added ${added} new. Launched search: "${keyword}"`);
  return NextResponse.json({ harvested: leads.length, added, launchedKeyword: keyword });
}
