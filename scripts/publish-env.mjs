import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/** Read only deployment settings; explicit shell values win without mutating process.env. */
export function publishEnv() {
  const file = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
  return {
    SITE_URL: process.env.SITE_URL ?? file.SITE_URL,
    BASE_PATH: process.env.BASE_PATH ?? file.BASE_PATH,
  };
}
