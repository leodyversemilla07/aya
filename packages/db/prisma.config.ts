import 'dotenv/config';

import { defineConfig } from 'prisma/config';

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
