import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

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

  it('/ (GET) returns the service greeting', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  it('/health (GET) reports a healthy service', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'aya-api' });
  });

  it('/agent/chat (POST) rejects invalid bodies with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/agent/chat')
      .send({ message: '' })
      .expect(400);

    expect(response.body.message).toContain('message must be a non-empty string');
  });

  it('/agent/chat (POST) rejects missing bodies with 400', async () => {
    await request(app.getHttpServer()).post('/agent/chat').send({}).expect(400);
  });
});
