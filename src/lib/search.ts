import { unified } from 'unified';
import remarkParse from 'remark-parse';

export interface SearchDocument { slug: string; title: string; description: string; tags: string[]; text: string; url: string; }
function normalize(text: string): string { return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
export function searchPosts(docs: SearchDocument[], query: string): SearchDocument[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  return docs.filter(doc => { const text = normalize([doc.title, doc.description, ...doc.tags, doc.text].join(' ')); return tokens.every(token => text.includes(token)); });
}
export function markdownText(markdown: string): string {
  const tree = unified().use(remarkParse).parse(markdown);
  const values: string[] = [];
  function visit(node: { type: string; value?: string; alt?: string | null; children?: unknown[] }) {
    if (['text', 'inlineCode', 'code'].includes(node.type) && node.value) values.push(node.value);
    if (node.type === 'image' && node.alt) values.push(node.alt);
    for (const child of node.children ?? []) visit(child as Parameters<typeof visit>[0]);
  }
  visit(tree);
  return values.join(' ').replace(/\s+/g, ' ').trim();
}
