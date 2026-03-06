import db from '@/lib/db';

type SettingsRecord = Record<string, string>;

export const DEFAULT_SETTINGS: SettingsRecord = {
  search_keywords: 'CEO,founder,ejer,direktør',
  search_location: 'Denmark',
  daily_limit: '10',
  invitation_message:
    'Hej {{navn}}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte{{virksomhed}}!',
  ai_services: 'Ny hjemmeside/redesign, Automatiseringer, CRM system, LinkedIn ads, Meta ads',
  ai_sender_context: '',
  ai_enabled: 'true',
  manual_outreach_message: '',
  linkedin_li_at: '',
};

export async function ensureSettingsTable() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  const entries = Object.entries(DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO NOTHING
    `;
  }
}

export async function getSetting(key: string): Promise<string> {
  await ensureSettingsTable();
  const sql = db();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
  const value = rows[0]?.value as string | undefined;
  return value ?? '';
}

export async function getSettings(keys: string[]): Promise<SettingsRecord> {
  if (keys.length === 0) return {};
  await ensureSettingsTable();
  const sql = db();
  const rows = await sql`
    SELECT key, value
    FROM settings
    WHERE key = ANY(${keys})
  `;

  const map: SettingsRecord = {};
  for (const row of rows) {
    map[row.key as string] = (row.value as string) ?? '';
  }
  // return empty string for missing keys to avoid undefined checks
  for (const key of keys) {
    if (!(key in map)) map[key] = '';
  }
  return map;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await ensureSettingsTable();
  const sql = db();
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = ${value},
          updated_at = NOW()
  `;
}
