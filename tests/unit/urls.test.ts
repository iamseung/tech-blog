import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it.each([
  ['/', '/', '/'],
  ['/tech-blog/', '/', '/tech-blog/'],
  ['/tech-blog/', '/posts/example/', '/tech-blog/posts/example/'],
  ['/tech-blog/', '/tech-blog/posts/example/', '/tech-blog/posts/example/'],
  ['/tech-blog/', '/images/한글 이미지.png', '/tech-blog/images/%ED%95%9C%EA%B8%80%20%EC%9D%B4%EB%AF%B8%EC%A7%80.png'],
])('base %s maps %s once', async (base, path, expected) => {
  vi.stubEnv('BASE_URL', base);
  const { withBase } = await import('../../src/lib/urls');
  expect(withBase(path)).toBe(expected);
});
it('post URL respects the configured base', async () => {
  vi.stubEnv('BASE_URL', '/tech-blog/');
  const { postUrl } = await import('../../src/lib/urls');
  expect(postUrl('example-markdown')).toBe('/tech-blog/posts/example-markdown/');
});
