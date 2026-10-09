import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'subpath.spec.ts',
  use: { baseURL: 'http://127.0.0.1:4324', browserName: 'chromium' },
  webServer: { command: 'npm run build:test && npm run preview -- --outDir dist-test --host 127.0.0.1 --port 4324 --ignore-lock', env: { SITE_URL: 'https://example.com', BASE_PATH: '/tech-blog/' }, url: 'http://127.0.0.1:4324/tech-blog/posts/example-markdown/', reuseExistingServer: false },
});
