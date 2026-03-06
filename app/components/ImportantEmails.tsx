'use client';

import { useState } from 'react';
import styles from '../page.module.css';

interface ImportantEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  reason: string;
}

export default function ImportantEmails() {
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<ImportantEmail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setLoading(true);
    setError(null);
    setEmails(null);
    try {
      const res = await fetch('/api/check-emails', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Fejl (${res.status})`);
        return;
      }
      setEmails(data.important ?? []);
    } catch {
      setError('Kunne ikke kontakte serveren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.actionForm}>
      <button type="button" className={styles.primary} onClick={check} disabled={loading}>
        {loading ? 'Tjekker…' : 'Tjek vigtige mails'}
      </button>
      <small>Henter dagens emails og finder de vigtige med AI.</small>

      {error && <div className={styles.noticeError}>{error}</div>}

      {emails !== null && emails.length === 0 && (
        <div className={styles.noticeSuccess}>Ingen vigtige emails i dag.</div>
      )}

      {emails !== null && emails.length > 0 && (
        <div className={styles.emailList}>
          {emails.map(e => (
            <div key={e.id} className={styles.emailItem}>
              <div className={styles.emailFrom}>{e.from}</div>
              <div className={styles.emailSubject}>{e.subject}</div>
              <div className={styles.emailSnippet}>{e.snippet}</div>
              <div className={styles.emailReason}>{e.reason}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
