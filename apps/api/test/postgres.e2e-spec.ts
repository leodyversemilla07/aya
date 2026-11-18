import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prisma } from '@workspace/db';

const dbRoot = resolve(__dirname, '../../../packages/db');

describe('PostgreSQL compatibility', () => {
  it('keeps the generated schema and migrations aligned for conversation ownership', async () => {
    const schema = await readFile(resolve(dbRoot, 'prisma/schema.postgresql.prisma'), 'utf8');
    const migration = await readFile(
      resolve(
        dbRoot,
        'prisma/migrations-postgresql/20261118000000_add_conversation_access_subject/migration.sql',
      ),
      'utf8',
    );

    expect(schema).toContain('accessSubject String?');
    expect(schema).toContain('@@index([accessSubject])');
    expect(migration).toContain('ALTER TABLE "Conversation" ADD COLUMN "accessSubject" TEXT');
    expect(migration).toContain('Conversation_accessSubject_idx');
  });

  const postgresUrl = process.env.POSTGRES_TEST_DATABASE_URL;
  (postgresUrl ? it : it.skip)('runs a PostgreSQL query and ownership round trip', async () => {
    const subject = `postgres-test:${Date.now()}`;

    try {
      await expect(prisma.$queryRaw`SELECT 1`).resolves.toBeTruthy();
      const conversation = await prisma.conversation.create({
        data: { title: 'PostgreSQL compatibility test', accessSubject: subject },
      });
      const found = await prisma.conversation.findFirst({ where: { accessSubject: subject } });
      expect(found?.id).toBe(conversation.id);
      await prisma.conversation.delete({ where: { id: conversation.id } });
    } finally {
      await prisma.$disconnect();
    }
  });
});
