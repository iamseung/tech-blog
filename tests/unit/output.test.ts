import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { verifyOutput } from '../../scripts/verify-output';
let dir: string;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
async function fixture(html: string) {
  dir = await mkdtemp(join(tmpdir(), 'blog-output-'));
  await mkdir(join(dir, 'tags', '한글'), { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(join(dir, 'tags', '한글', 'index.html'), '<h1 id="소개">태그</h1>');
}
it('resolves encoded Korean paths, base, fragments and static files', async () => {
  await fixture('<a href="/blog/tags/%ED%95%9C%EA%B8%80/#%EC%86%8C%EA%B0%9C">link</a><a href="https://example.com/blog/rss.xml">RSS</a><a href="https://external.example/missing/">external</a>');
  await writeFile(join(dir, 'rss.xml'), '<rss/>');
  await expect(verifyOutput(dir, '/blog/')).resolves.toBeUndefined();
});
it('reports missing targets, anchors, images and draft-only public assets', async () => {
  await fixture('<a href="/missing/">bad</a><a href="/tags/한글/#missing">anchor</a><img src="/missing.png">');
  await mkdir(join(dir, 'images', 'posts'), { recursive: true });
  await writeFile(join(dir, 'images', 'posts', 'draft-only.svg'), '<svg/>');
  await expect(verifyOutput(dir, '/')).rejects.toThrow(/missing[\s\S]*draft-only/);
});
