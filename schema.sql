-- LinkedIn Automation - Database Schema
-- Kør dette i din Neon PostgreSQL database (neon.tech)

CREATE TABLE IF NOT EXISTS leads (
  id                      SERIAL PRIMARY KEY,
  linkedin_url            TEXT UNIQUE NOT NULL,
  name                    TEXT,
  company                 TEXT,
  title                   TEXT,

  -- Connection tracking
  connection_status       TEXT DEFAULT 'not_sent',
  -- Mulige værdier: 'not_sent' | 'pending' | 'accepted' | 'error'
  invitation_sent_at      TIMESTAMP,
  invitation_accepted_at  TIMESTAMP,

  -- Outreach tracking
  outreach_sent           BOOLEAN DEFAULT FALSE,
  outreach_sent_at        TIMESTAMP,
  outreach_message        TEXT,

  -- Post data (til personalisering af DM)
  last_post_content       TEXT,
  last_post_url           TEXT,

  -- Meta
  notes                   TEXT,
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

-- Indexes til hurtige queries
CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(connection_status);
CREATE INDEX IF NOT EXISTS idx_leads_outreach ON leads(outreach_sent);
CREATE INDEX IF NOT EXISTS idx_leads_created  ON leads(created_at);
