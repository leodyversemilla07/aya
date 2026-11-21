process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:./test-e2e.db';
process.env.LLM_API_KEY ??= 'test-key';
process.env.METRICS_TOKEN ??= 'test-metrics-token-123456';
