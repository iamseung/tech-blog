import type { Root, RootContent } from 'mdast';
import { withBase } from './urls';

/** Runs after Markdown policy validation, while URLs still retain their public source convention. */
export function remarkBaseUrls(options: { base: string }) {
  return (tree: Root): void => {
    const visit = (node: Root | RootContent): void => {
      if ((node.type === 'image' || node.type === 'link' || node.type === 'definition') && node.url.startsWith('/') && !node.url.startsWith('//')) {
        node.url = withBase(node.url, options.base);
      }
      if ('children' in node) node.children.forEach(visit);
    };
    visit(tree);
  };
}
