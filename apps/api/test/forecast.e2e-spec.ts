import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

describe('Capacity forecast (e2e)', () => {
  let app: INestApplication<App>;
  const suffix = Date.now().toString(36);
  const clientName = `Forecast Client ${suffix}`;
  let clientId: string;
  let developerId: string;
  let contractId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated forecast requests', async () => {
    await request(app.getHttpServer()).get('/forecast').expect(401);
  });

  it('returns a forecast with a timeline, openings, and bench pool', async () => {
    const today = startOfToday();

    const client = await request(app.getHttpServer())
      .post('/clients')
      .set('x-api-key', 'test-api-key')
      .send({ name: clientName, industry: 'testing' })
      .expect(201);
    clientId = client.body.id;

    const developer = await request(app.getHttpServer())
      .post('/developers')
      .set('x-api-key', 'test-api-key')
      .send({
        name: `Forecast Developer ${suffix}`,
        email: `forecast-${suffix}@example.com`,
        role: 'Software Engineer',
        seniority: 'senior',
        skills: [{ name: 'React', level: 'expert', yearsExp: 5 }],
      })
      .expect(201);
    developerId = developer.body.id;

    const contract = await request(app.getHttpServer())
      .post('/contracts')
      .set('x-api-key', 'test-api-key')
      .send({
        developerId,
        clientId,
        startDate: addDays(today, -60).toISOString().slice(0, 10),
        endDate: addDays(today, 10).toISOString().slice(0, 10),
        billingRate: 100_000,
        status: 'active',
      })
      .expect(201);
    contractId = contract.body.id;

    const response = await request(app.getHttpServer())
      .get('/forecast?weeks=4')
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(response.body).toMatchObject({
      horizonWeeks: 4,
      today: today.toISOString().slice(0, 10),
      summary: { openings: expect.any(Number), onBenchNow: expect.any(Number) },
    });
    expect(response.body.timeline).toHaveLength(4);
    expect(response.body.timeline[0]).toMatchObject({
      weekStart: expect.any(String),
      onBench: expect.any(Number),
      utilizationRate: expect.any(Number),
    });
    expect(Array.isArray(response.body.openings)).toBe(true);
    expect(Array.isArray(response.body.benchPool)).toBe(true);

    const opening = response.body.openings.find(
      (item: { contractId: string }) => item.contractId === contractId,
    );
    expect(opening).toBeDefined();
    expect(opening).toMatchObject({
      client: clientName,
      developer: `Forecast Developer ${suffix}`,
      daysUntilEnd: 10,
      renewalLikely: false,
    });
    expect(opening.requiredSkills).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'React' })]),
    );
    expect(Array.isArray(opening.recommendations)).toBe(true);
  });

  it('filters openings by client', async () => {
    const response = await request(app.getHttpServer())
      .get(`/forecast?weeks=4&clientId=${clientId}`)
      .set('x-api-key', 'test-api-key')
      .expect(200);

    expect(response.body.openings).toHaveLength(1);
    expect(response.body.openings[0]).toMatchObject({ client: clientName });
  });

  it('validates the horizon', async () => {
    await request(app.getHttpServer())
      .get('/forecast?weeks=0')
      .set('x-api-key', 'test-api-key')
      .expect(400);
    await request(app.getHttpServer())
      .get('/forecast?weeks=99')
      .set('x-api-key', 'test-api-key')
      .expect(400);
  });

  it('exposes the forecast to the agent through the forecast_capacity tool', async () => {
    const { executeTool } = await import('../src/agent/tools');

    const result = await executeTool('forecast_capacity', { weeks: 4 });

    expect(Array.isArray(result)).toBe(false);
    const forecast = result as {
      horizonWeeks: number;
      summary: { openings: number };
      openings: Array<{ client: string }>;
    };
    expect(forecast.horizonWeeks).toBe(4);
    expect(forecast.summary.openings).toBeGreaterThanOrEqual(1);
    expect(forecast.openings.some((opening) => opening.client === clientName)).toBe(true);
  });

  it('rejects invalid forecast tool arguments', async () => {
    const { executeTool } = await import('../src/agent/tools');

    const result = await executeTool('forecast_capacity', { weeks: 99 });

    expect(result).toMatchObject({ error: expect.stringContaining('Invalid arguments') });
  });
});
