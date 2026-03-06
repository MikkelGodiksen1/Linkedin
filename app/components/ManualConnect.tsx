'use client';

import { useState } from 'react';
import styles from '../page.module.css';

export default function ManualConnect() {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setLines([]);
    setError(null);
    try {
      const res = await fetch('/api/manual-connect', { method: 'GET', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Fejl (${res.status})`);
        return;
      }

      const msgs: string[] = [];

      if ((data.launched ?? 0) > 0) {
        msgs.push(`✓ ${data.launched} connection requests sendt`);
      } else {
        msgs.push('— Ingen leads klar i databasen endnu');
      }

      if ((data.addedLeads ?? 0) > 0) {
        msgs.push(`✓ ${data.addedLeads} nye leads tilføjet fra Phantombuster`);
      }

      if (data.searchStarted) {
        msgs.push(`✓ Søgning startet: "${data.searchKeyword}" (container: ${data.searchContainerId})`);
      } else {
        msgs.push('✗ Søgning fejlede — tjek PHANTOMBUSTER_API_KEY og PHANTOM_SEARCH_EXPORT_ID');
      }

      setLines(msgs);

      if ((data.launched ?? 0) > 0) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setError('Kunne ikke kontakte serveren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.actionForm}>
      <button type="button" className={styles.primary} onClick={run} disabled={loading}>
        {loading ? 'Kører…' : 'Kør 10 connect'}
      </button>
      <small>Finder leads, sender invites og opdaterer listen.</small>
      {lines.length > 0 && (
        <div className={styles.noticeSuccess}>
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
      {error && <div className={styles.noticeError}>{error}</div>}
    </div>
  );
}
