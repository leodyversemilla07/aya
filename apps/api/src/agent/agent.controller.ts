import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../auth/request';
import { LlmError } from '../llm/llm.service';
import { AgentService } from './agent.service';

const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'message must be a non-empty string')
    .max(10_000, 'message must be 10000 characters or fewer'),
  conversationId: z.string().trim().min(1).optional(),
});

const HEARTBEAT_MS = 15_000;

function safeErrorMessage(error: unknown): string {
  if (error instanceof LlmError) return error.message;
  if (error instanceof HttpException) {
    if (error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    return error.message || 'The request could not be processed.';
  }
  return 'The assistant could not complete that request. Please try again.';
}

@Controller('agent')
export class AgentController {
  private readonly logger = new Logger(AgentController.name);

  constructor(@Inject(AgentService) private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((issue) => issue.message),
        error: 'Bad Request',
      });
    }

    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.on('aborted', abort);
    response.on('close', abort);

    try {
      return await this.agentService.chat(
        parsed.data.message,
        parsed.data.conversationId,
        abortController.signal,
        request.auth?.user.id,
      );
    } finally {
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }

  @Post('chat/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chatStream(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((issue) => issue.message),
        error: 'Bad Request',
      });
    }

    response.status(HttpStatus.OK);
    response.setHeader('content-type', 'text/event-stream; charset=utf-8');
    response.setHeader('cache-control', 'no-cache, no-transform');
    response.setHeader('connection', 'keep-alive');
    response.setHeader('x-accel-buffering', 'no');
    response.flushHeaders();

    const send = (event: string, data: unknown) => {
      if (response.writableEnded) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.on('aborted', abort);
    response.on('close', abort);

    const heartbeat = setInterval(() => {
      if (!response.writableEnded) response.write(': ping\n\n');
    }, HEARTBEAT_MS);

    try {
      const result = await this.agentService.chatStream(
        parsed.data.message,
        parsed.data.conversationId,
        abortController.signal,
        request.auth?.user.id,
        {
          onConversation: (conversation) => send('conversation', conversation),
          onStatus: (message) => send('status', { message }),
          onDelta: (content) => send('delta', { content }),
        },
      );
      send('done', result);
    } catch (error) {
      if (!abortController.signal.aborted) {
        if (!(error instanceof HttpException) && !(error instanceof LlmError)) {
          this.logger.error(
            `Streaming chat failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        send('error', { message: safeErrorMessage(error) });
      }
    } finally {
      clearInterval(heartbeat);
      request.off('aborted', abort);
      response.off('close', abort);
      if (!response.writableEnded) response.end();
    }
  }
}
