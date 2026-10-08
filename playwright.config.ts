import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'subpath.spec.ts',
  use: { baseURL: 'http://127.0.0.1:4323', browserName: 'chromium' },
  webServer: { command: 'npm run build:test && npm run preview -- --outDir dist-test --host 127.0.0.1 --port 4323 --ignore-lock', url: 'http://127.0.0.1:4323/posts/example-markdown/', reuseExistingServer: false },
});
