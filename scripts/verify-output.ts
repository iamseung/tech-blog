import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}
function walk(node: Node, callback: (node: DefaultTreeAdapterMap['element']) => void) {
  if ('tagName' in node) callback(node);
  if ('childNodes' in node) for (const child of node.childNodes) walk(child, callback);
}
export async function verifyOutput(distDir: string, base: string): Promise<void> {
  const root = resolve(distDir);
  const files = await filesUnder(root);
  const available = new Set(files);
  const prefix = `/${base.split('/').filter(Boolean).join('/')}`;
  const origin = new URL(process.env.SITE_URL ?? 'https://example.com').origin;
  const errors: string[] = [];
  const publicArticleAssets = new Set<string>();
  const manifest = join(root, 'public-assets.json');
  if (available.has(manifest)) {
    const entries: unknown = JSON.parse(await readFile(manifest, 'utf8'));
    if (!Array.isArray(entries) || !entries.every(value => typeof value === 'string')) throw new Error('공개 글 이미지 manifest 형식 오류');
    for (const url of entries as string[]) {
      const pathname = decodeURIComponent(new URL(url, origin).pathname);
      const assetPath = prefix === '/' ? pathname : pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : '';
      if (!assetPath.startsWith('/images/posts/')) throw new Error(`공개 글 이미지 manifest 경로 오류: ${url}`);
      const target = resolve(root, `.${assetPath}`);
      if (!target.startsWith(`${join(root, 'images', 'posts')}${sep}`)) throw new Error(`공개 글 이미지 manifest 경로 오류: ${url}`);
      if (!available.has(target)) errors.push(`공개 글 이미지 없음: ${url}`);
      publicArticleAssets.add(target);
    }
  }
  const ids = new Map<string, Set<string>>();
  const references: { file: string; url: string }[] = [];
  for (const file of files.filter(path => path.endsWith('.html'))) {
    const anchors = new Set<string>();
    walk(parse(await readFile(file, 'utf8')), node => {
      for (const attr of node.attrs) {
        if (attr.name === 'id' || (node.tagName === 'a' && attr.name === 'name')) anchors.add(attr.value);
        if (['href', 'src', 'poster'].includes(attr.name)) references.push({ file, url: attr.value });
        if (attr.name === 'srcset') for (const candidate of attr.value.split(',')) references.push({ file, url: candidate.trim().split(/\s+/)[0] });
      }
    });
    ids.set(file, anchors);
  }
  for (const { file, url } of references) {
    if (!url || /^(?:data|mailto|tel|javascript):/i.test(url)) continue;
    try {
      const pagePath = relative(root, file).split(sep).join('/').replace(/index\.html$/, '');
      const pageUrl = `${origin}${prefix === '/' ? '/' : `${prefix}/`}${pagePath}`;
      const targetUrl = new URL(url, pageUrl);
      if (targetUrl.origin !== origin) continue;
      let pathname = decodeURIComponent(targetUrl.pathname);
      if (prefix !== '/') {
        if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) throw new Error('base 밖의 내부 경로');
        pathname = pathname.slice(prefix.length);
      }
      const path = resolve(root, `.${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
      if (path !== root && !path.startsWith(`${root}${sep}`)) throw new Error('출력 폴더 밖의 경로');
      const target = available.has(path) ? path : join(path, 'index.html');
      if (!available.has(target)) throw new Error('대상 파일 없음');
      if (targetUrl.hash && ids.has(target) && !ids.get(target)!.has(decodeURIComponent(targetUrl.hash.slice(1)))) throw new Error('앵커 없음');
    } catch (error) { errors.push(`${relative(root, file)}: ${url} (${(error as Error).message})`); }
  }
  const postAssets = join(root, 'images', 'posts') + sep;
  for (const file of files) if (file.startsWith(postAssets) && !publicArticleAssets.has(file)) errors.push(`공개 글이 참조하지 않는 이미지: ${relative(root, file)}`);
  if (errors.length) throw new Error(`발행 산출물 검증 실패:\n${errors.join('\n')}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist';
  await stat(dir);
  await verifyOutput(dir, process.env.BASE_PATH ?? '/');
  console.log(`발행 산출물 검증 완료: ${dir}`);
}
