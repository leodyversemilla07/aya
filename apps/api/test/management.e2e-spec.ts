import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type Ids = { clientId?: string; developerId?: string; contractId?: string };

describe('Management CRUD (e2e)', () => {
  let app: INestApplication<App>;
  const ids: Ids = {};
  const suffix = Date.now().toString(36);
  const clientName = `E2E Client ${suffix}`;
  const developerEmail = `e2e-${suffix}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (ids.developerId) {
      await request(app.getHttpServer())
        .delete(`/developers/${ids.developerId}`)
        .set('x-api-key', 'test-api-key');
    }
    if (ids.clientId) {
      await request(app.getHttpServer())
        .delete(`/clients/${ids.clientId}`)
        .set('x-api-key', 'test-api-key');
    }
    await app.close();
  });

  it('rejects unauthenticated management requests', async () => {
    await request(app.getHttpServer()).get('/developers').expect(401);
    await request(app.getHttpServer()).get('/clients').expect(401);
  });

  it('creates a client with contacts and rejects duplicate names', async () => {
    const created = await request(app.getHttpServer())
      .post('/clients')
      .set('x-api-key', 'test-api-key')
      .send({
        name: clientName,
        industry: 'e2e',
        contacts: [
          { name: 'Primary Contact', role: 'CTO', email: `contact-${suffix}@example.com` },
        ],
      })
      .expect(201);

    ids.clientId = created.body.id;
    expect(created.body).toMatchObject({ name: clientName, industry: 'e2e' });
    expect(created.body.contacts).toHaveLength(1);

    const duplicate = await request(app.getHttpServer())
      .post('/clients')
      .set('x-api-key', 'test-api-key')
      .send({ name: clientName, industry: 'e2e' })
      .expect(409);
    expect(duplicate.body.message).toContain('already exists');
  });

  it('validates client input', async () => {
    const response = await request(app.getHttpServer())
      .post('/clients')
      .set('x-api-key', 'test-api-key')
      .send({ name: '', industry: 'e2e', contacts: [{ name: 'x', role: 'y', email: 'nope' }] })
      .expect(400);

    const messages = Array.isArray(response.body.message)
      ? response.body.message.join(' ')
      : response.body.message;
    expect(messages).toContain('name');
    expect(messages).toContain('email');
  });

  it('creates and updates a developer with skills', async () => {
    const created = await request(app.getHttpServer())
      .post('/developers')
      .set('x-api-key', 'test-api-key')
      .send({
        name: `E2E Developer ${suffix}`,
        email: developerEmail,
        role: 'Engineer',
        seniority: 'senior',
        benchSince: '2026-01-01',
        skills: [
          { name: 'TypeScript', level: 'expert', yearsExp: 6 },
          { name: 'NestJS', level: 'advanced', yearsExp: 4 },
        ],
      })
      .expect(201);

    ids.developerId = created.body.id;
    expect(created.body.skills).toHaveLength(2);

    const list = await request(app.getHttpServer())
      .get('/developers')
      .query({ search: `E2E Developer ${suffix}` })
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].onBench).toBe(true);

    const updated = await request(app.getHttpServer())
      .patch(`/developers/${ids.developerId}`)
      .set('x-api-key', 'test-api-key')
      .send({ seniority: 'lead', skills: [{ name: 'TypeScript', level: 'expert', yearsExp: 7 }] })
      .expect(200);

    expect(updated.body.seniority).toBe('lead');
    expect(updated.body.skills).toHaveLength(1);
    expect(updated.body.skills[0].yearsExp).toBe(7);
  });

  it('creates a contract and rejects inverted dates', async () => {
    const created = await request(app.getHttpServer())
      .post('/contracts')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId: ids.developerId,
        clientId: ids.clientId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        billingRate: 9500,
        status: 'active',
      })
      .expect(201);

    ids.contractId = created.body.id;
    expect(created.body.billingRate).toBe(9500);
    expect(created.body.developer.id).toBe(ids.developerId);

    await request(app.getHttpServer())
      .post('/contracts')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId: ids.developerId,
        clientId: ids.clientId,
        startDate: '2026-12-31',
        endDate: '2026-01-01',
        billingRate: 100,
      })
      .expect(400);
  });

  it('creates assignments and performance records', async () => {
    const assignment = await request(app.getHttpServer())
      .post('/assignments')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId: ids.developerId,
        clientId: ids.clientId,
        projectName: 'E2E Project',
        status: 'active',
        startDate: '2026-01-01',
      })
      .expect(201);
    expect(assignment.body.projectName).toBe('E2E Project');
    expect(assignment.body.endDate).toBeNull();

    const performance = await request(app.getHttpServer())
      .post('/performance')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId: ids.developerId,
        period: '2026-Q3',
        velocity: 42,
        prMergeTime: 1.2,
        codeQuality: 92,
        clientRating: 4.5,
      })
      .expect(201);
    expect(performance.body.developer.name).toContain('E2E Developer');

    await request(app.getHttpServer())
      .post('/performance')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId: ids.developerId,
        period: '2026-Q3',
        velocity: 10,
        prMergeTime: 2,
        codeQuality: 80,
      })
      .expect(409);
  });

  it('returns client detail with related records', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/clients/${ids.clientId}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(detail.body.contacts).toHaveLength(1);
    expect(detail.body.assignments).toHaveLength(1);
    expect(detail.body.contracts).toHaveLength(1);
  });

  it('deletes a developer and cascades related records', async () => {
    const deleted = await request(app.getHttpServer())
      .delete(`/developers/${ids.developerId}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);
    expect(deleted.body).toEqual({ deleted: true, id: ids.developerId });

    await request(app.getHttpServer())
      .get(`/developers/${ids.developerId}`)
      .set('x-api-key', 'test-api-key')
      .expect(404);

    ids.developerId = undefined;
  });
});
