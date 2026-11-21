import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { getServerEnv } from '@workspace/env';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { MetricsService } from './metrics.service';

function safeCompare(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(MetricsService) private readonly service: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Req() request: Request) {
    const expected = getServerEnv().METRICS_TOKEN;
    if (!expected) throw new NotFoundException();

    const provided =
      request.header('x-metrics-token')?.trim() ||
      request
        .header('authorization')
        ?.replace(/^Bearer\s+/i, '')
        .trim();
    if (!provided || !safeCompare(expected, provided)) {
      throw new UnauthorizedException('A valid metrics token is required.');
    }

    return this.service.render();
  }
}
