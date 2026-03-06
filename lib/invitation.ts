export function buildInvitation(template: string, lead: { name: string; company: string; title: string }): string {
  const trimmedTemplate = template.slice(0, 300); // LinkedIn limit
  return trimmedTemplate
    .replace(/{{\s*navn\s*}}/gi, lead.name || 'der')
    .replace(/{{\s*virksomhed\s*}}/gi, lead.company || '')
    .replace(/{{\s*titel\s*}}/gi, lead.title || '');
}
