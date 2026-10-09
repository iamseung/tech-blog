import { afterEach, expect, it, vi } from 'vitest';

const originalArgv = [...process.argv];
afterEach(() => { process.argv = originalArgv; vi.unstubAllEnvs(); vi.resetModules(); });
async function config(command: string, site?: string, mode?: string, base = '/') {
  process.argv = ['node', 'astro', command, ...(mode ? ['--mode', mode] : [])];
  vi.stubEnv('SITE_URL', site ?? '');
  vi.stubEnv('BASE_PATH', base);
  return (await import('../../astro.config.mjs')).default;
}
it('requires an explicit origin for production builds', async () => {
  await expect(config('build')).rejects.toThrow(/SITE_URL/);
});
it.each(['not-a-url', 'https://example.com/blog/', 'https://user:pass@example.com', 'https://example.com?x=1', 'ftp://example.com', 'http://localhost:4321', 'https://127.0.0.1'])('rejects invalid public origin %s', async (site) => {
  await expect(config('build', site)).rejects.toThrow(/SITE_URL/);
});
it('accepts public origins and repository base independently', async () => {
  const result = await config('build', 'https://writer.github.io', undefined, '/tech-blog/');
  expect(result.site).toBe('https://writer.github.io');
  expect(result.base).toBe('/tech-blog/');
});
it('uses localhost for development and explicit test origin for fixtures', async () => {
  expect((await config('dev')).site).toBe('http://localhost:4321');
  vi.resetModules();
  expect((await config('build', 'https://example.com', 'test')).site).toBe('https://example.com');
});
it.each(['tech-blog', '/tech-blog', '//tech-blog/', '/tech blog/', '/a/../'])('rejects malformed base %s', async (base) => {
  await expect(config('build', 'https://example.com', undefined, base)).rejects.toThrow(/BASE_PATH/);
});
