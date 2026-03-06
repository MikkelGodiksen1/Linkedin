const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_SECRET;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'anthropic/claude-3.5-sonnet';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_REFERRER = process.env.OPENROUTER_REFERRER ?? 'https://linkedin-rouge.vercel.app';

const BASE_SYSTEM = `Du er en dansk salgsprofessionel der skriver korte, autentiske LinkedIn DMs.

Regler:
- Max 3-4 sætninger
- Skriv som om du hurtigt taster på telefonen
- Lyder IKKE AI-genereret eller for poleret
- Slut altid med ét konkret spørgsmål
- Brug ikke emojis
- Vælg det mest relevante tilbud baseret på personens profil`;

export async function generateOutreachMessage(params: {
  name: string;
  title: string;
  company: string;
  recentPost?: string | null;
  services?: string;
  senderContext?: string;
}): Promise<string> {
  const { name, title, company, recentPost, services, senderContext } = params;

  const servicesList =
    (services || '').trim() ||
    'Ny hjemmeside/redesign, Automatiseringer, CRM system, LinkedIn ads, Meta ads';
  const servicesLines = servicesList
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `- ${s}`)
    .join('\n');

  const systemPrompt = `${BASE_SYSTEM}

Du sælger (vælg ét der giver mest mening for personen):
${servicesLines}
${senderContext ? `\nKontekst om dig/dit firma: ${senderContext}` : ''}`;

  const context = recentPost
    ? `De postede for nylig: "${recentPost}". Referér kort og naturligt til opslaget.`
    : 'De har ikke postet noget for nylig.';

  const userPrompt = `Skriv en personlig LinkedIn DM til ${name || 'personen'}${
    title ? `, der arbejder som ${title}` : ''
  }${company ? ` hos ${company}` : ''}. ${context}`;

  const aiResponse = await callOpenRouter(systemPrompt, userPrompt);
  if (aiResponse) return aiResponse;

  return fallbackMessage(name, company, servicesList);
}

async function callOpenRouter(system: string, user: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY missing; falling back to template message');
    return null;
  }

  try {
    const res = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_REFERRER,
        'X-Title': 'LinkedIn Automation',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenRouter error', res.status, errText);
      return null;
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    return text ?? null;
  } catch (err) {
    console.error('OpenRouter fetch error', err);
    return null;
  }
}

function fallbackMessage(name: string, company: string, servicesList: string): string {
  const firstService = servicesList.split(',').map(s => s.trim()).filter(Boolean)[0] ?? 'hjemmesider';
  return `Hej ${name || 'der'}! Fedt at connecte. Jeg hjælper virksomheder med ${firstService}. Hvad er jeres største digitale fokus i ${company || 'virksomheden'} lige nu?`;
}

// ─── Email klassificering ─────────────────────────────────────────────────────

export interface ImportantEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  reason: string; // hvorfor den er vigtig
}

/**
 * Bruger AI til at identificere vigtige emails fra dagens indbakke.
 * Returnerer kun dem der er markeret vigtige.
 */
export async function classifyImportantEmails(
  emails: { id: string; from: string; subject: string; snippet: string; date: string }[]
): Promise<ImportantEmail[]> {
  if (emails.length === 0) return [];

  const systemPrompt = `Du er en dansk forretningsassistent. Du skal gennemgå en liste af emails og finde de vigtige.

En email er vigtig hvis den:
- Er et svar fra en potentiel kunde eller lead
- Handler om et forretningstilbud, samarbejde eller kontrakt
- Er en kundehenvendelse eller support-spørgsmål der kræver handling
- Er urgent (deadline, betaling, juridisk)
- Er fra en partner, investor eller vigtig kontakt

Ignorer: nyhedsbreve, marketing-emails, notifikationer, automatiske bekræftelser.

Svar UDELUKKENDE med JSON array (ingen markdown, ingen forklaring):
[{"id":"...", "reason":"kort dansk begrundelse"}, ...]

Hvis ingen emails er vigtige, svar med: []`;

  const emailList = emails
    .map((e, i) => `${i + 1}. ID:${e.id} | Fra:${e.from} | Emne:${e.subject} | Preview:${e.snippet.slice(0, 120)}`)
    .join('\n');

  const userPrompt = `Emails fra i dag:\n${emailList}`;

  const raw = await callOpenRouter(systemPrompt, userPrompt);
  if (!raw) return [];

  try {
    // Fjern evt. markdown code blocks
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const classified = JSON.parse(cleaned) as { id: string; reason: string }[];

    if (!Array.isArray(classified)) return [];

    return classified.flatMap(c => {
      const email = emails.find(e => e.id === c.id);
      if (!email) return [];
      return [{ ...email, reason: c.reason }];
    });
  } catch {
    console.error('classifyImportantEmails: JSON parse fejl', raw);
    return [];
  }
}
