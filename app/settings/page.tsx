'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import styles from './settings.module.css';

type SettingsState = {
  search_keywords: string;
  search_location: string;
  daily_limit: string;
  invitation_message: string;
  ai_services: string;
  ai_sender_context: string;
  ai_enabled: string;
  manual_outreach_message: string;
  linkedin_li_at: string;
  gmail_client_id: string;
  gmail_client_secret: string;
  gmail_refresh_token: string;
};

const initialState: SettingsState = {
  search_keywords: '',
  search_location: '',
  daily_limit: '10',
  invitation_message:
    'Hej {{navn}}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte{{virksomhed}}!',
  ai_services: 'Ny hjemmeside/redesign, Automatiseringer, CRM system, LinkedIn ads, Meta ads',
  ai_sender_context: '',
  ai_enabled: 'true',
  manual_outreach_message: '',
  linkedin_li_at: '',
  gmail_client_id: '',
  gmail_client_secret: '',
  gmail_refresh_token: '',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        const data = (await res.json()) as Partial<SettingsState>;
        setSettings(prev => ({ ...prev, ...data }));
      } catch (err) {
        console.error('Failed to load settings', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (key: keyof SettingsState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings(prev => ({ ...prev, [key]: e.target.value }));
    setSaved(false);
  };

  const aiEnabled = settings.ai_enabled === 'true';

  const invitationPreview = useMemo(() => {
    const sample = { navn: 'Sofie', virksomhed: ' Nordlyx' };
    return settings.invitation_message
      .replace(/{{\s*navn\s*}}/gi, sample.navn)
      .replace(/{{\s*virksomhed\s*}}/gi, sample.virksomhed);
  }, [settings.invitation_message]);

  const manualPreview = useMemo(() => {
    const sample = { navn: 'Sofie', titel: 'CEO', virksomhed: 'Nordlyx' };
    return settings.manual_outreach_message
      .replace(/{{\s*navn\s*}}/gi, sample.navn)
      .replace(/{{\s*titel\s*}}/gi, sample.titel)
      .replace(/{{\s*virksomhed\s*}}/gi, sample.virksomhed);
  }, [settings.manual_outreach_message]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.layout} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <div>
          <p className="pill">Konfiguration</p>
          <h1>Settings</h1>
          <p className={styles.sub}>Styr søgninger, beskeder, AI og LinkedIn session uden at åbne Vercel.</p>
        </div>
        <div className={styles.actions}>
          {saved && <span className={styles.saved}>Gemt ✓</span>}
          <button type="submit" disabled={saving || loading}>
            {saving ? 'Gemmer…' : 'Gem'}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        <section className="card">
          <h3 className="section-title">🎯 Hvem søger du efter?</h3>
          <p className="section-sub">Keywords, lokation og daglig grænse for nye connections.</p>
          <label>Keywords (kommasepareret)</label>
          <input
            value={settings.search_keywords}
            onChange={handleChange('search_keywords')}
            placeholder="CEO, founder, ejer"
            required
          />
          <label>Location</label>
          <input
            value={settings.search_location}
            onChange={handleChange('search_location')}
            placeholder="Denmark"
            required
          />
          <label>Daglig grænse (1-25)</label>
          <input
            type="number"
            min={1}
            max={25}
            value={settings.daily_limit}
            onChange={handleChange('daily_limit')}
            required
          />
        </section>

        <section className="card">
          <h3 className="section-title">💬 Connection request besked</h3>
          <p className="section-sub">Brug {'{{navn}}'} og {'{{virksomhed}}'} i skabelonen.</p>
          <textarea
            rows={4}
            maxLength={300}
            value={settings.invitation_message}
            onChange={handleChange('invitation_message')}
            placeholder="Hej {{navn}}, ..."
            required
          />
          <div className={styles.metaRow}>
            <small>{settings.invitation_message.length}/300 tegn</small>
            <small>LinkedIn max 300</small>
          </div>
          <div className={styles.preview}>
            <p className={styles.previewLabel}>Preview</p>
            <p>{invitationPreview}</p>
          </div>
        </section>

        <section className="card">
          <div className={styles.rowBetween}>
            <div>
              <h3 className="section-title">🤖 AI opfølgnings DM</h3>
              <p className="section-sub">Vælg AI-genereret eller manuel besked efter accept.</p>
            </div>
            <div className={styles.toggleWrap}>
              <span>AI</span>
              <button
                type="button"
                className={styles.toggle}
                onClick={() =>
                  setSettings(prev => ({ ...prev, ai_enabled: prev.ai_enabled === 'true' ? 'false' : 'true' }))
                }
                aria-pressed={aiEnabled}
              >
                <span className={aiEnabled ? styles.knobOn : styles.knobOff} />
              </button>
            </div>
          </div>

          {aiEnabled ? (
            <>
              <label>Hvad sælger du? (liste)</label>
              <textarea
                rows={3}
                value={settings.ai_services}
                onChange={handleChange('ai_services')}
                placeholder="Ny hjemmeside/redesign, Automatiseringer, CRM system..."
              />
              <label>Kontekst om dig</label>
              <textarea
                rows={3}
                value={settings.ai_sender_context}
                onChange={handleChange('ai_sender_context')}
                placeholder="Tone of voice, cases, branchefokus"
              />
            </>
          ) : (
            <>
              <label>Manuel DM (brug {'{{navn}}'}, {'{{titel}}'}, {'{{virksomhed}}'})</label>
              <textarea
                rows={4}
                value={settings.manual_outreach_message}
                onChange={handleChange('manual_outreach_message')}
                placeholder="Hej {{navn}}, ..."
              />
              <div className={styles.preview}>
                <p className={styles.previewLabel}>Preview</p>
                <p>{manualPreview || 'Din besked vises her.'}</p>
              </div>
            </>
          )}
        </section>

        <section className="card">
          <h3 className="section-title">🔑 LinkedIn Session</h3>
          <p className="section-sub">Gem din li_at cookie for at køre Phantombuster.</p>
          <label>li_at</label>
          <input
            type="password"
            value={settings.linkedin_li_at}
            onChange={handleChange('linkedin_li_at')}
            placeholder="li_at=..."
          />
          <div className={styles.hint}>
            Hent fra Chrome → F12 → Application → Cookies → linkedin.com → li_at
          </div>
        </section>

        <section className="card">
          <h3 className="section-title">📧 Gmail integration</h3>
          <p className="section-sub">
            Forbind Gmail for at se vigtige emails på dashboardet. Kræver en Google Cloud OAuth 2.0 klient.
          </p>
          <label>Client ID</label>
          <input
            value={settings.gmail_client_id}
            onChange={handleChange('gmail_client_id')}
            placeholder="123456789-abc.apps.googleusercontent.com"
          />
          <label>Client Secret</label>
          <input
            type="password"
            value={settings.gmail_client_secret}
            onChange={handleChange('gmail_client_secret')}
            placeholder="GOCSPX-..."
          />
          <label>Refresh Token</label>
          <input
            type="password"
            value={settings.gmail_refresh_token}
            onChange={handleChange('gmail_refresh_token')}
            placeholder="1//0g..."
          />
          <div className={styles.hint}>
            Opret via Google Cloud Console → APIs & Services → Credentials → OAuth 2.0.
            Brug OAuth Playground til at generere refresh token med scope: gmail.readonly
          </div>
        </section>
      </div>
    </form>
  );
}
