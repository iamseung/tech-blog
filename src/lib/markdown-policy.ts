import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root } from 'mdast';
import { isPostImagePath } from './post-schema';

export function validateMarkdown(source: string, slug?: string): void {
  const tree = unified().use(remarkParse).parse(source);
  validateMarkdownTree(tree, slug);
}

export function validateMarkdownTree(tree: Root, slug?: string): void {
  type PolicyNode = { type: string; value?: string; alt?: string | null; title?: string | null; url?: string; identifier?: string; children?: PolicyNode[] };
  const definitions = new Map<string, string>();
  function collectDefinitions(node: PolicyNode): void {
    if (node.type === 'definition' && node.identifier && node.url && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
    for (const child of node.children ?? []) collectDefinitions(child);
  }
  collectDefinitions(tree);
  function walk(node: PolicyNode): string {
    if (node.type === 'code' || node.type === 'inlineCode') return '\0';
    if (node.type === 'html') throw new Error('공개 글에 원시 HTML을 사용할 수 없습니다.');
    if (node.type === 'image' || node.type === 'imageReference') {
      const src = node.url ?? definitions.get(node.identifier ?? '');
      if (!slug || !src || !isPostImagePath(src, slug) || !node.alt?.trim()) {
        throw new Error('본문 이미지는 /images/posts/<slug>/ 경로와 대체 텍스트가 필요합니다.');
      }
    }
    const text = node.value ?? node.children?.map(walk).join('') ?? '';
    if ([text, node.alt, node.title, node.url].some((value) => value && /\[\[[\s\S]*?\]\]/.test(value))) {
      throw new Error('비공개 위키링크를 공개 링크나 일반 텍스트로 바꾸세요.');
    }
    return text;
  }
  walk(tree);
}

export function remarkMarkdownPolicy() {
  return (tree: Root, file: { data: { astro?: { frontmatter?: Record<string, unknown> } } }) => {
    const slug = file.data.astro?.frontmatter?.slug;
    validateMarkdownTree(tree, typeof slug === 'string' ? slug : undefined);
  };
}
