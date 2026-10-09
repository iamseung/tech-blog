export interface SearchDocument { slug: string; title: string; description: string; tags: string[]; text: string; url: string; }
function normalize(text: string): string { return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
export function searchPosts(docs: SearchDocument[], query: string): SearchDocument[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  return docs.filter(doc => { const text = normalize([doc.title, doc.description, ...doc.tags, doc.text].join(' ')); return tokens.every(token => text.includes(token)); });
}
