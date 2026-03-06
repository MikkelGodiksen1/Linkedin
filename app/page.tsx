import Link from 'next/link';
import styles from './page.module.css';
import db, { ensureSchema } from '@/lib/db';
import ManualConnect from './components/ManualConnect';
import ImportantEmails from './components/ImportantEmails';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StatusKey = 'not_sent' | 'pending' | 'accepted' | 'error';

async function getStats() {
  if (!process.env.DATABASE_URL) {
    return {
      total: 0,
      byStatus: { not_sent: 0, pending: 0, accepted: 0, error: 0 },
      outreachSent: 0,
      outreachPending: 0,
    };
  }
  const sql = db();
  try {
    await ensureSchema();
    const totalRows = await sql`SELECT COUNT(*) AS count FROM leads`;
    const total = Number(totalRows[0]?.count ?? 0);

    const statusRows = await sql`
      SELECT connection_status, COUNT(*) AS count
      FROM leads
      GROUP BY connection_status
    `;

    const byStatus: Record<StatusKey, number> = {
      not_sent: 0,
      pending: 0,
      accepted: 0,
      error: 0,
    };

    for (const row of statusRows) {
      const key = row.connection_status as StatusKey;
      if (key in byStatus) byStatus[key] = Number(row.count ?? 0);
    }

    const outreachRows = await sql`
      SELECT
        SUM(CASE WHEN outreach_sent THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN outreach_sent = FALSE AND connection_status = 'accepted' THEN 1 ELSE 0 END) AS pending
      FROM leads
    `;
    const outreachSent = Number(outreachRows[0]?.sent ?? 0);
    const outreachPending = Number(outreachRows[0]?.pending ?? 0);

    return { total, byStatus, outreachSent, outreachPending };
  } catch (err) {
    console.error('Dashboard stats error', err);
    return {
      total: 0,
      byStatus: { not_sent: 0, pending: 0, accepted: 0, error: 0 },
      outreachSent: 0,
      outreachPending: 0,
    };
  }
}

export default async function Page() {
  const stats = await getStats();
  const recent = await getRecentConnections();

  return (
    <div className={styles.grid}>
      <div className={styles.hero}>
        <div>
          <p className="pill">Live</p>
          <h1>LinkedIn Automation</h1>
          <p className={styles.lead}>
            Overblik over dine leads, invitations og outreach. Tjek at alt kører,
            og hop til settings for at tweake beskeder og søgninger.
          </p>
          <div className={styles.actions}>
            <Link href="/settings" className={styles.primary}>
              Gå til Settings
            </Link>
            <a href="https://vercel.com" className={styles.secondary}>
              Vercel dashboard
            </a>
          </div>
        </div>
      </div>

      <div className={styles.cards}>
        <div className="card">
          <p className={styles.label}>Leads i alt</p>
          <p className={styles.number}>{stats.total}</p>
        </div>
        <div className="card">
          <p className={styles.label}>Connections</p>
          <div className={styles.statusRow}>
            <span>Ikke sendt</span>
            <strong>{stats.byStatus.not_sent}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Pending</span>
            <strong>{stats.byStatus.pending}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Accepteret</span>
            <strong className={styles.good}>{stats.byStatus.accepted}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Fejl</span>
            <strong className={styles.bad}>{stats.byStatus.error}</strong>
          </div>
        </div>
        <div className="card">
          <p className={styles.label}>Outreach</p>
          <div className={styles.statusRow}>
            <span>DM sendt</span>
            <strong className={styles.good}>{stats.outreachSent}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Afventer DM</span>
            <strong>{stats.outreachPending}</strong>
          </div>
          <small>DM sendes først efter accept.</small>
        </div>
        <div className="card">
          <p className={styles.label}>Manuel kørsel</p>
          <ManualConnect />
        </div>
        <div className="card">
          <p className={styles.label}>Vigtige mails i dag</p>
          <ImportantEmails />
        </div>
      </div>

      <div className="card">
        <p className={styles.label}>Seneste invites</p>
        <div className={styles.table}>
          <div className={styles.thead}>
            <span>Navn</span>
            <span>Company</span>
            <span>Status</span>
            <span>Sendt</span>
          </div>
          {recent.length === 0 && <div className={styles.empty}>Ingen udsendte invites endnu.</div>}
          {recent.map(item => (
            <div key={item.linkedin_url} className={styles.row}>
              <span>{item.name || 'Ukendt'}</span>
              <span>{item.company || '—'}</span>
              <span className={styles.badge}>{item.connection_status}</span>
              <span>{item.invitation_sent_at ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function getRecentConnections() {
  if (!process.env.DATABASE_URL) return [];
  const sql = db();
  try {
    const rows = await sql`
      SELECT name, company, connection_status, invitation_sent_at, linkedin_url
      FROM leads
      WHERE invitation_sent_at IS NOT NULL
      ORDER BY invitation_sent_at DESC
      LIMIT 25
    `;
    return rows.map(r => ({
      name: (r.name as string) ?? '',
      company: (r.company as string) ?? '',
      connection_status: (r.connection_status as string) ?? '',
      invitation_sent_at: r.invitation_sent_at
        ? new Date(r.invitation_sent_at as string).toLocaleString('da-DK')
        : null,
      linkedin_url: (r.linkedin_url as string) ?? '',
    }));
  } catch (err) {
    console.error('recent connections error', err);
    return [];
  }
}

// no-op placeholder; manual connect is handled client-side via /api/manual-connect
