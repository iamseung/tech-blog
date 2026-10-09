import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkMarkdownPolicy } from './src/lib/markdown-policy.ts';
import { remarkBaseUrls } from './src/lib/markdown-urls.ts';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

// Astro consumes a config object (not Vite's config callback). Read the explicit CLI mode.
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex === -1 ? process.argv.find((argument) => argument.startsWith('--mode='))?.slice(7) : process.argv[modeIndex + 1];
const base = process.env.BASE_PATH ?? '/';
if (base !== '/' && !/^\/[a-zA-Z0-9_-]+\/$/.test(base)) throw new Error('BASE_PATH는 / 또는 /repo-name/ 형식이어야 합니다.');
if (mode === 'demo' && process.argv[2] !== 'dev') throw new Error('예시 모드는 개발 서버에서만 사용할 수 있습니다.');
const building = process.argv[2] === 'build';
const site = process.env.SITE_URL || (building ? '' : 'http://localhost:4321');
let origin;
try { origin = new URL(site); } catch { throw new Error('SITE_URL에 protocol과 host를 포함한 공개 origin을 설정하세요.'); }
if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
    (building && mode !== 'test' && (origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost') || origin.hostname === '[::1]' || /^127\./.test(origin.hostname)))) {
    throw new Error('SITE_URL은 경로·인증정보 없는 공개 HTTP(S) origin이어야 합니다.');
}

export default defineConfig({
    site: origin.origin,
    base,
    publicDir: mode === 'test' || mode === 'demo' ? './tests/fixtures/public' : './public',
    devToolbar: { enabled: false },
    output: 'static',
    outDir: mode === 'test' ? './dist-test' : './dist',
    cacheDir: mode === 'test' ? './.astro-test' : mode === 'demo' ? './.astro-demo' : './.astro',
    markdown: { processor: unified({ remarkPlugins: [remarkMarkdownPolicy, [remarkBaseUrls, { base }]] }), syntaxHighlight: 'shiki', shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } },
});
