import { neon } from '@neondatabase/serverless';

export default function db() {
  const url = process.env.DATABASE_URL || process.env.Database_Url;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(url);
}

export async function ensureSchema() {
  const sql = db();

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id                      SERIAL PRIMARY KEY,
      linkedin_url            TEXT UNIQUE NOT NULL,
      name                    TEXT,
      company                 TEXT,
      title                   TEXT,
      connection_status       TEXT DEFAULT 'not_sent',
      invitation_sent_at      TIMESTAMP,
      invitation_accepted_at  TIMESTAMP,
      outreach_sent           BOOLEAN DEFAULT FALSE,
      outreach_sent_at        TIMESTAMP,
      outreach_message        TEXT,
      last_post_content       TEXT,
      last_post_url           TEXT,
      notes                   TEXT,
      created_at              TIMESTAMP DEFAULT NOW(),
      updated_at              TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(connection_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_outreach ON leads(outreach_sent)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    INSERT INTO settings (key, value) VALUES
      ('search_keywords',        'CEO,founder,ejer,direktør'),
      ('search_location',        'Denmark'),
      ('daily_limit',            '10'),
      ('invitation_message',     'Hej {{navn}}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte{{virksomhed}}!'),
      ('ai_services',            'Ny hjemmeside/redesign, Automatiseringer, CRM system, LinkedIn ads, Meta ads'),
      ('ai_sender_context',      ''),
      ('ai_enabled',             'true'),
      ('manual_outreach_message',''),
      ('linkedin_li_at',         ''),
      ('gmail_client_id',        ''),
      ('gmail_client_secret',    ''),
      ('gmail_refresh_token',    '')
    ON CONFLICT (key) DO NOTHING
  `;
}
