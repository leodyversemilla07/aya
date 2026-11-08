import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { prisma } from '@workspace/db';
import { getServerEnv } from '@workspace/env';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const env = getServerEnv();
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', env.TRUST_PROXY === 'true');

  app.enableCors({
    origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: [
      'retry-after',
      'x-chat-quota-limit',
      'x-chat-quota-used',
      'x-chat-quota-remaining',
      'x-chat-quota-reset',
      'x-request-id',
    ],
  });

  if (!env.API_KEY) {
    throw new Error('API_KEY must be configured before the API can start.');
  }

  await app.listen(env.API_PORT);
  logger.log(`Aya API running on http://localhost:${env.API_PORT}`);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Shutting down...`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch(async (error) => {
  const logger = new Logger('Bootstrap');
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  await prisma.$disconnect();
  process.exit(1);
});
