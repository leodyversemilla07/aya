import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = exception instanceof Error ? exception.message : 'Unknown error';
    const stack = exception instanceof Error ? exception.stack : '';
    console.error('REQUEST ERROR:', message);
    if (stack) console.error(stack);
    response.status(status).json({ statusCode: status, message });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.API_PORT ?? 3001);
  console.log(`Aya API running on http://localhost:${process.env.API_PORT ?? 3001}`);
}
bootstrap();
