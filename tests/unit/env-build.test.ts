import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { expect, it } from 'vitest';

// A real isolated checkout catches disagreement between Astro and the later validator process.
it.each([
  { name: '.env-only root', base: '/', site: 'https://env-only.example', shell: false },
  { name: '.env-only subpath', base: '/tech-blog/', site: 'https://env-only.example', shell: false },
  { name: 'shell overrides .env', base: '/', site: 'https://shell.example', shell: true },
])('builds with $name deployment configuration', ({ base, site, shell }) => {
  const repository = resolve('.');
  const temporary = mkdtempSync(join(tmpdir(), 'blog-env-build-'));
  const environment = { ...process.env };
  delete environment.SITE_URL;
  delete environment.BASE_PATH;
  delete environment.BASE_URL;
  delete environment.NODE_ENV;
  delete environment.MODE;
  delete environment.VITEST;
  try {
    const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const file of tracked) {
      mkdirSync(dirname(join(temporary, file)), { recursive: true });
      cpSync(join(repository, file), join(temporary, file));
    }
    symlinkSync(join(repository, 'node_modules'), join(temporary, 'node_modules'), 'dir');
    writeFileSync(join(temporary, '.env'), `SITE_URL=https://env-only.example\nBASE_PATH=${shell ? '/wrong-base/' : base}\nPRIVATE_ENV_CANARY=DO_NOT_PUBLISH_THIS\n`);
    if (shell) { environment.SITE_URL = site; environment.BASE_PATH = base; }
    const build = spawnSync('npm', ['run', 'build'], { cwd: temporary, env: environment, encoding: 'utf8' });
    expect(build.status, build.stdout + build.stderr).toBe(0);
    expect(readFileSync(join(temporary, 'dist', 'index.html'), 'utf8')).toContain(`${site}${base}`);
    function inspect(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) inspect(path);
        else {
          const contents = readFileSync(path, 'utf8');
          expect(contents).not.toContain('DO_NOT_PUBLISH_THIS');
          expect(contents).not.toContain('PRIVATE_DRAFT_CANARY');
          expect(contents).not.toContain('example-markdown');
        }
      }
    }
    inspect(join(temporary, 'dist'));
    // Absolute same-origin URLs must be checked using the .env SITE_URL too.
    writeFileSync(join(temporary, 'dist', 'index.html'), `<a href="${site}${base}missing/">missing</a>`);
    const verify = spawnSync(join(repository, 'node_modules/node/bin/node'), ['--experimental-strip-types', join(repository, 'scripts/verify-output.ts'), 'dist'], { cwd: temporary, env: environment, encoding: 'utf8' });
    expect(verify.status, verify.stdout + verify.stderr).not.toBe(0);
    expect(verify.stderr).toContain('대상 파일 없음');
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}, 60000);

it('reads deployment settings without importing unrelated .env values into process.env', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'blog-env-isolation-'));
  try {
    writeFileSync(join(temporary, '.env'), 'SITE_URL=https://env-only.example\nBASE_PATH=/tech-blog/\nPRIVATE_ENV_CANARY=DO_NOT_PUBLISH_THIS\n');
    const environment = { ...process.env };
    delete environment.SITE_URL;
    delete environment.BASE_PATH;
    delete environment.PRIVATE_ENV_CANARY;
    const result = execFileSync(resolve('node_modules/node/bin/node'), ['--input-type=module', '-e', `import { publishEnv } from ${JSON.stringify(new URL(`file://${resolve('scripts/publish-env.mjs')}`).href)}; console.log(JSON.stringify({settings:publishEnv(), leaked:process.env.PRIVATE_ENV_CANARY, site:process.env.SITE_URL}));`], { cwd: temporary, env: environment, encoding: 'utf8' });
    expect(JSON.parse(result)).toEqual({ settings: { SITE_URL: 'https://env-only.example', BASE_PATH: '/tech-blog/' } });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
