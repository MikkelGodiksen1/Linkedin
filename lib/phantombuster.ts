/**
 * Phantombuster API client.
 *
 * Styrer 3 LinkedIn Phantoms:
 * 1. LinkedIn Search Export   → finder nye leads
 * 2. LinkedIn Network Booster → sender connection requests
 * 3. LinkedIn Message Sender  → sender DMs til connections
 *
 * Alle kald er async (launch nu → harvest næste dag).
 */

const PB_API_BASE = 'https://api.phantombuster.com/api';

function pbHeaders() {
  return {
    'X-Phantombuster-Key': process.env.PHANTOMBUSTER_API_KEY!,
    'Content-Type': 'application/json',
  };
}

// ─── Generiske helpers ────────────────────────────────────────────────────────

async function launchAgent(agentId: string, argument: object): Promise<{ containerId?: string }> {
  const url = new URL(`${PB_API_BASE}/v1/agent/${agentId}/launch`);
  url.searchParams.set('argument', JSON.stringify(argument));

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: pbHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Phantombuster launch failed (agent ${agentId}):`, res.status, text);
    return {};
  }

  const data = await res.json();
  return { containerId: data.containerId ?? data.data?.containerId };
}

async function fetchOutput(agentId: string): Promise<unknown> {
  const res = await fetch(
    `${PB_API_BASE}/v2/agents/fetch-output?id=${agentId}`,
    { headers: pbHeaders() }
  );

  if (!res.ok) {
    console.error(`Phantombuster fetch-output failed (agent ${agentId}):`, res.status);
    return null;
  }

  return res.json();
}

// ─── Lead typer ───────────────────────────────────────────────────────────────

export interface SearchLead {
  linkedin_url: string;
  name?: string;
  company?: string;
  title?: string;
}

export interface ConnectionResult {
  linkedin_url: string;
  status: 'sent' | 'already_connected' | 'error';
}

export interface MessageResult {
  linkedin_url: string;
  success: boolean;
}

// ─── LinkedIn Search Export ───────────────────────────────────────────────────

/**
 * Starter LinkedIn Search Export phantom.
 * Resultater hentes i harvestSearchResults() næste dag.
 */
export async function launchSearchExport(keywords: string, location: string): Promise<void> {
  const agentId = process.env.PHANTOM_SEARCH_EXPORT_ID!;
  await launchAgent(agentId, {
    sessionCookie: process.env.LINKEDIN_LI_AT,
    search: keywords,
    location,
    numberOfProfiles: 20,
    csvName: 'search-results',
  });
}

/**
 * Henter output fra seneste Search Export kørsel.
 * Returnerer en liste af leads klar til at indsætte i DB.
 */
export async function harvestSearchResults(): Promise<SearchLead[]> {
  const agentId = process.env.PHANTOM_SEARCH_EXPORT_ID!;
  const data = await fetchOutput(agentId) as Record<string, unknown> | null;
  if (!data) return [];

  // Phantombuster returnerer resultater i resultObject eller output CSV
  const items: unknown[] = (data.resultObject as unknown[]) ?? (data.data as unknown[]) ?? [];
  return items
    .map((item: unknown) => {
      const i = item as Record<string, unknown>;
      return {
        linkedin_url: (i.linkedInUrl ?? i.linkedinUrl ?? i.profileUrl ?? '') as string,
        name: (i.fullName ?? i.name ?? '') as string,
        company: (i.company ?? i.currentCompany ?? '') as string,
        title: (i.title ?? i.headline ?? '') as string,
      };
    })
    .filter(l => l.linkedin_url.startsWith('http'));
}

// ─── LinkedIn Network Booster ─────────────────────────────────────────────────

/**
 * Starter LinkedIn Network Booster phantom med en liste af profiler.
 * Resultater hentes i harvestNetworkBoosterResults() næste dag.
 */
export async function launchNetworkBooster(
  leads: { linkedin_url: string; name: string; company: string }[]
): Promise<void> {
  const agentId = process.env.PHANTOM_NETWORK_BOOSTER_ID!;

  // Phantombuster Network Booster tager en CSV-kompatibel liste
  const spreadsheetData = leads.map(l => ({
    linkedInUrl: l.linkedin_url,
    message: `Hej ${l.name || 'der'}, jeg arbejder med hjemmesider, automatiseringer og LinkedIn/Meta ads. Ville være godt at connecte${l.company ? ` og høre mere om ${l.company}` : ''}!`,
  }));

  await launchAgent(agentId, {
    sessionCookie: process.env.LINKEDIN_LI_AT,
    spreadsheet: spreadsheetData,
    numberOfAddsPerLaunch: leads.length,
    waitDuration: 30, // sekunder mellem connection requests
    csvName: 'network-booster-results',
  });
}

/**
 * Henter output fra seneste Network Booster kørsel.
 */
export async function harvestNetworkBoosterResults(): Promise<ConnectionResult[]> {
  const agentId = process.env.PHANTOM_NETWORK_BOOSTER_ID!;
  const data = await fetchOutput(agentId) as Record<string, unknown> | null;
  if (!data) return [];

  const items: unknown[] = (data.resultObject as unknown[]) ?? (data.data as unknown[]) ?? [];
  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const url = (i.linkedInUrl ?? i.linkedinUrl ?? i.profileUrl ?? '') as string;
    const error = i.error ?? i.message ?? '';
    const status: ConnectionResult['status'] =
      i.alreadyConnected ? 'already_connected' :
      error ? 'error' :
      'sent';
    return { linkedin_url: url, status };
  });
}

// ─── LinkedIn Message Sender ──────────────────────────────────────────────────

/**
 * Starter LinkedIn Message Sender phantom med personaliserede beskeder.
 * Resultater hentes i harvestMessageSenderResults() næste dag.
 *
 * VIGTIGT: Message Sender sender kun til 1st-degree connections.
 * Fejlede beskeder = person har ikke accepteret endnu (stadig pending).
 */
export async function launchMessageSender(
  leads: { linkedin_url: string; message: string }[]
): Promise<void> {
  const agentId = process.env.PHANTOM_MESSAGE_SENDER_ID!;

  const spreadsheetData = leads.map(l => ({
    linkedInUrl: l.linkedin_url,
    message: l.message,
  }));

  await launchAgent(agentId, {
    sessionCookie: process.env.LINKEDIN_LI_AT,
    spreadsheet: spreadsheetData,
    sendOnlyIfNoPreviousMessages: true, // undgå dobbelt-besked
    csvName: 'message-sender-results',
  });
}

/**
 * Henter output fra seneste Message Sender kørsel.
 * success: true  → personen er connected og fik beskeden → mark as accepted
 * success: false → ikke connected endnu → leave as pending
 */
export async function harvestMessageSenderResults(): Promise<MessageResult[]> {
  const agentId = process.env.PHANTOM_MESSAGE_SENDER_ID!;
  const data = await fetchOutput(agentId) as Record<string, unknown> | null;
  if (!data) return [];

  const items: unknown[] = (data.resultObject as unknown[]) ?? (data.data as unknown[]) ?? [];
  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    const url = (i.linkedInUrl ?? i.linkedinUrl ?? i.profileUrl ?? '') as string;
    const success = !i.error && (i.messageSent === true || i.status === 'Message sent');
    return { linkedin_url: url, success };
  });
}
