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
        setResult(`Launched ${data?.launched ?? 0}, harvested ${data?.harvested ?? 0}`);
      }
    } catch (err) {
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
      <small>Trigger samme flow som cron kl. 09:00 (sender invites til næste batch).</small>
      {result && <div className={styles.noticeSuccess}>{result}</div>}
      {error && <div className={styles.noticeError}>{error}</div>}
    </div>
  );
}
