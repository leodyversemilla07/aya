import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { LlmError } from '../llm/llm.service';
import { type RequestWithId, logRequestFailure } from './request-logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    let status = 500;
    let message = 'Internal server error';
    let stack: string | undefined;

    if (exception instanceof LlmError) {
      status = exception.status;
      message = exception.message;
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
      message = 'Internal server error';
      stack = exception.stack;
    }

    if (status >= 500 || exception instanceof LlmError) {
      logRequestFailure({
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        status,
        message: exception instanceof Error ? exception.message : message,
        stack,
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      requestId: request.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  }
}
