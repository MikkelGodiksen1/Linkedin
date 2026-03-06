'use client';

import { useState } from 'react';
import styles from '../page.module.css';

export default function ManualConnect() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/manual-connect', { method: 'GET', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Fejl (${res.status})`);
      } else {
        const launched = data?.launched ?? 0;
        const added = data?.addedLeads ?? 0;
        const msg = launched > 0
          ? `Sendt ${launched} connection requests${added > 0 ? ` (${added} nye leads fundet)` : ''}`
          : added > 0
            ? `${added} nye leads tilføjet — ingen flere i kø endnu`
            : 'Ingen leads klar — søgning startet til næste kørsel';
        setResult(msg);
        // Genindlæs siden efter 2 sek så listen opdateres
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
      {result && <div className={styles.noticeSuccess}>{result}</div>}
      {error && <div className={styles.noticeError}>{error}</div>}
    </div>
  );
}
