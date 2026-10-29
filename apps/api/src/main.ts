import 'dotenv/config';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { prisma } from '@workspace/db';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LlmError } from './llm/llm.service';

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message = 'Internal server error';

    if (exception instanceof LlmError) {
      status = exception.status;
      message = exception.message;
      this.logger.error(`${request.method} ${request.url}: ${exception.message}`);
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as { message?: string | string[] };
        message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? exception.message);
      }
      if (status >= 500) message = 'Internal server error';
    } else if (exception instanceof Error) {
      this.logger.error(
        `${request.method} ${request.url} failed: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const configuredApiKey = process.env.API_KEY?.trim();
  if (!configuredApiKey) {
    throw new Error('API_KEY must be configured before the API can start.');
  }

  const port = Number(process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid API_PORT: ${process.env.API_PORT}`);
  }

  await app.listen(port);
  logger.log(`Aya API running on http://localhost:${port}`);

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
