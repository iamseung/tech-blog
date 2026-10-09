import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root, RootContent } from 'mdast';

const blockTypes = new Set(['paragraph', 'heading', 'code', 'blockquote', 'list', 'listItem', 'table', 'tableRow', 'tableCell', 'thematicBreak']);
export function markdownText(markdown: string): string {
  const tree = unified().use(remarkParse).parse(markdown);
  function text(node: Root | RootContent): string {
    if (node.type === 'html' || node.type === 'definition') return '';
    const value = 'value' in node ? node.value : 'alt' in node ? node.alt ?? '' : 'children' in node ? node.children.map(child => text(child)).join('') : '';
    return value + (blockTypes.has(node.type) ? '\n' : '');
  }
  return text(tree).replace(/\s+/g, ' ').trim();
}
export function markdownImageUrls(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, string>();
  const images: string[] = [];
  function visit(node: Root | RootContent, callback: (node: Root | RootContent) => void): void {
    callback(node);
    if ('children' in node) for (const child of node.children) visit(child, callback);
  }
  visit(tree, node => { if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url); });
  visit(tree, node => {
    if (node.type === 'image') images.push(node.url);
    if (node.type === 'imageReference') { const url = definitions.get(node.identifier); if (url) images.push(url); }
  });
  return images;
}
