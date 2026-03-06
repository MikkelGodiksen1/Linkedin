import db from '@/lib/db';

type SettingsRecord = Record<string, string>;

export async function getSetting(key: string): Promise<string> {
  const sql = db();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
  const value = rows[0]?.value as string | undefined;
  return value ?? '';
}

export async function getSettings(keys: string[]): Promise<SettingsRecord> {
  if (keys.length === 0) return {};
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
  const sql = db();
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = ${value},
          updated_at = NOW()
  `;
}
