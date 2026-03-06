/**
 * Gmail API client.
 *
 * Bruger OAuth2 (refresh token flow) til at hente dagens emails
 * uden ekstra npm-pakker.
 */

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail OAuth fejl (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Ingen access_token i OAuth svar');
  return data.access_token;
}

/**
 * Henter alle emails modtaget i dag (maks 30).
 */
export async function getTodaysEmails(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<EmailSummary[]> {
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

  // Gmail query: emails fra og med midnat i dag
  const today = new Date();
  const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;

  const listRes = await fetch(
    `${GMAIL_API_BASE}/users/me/messages?q=after:${dateStr}&maxResults=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Gmail list-fejl (${listRes.status}): ${errText}`);
  }

  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const messages = listData.messages ?? [];

  const emails: EmailSummary[] = [];

  for (const msg of messages.slice(0, 30)) {
    const msgRes = await fetch(
      `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata` +
        `&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!msgRes.ok) continue;

    const msgData = (await msgRes.json()) as {
      snippet?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };

    const headers = msgData.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    emails.push({
      id: msg.id,
      from: getHeader('From'),
      subject: getHeader('Subject') || '(ingen emne)',
      snippet: msgData.snippet ?? '',
      date: getHeader('Date'),
    });
  }

  return emails;
}
