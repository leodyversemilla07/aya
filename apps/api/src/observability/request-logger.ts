import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export interface RequestWithId extends Request {
  requestId?: string;
}

type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Accepts a caller-provided request ID when it is short and safe, otherwise
 * generates one. The ID is echoed on every response and included in logs and
 * error bodies so a client report can be traced end to end.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const provided = request.header('x-request-id')?.trim();
  const requestId = provided && REQUEST_ID_PATTERN.test(provided) ? provided : randomUUID();

  (request as RequestWithId).requestId = requestId;
  response.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();
  let logged = false;

  const complete = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    // Tests assert headers and bodies; skipping the line keeps test output clean.
    if (process.env.NODE_ENV === 'test') return;

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    write(aborted ? 'warn' : 'info', aborted ? 'request.aborted' : 'request.completed', {
      requestId,
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  };

  response.on('finish', () => complete(false));
  response.on('close', () => {
    if (!response.writableEnded) complete(true);
  });

  next();
}

export function logRequestFailure(fields: {
  requestId?: string;
  method: string;
  path: string;
  status: number;
  message: string;
  stack?: string;
}): void {
  write('error', 'request.failed', fields);
}
