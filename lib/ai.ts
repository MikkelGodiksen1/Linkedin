import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const servicesList = (services || '').trim() || 'Ny hjemmeside/redesign, Automatiseringer, CRM system, LinkedIn ads, Meta ads';
  const servicesLines = servicesList.split(',').map(s => s.trim()).filter(Boolean).map(s => `- ${s}`).join('\n');

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

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type === 'text' && content.text) {
      return content.text;
    }
  } catch (err) {
    console.error('Claude API error:', err);
  }

  return fallbackMessage(name, company, servicesList);
}

function fallbackMessage(name: string, company: string, servicesList: string): string {
  const firstService = servicesList.split(',').map(s => s.trim()).filter(Boolean)[0] ?? 'hjemmesider';
  return `Hej ${name || 'der'}! Fedt at connecte. Jeg hjælper virksomheder med ${firstService}. Hvad er jeres største digitale fokus i ${company || 'virksomheden'} lige nu?`;
}
