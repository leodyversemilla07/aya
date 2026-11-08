import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const isPostgres = /^postgres(ql)?:\/\//i.test(databaseUrl);

export default defineConfig({
  schema: isPostgres ? 'prisma/schema.postgresql.prisma' : 'prisma/schema.prisma',
  migrations: {
    path: isPostgres ? 'prisma/migrations-postgresql' : 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  engine: 'classic',
  datasource: {
    // A local default keeps `prisma generate` working during installs where no
    // .env file exists yet. Real commands should set DATABASE_URL explicitly.
    url: databaseUrl,
  },
});
