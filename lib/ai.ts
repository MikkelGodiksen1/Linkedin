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
