process.env.NODE_ENV = 'test';
process.env.API_KEY = '';
process.env.DATABASE_URL ??= 'file:./test-e2e.db';
process.env.LLM_API_KEY ??= 'test-key';
