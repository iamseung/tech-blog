import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkMarkdownPolicy } from './src/lib/markdown-policy.ts';
import { remarkBaseUrls } from './src/lib/markdown-urls.ts';

// Astro consumes a config object (not Vite's config callback). Read the explicit CLI mode.
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex === -1 ? process.argv.find((argument) => argument.startsWith('--mode='))?.slice(7) : process.argv[modeIndex + 1];
const base = process.env.BASE_PATH ?? '/';
if (mode === 'demo' && process.argv[2] !== 'dev') throw new Error('예시 모드는 개발 서버에서만 사용할 수 있습니다.');

export default defineConfig({
    site: process.env.SITE_URL ?? 'https://example.com',
    base,
    publicDir: mode === 'test' || mode === 'demo' ? './tests/fixtures/public' : './public',
    devToolbar: { enabled: false },
    output: 'static',
    outDir: mode === 'test' ? './dist-test' : './dist',
    cacheDir: mode === 'test' ? './.astro-test' : mode === 'demo' ? './.astro-demo' : './.astro',
    markdown: { processor: unified({ remarkPlugins: [remarkMarkdownPolicy, [remarkBaseUrls, { base }]] }), syntaxHighlight: 'shiki', shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } },
});
