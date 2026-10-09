import { cp, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { verifyOutput } from './verify-output.ts';

const output = 'dist-test';
async function inspect(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    assert(!path.includes('example-draft-hidden'), `초안 경로 노출: ${path}`);
    if (entry.isDirectory()) await inspect(path);
    else assert(!(await readFile(path)).includes(Buffer.from('PRIVATE_DRAFT_CANARY')), `초안 내용 노출: ${path}`);
  }
}
await inspect(output);
for (const name of ['search-index.json', 'rss.xml', 'sitemap.xml']) {
  const text = await readFile(join(output, name), 'utf8');
  assert(text.includes('example-markdown'), `공개 글 누락: ${name}`);
  assert(!text.includes('example-draft-hidden'), `초안 slug 노출: ${name}`);
}
console.log('실제 fixture 산출물: 공개 글 포함·초안 canary 제외 검증 완료');
const temporary = await mkdtemp(join(tmpdir(), 'blog-fixture-assets-'));
try {
  await cp(output, temporary, { recursive: true });
  await mkdir(join(temporary, 'images', 'posts'), { recursive: true });
  await writeFile(join(temporary, 'images', 'posts', 'draft-only.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await assert.rejects(verifyOutput(temporary, process.env.BASE_PATH ?? '/'), /참조하지 않는 이미지: images\/posts\/draft-only.svg/);
  console.log('실제 fixture 산출물: 초안 전용 이미지 발행 차단 검증 완료');
} finally { await rm(temporary, { recursive: true, force: true }); }
