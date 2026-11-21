import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { prisma } from '@workspace/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { requestIdMiddleware } from './../src/observability/request-logger';

describe('Administration and audit history (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = Date.now().toString(36);
  const userId = `admin-e2e-user-${suffix}`;
  let clientId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(requestIdMiddleware);
    await app.init();
  });

  afterAll(async () => {
    if (clientId) {
      await request(app.getHttpServer())
        .delete(`/clients/${clientId}`)
        .set('x-api-key', 'test-api-key');
    }
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await app.close();
  });

  it('lists users and changes a workspace role', async () => {
    await prisma.user.create({
      data: {
        id: userId,
        name: 'Admin E2E User',
        email: `admin-e2e-${suffix}@example.com`,
        role: 'viewer',
      },
    });

    const users = await request(app.getHttpServer())
      .get('/admin/users')
      .query({ search: `admin-e2e-${suffix}@example.com` })
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(users.body.items).toHaveLength(1);
    expect(users.body.items[0]).toMatchObject({ id: userId, role: 'viewer' });

    const updated = await request(app.getHttpServer())
      .patch(`/admin/users/${userId}/role`)
      .set('x-api-key', 'test-api-key')
      .send({ role: 'manager' })
      .expect(200);
    expect(updated.body).toMatchObject({ id: userId, role: 'manager' });

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .query({ entityType: 'user', entityId: userId })
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({
      action: 'update',
      entityType: 'user',
      entityId: userId,
    });
    expect(audit.body.items[0].before).toMatchObject({ role: 'viewer' });
    expect(audit.body.items[0].after).toMatchObject({ role: 'manager' });
  });

  it('records management mutations in the audit log', async () => {
    const requestId = `audit-e2e-${suffix}`;
    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('x-api-key', 'test-api-key')
      .set('x-request-id', requestId)
      .send({ name: `Audit Client ${suffix}`, industry: 'audit' })
      .expect(201);
    clientId = client.body.id;

    const audit = await request(app.getHttpServer())
      .get('/admin/audit-logs')
      .query({ entityType: 'client', entityId: clientId })
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(audit.body.items).toHaveLength(1);
    expect(audit.body.items[0]).toMatchObject({
      action: 'create',
      entityType: 'client',
      entityId: clientId,
      actorType: 'api-key',
      requestId,
    });
    expect(audit.body.items[0].after).toMatchObject({
      name: `Audit Client ${suffix}`,
      industry: 'audit',
    });
  });
});
