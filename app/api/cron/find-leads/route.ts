import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { harvestSearchResults, launchSearchExport } from '@/lib/phantombuster';
import { getSettings } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const settings = await getSettings([
    'search_keywords',
    'search_location',
    'daily_limit',
    'linkedin_li_at',
  ]);

  const dailyLimit = Math.min(25, Math.max(1, Number(settings.daily_limit || 10)));

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
  const keywords = settings.search_keywords || 'CEO,founder,ejer,direktør';
  const location = settings.search_location || 'Denmark';

  // Kør med hvert keyword (Search Export tager én søgefrase ad gangen)
  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
  const keyword = keywordList[new Date().getDay() % keywordList.length]; // rotér keywords dagligt
  await launchSearchExport(keyword, location, {
    limit: dailyLimit,
    sessionCookie: settings.linkedin_li_at || undefined,
  });

  console.log(`find-leads: harvested ${leads.length} → added ${added} new. Launched search: "${keyword}"`);
  return NextResponse.json({ harvested: leads.length, added, launchedKeyword: keyword, dailyLimit });
}
