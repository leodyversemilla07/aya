import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AgentService } from './agent.service';

const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'message must be a non-empty string')
    .max(10_000, 'message must be 10000 characters or fewer'),
  conversationId: z.string().trim().min(1).optional(),
});

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @Body() body: unknown,
    @Req() request: Request,
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
      );
    } finally {
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }
}
