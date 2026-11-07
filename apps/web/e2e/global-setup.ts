import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

export default function globalSetup(): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: 'file:./playwright.db',
    NODE_ENV: 'test',
    SEED_FORCE: 'true',
  };

  console.log('Preparing the Playwright database...');
  execSync('pnpm --filter @workspace/db run migrate:deploy', {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  execSync('pnpm --filter @workspace/db run seed', {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
}
