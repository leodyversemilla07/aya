import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  engine: 'classic',
  datasource: {
    // A local default keeps `prisma generate` working during installs where no
    // .env file exists yet. Real commands should set DATABASE_URL explicitly.
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
});
