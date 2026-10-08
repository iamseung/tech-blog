import { expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Root } from 'mdast';
import { remarkBaseUrls } from '../../src/lib/markdown-urls';

it('rewrites root image and page links exactly once while preserving external URLs and fragments', async () => {
  const processor = unified().use(remarkParse).use(remarkBaseUrls, { base: '/tech-blog/' });
  const tree = await processor.run(processor.parse('![예시](</images/posts/example-markdown/한글 이미지.svg>)\n\n[글](/posts/example-markdown/#코드-예시) [이미 적용](/tech-blog/posts/example-markdown/) [외부](https://example.com/a) [앵커](#코드-예시) [상대](../example/) [프로토콜](//example.com/a)'));
  const urls: string[] = [];
  const collect = (node: { url?: string; children?: unknown[] }) => {
    if (node.url) urls.push(node.url);
    node.children?.forEach((child) => collect(child as typeof node));
  };
  collect(tree as Root);
  expect(urls).toEqual(['/tech-blog/images/posts/example-markdown/%ED%95%9C%EA%B8%80%20%EC%9D%B4%EB%AF%B8%EC%A7%80.svg', '/tech-blog/posts/example-markdown/#%EC%BD%94%EB%93%9C-%EC%98%88%EC%8B%9C', '/tech-blog/posts/example-markdown/', 'https://example.com/a', '#코드-예시', '../example/', '//example.com/a']);
});
