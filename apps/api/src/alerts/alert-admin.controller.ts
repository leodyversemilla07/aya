import { Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { getServerEnv } from '@workspace/env';
import { actorFromRequest } from '../audit/audit';
import type { AuthenticatedRequest } from '../auth/request';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { STAFFING_ALERT_RULES } from './alert-query';
import { AlertScannerService } from './alert-scanner.service';

@Controller('admin/alerts')
@Roles('admin')
@UseGuards(RolesGuard)
export class AlertAdminController {
  constructor(@Inject(AlertScannerService) private readonly scanner: AlertScannerService) {}

  @Get('config')
  config() {
    const env = getServerEnv();
    return {
      scanIntervalMs: env.ALERT_SCAN_INTERVAL_MS,
      leaseSeconds: env.ALERT_LEASE_SECONDS,
      webhook: {
        configured: Boolean(env.ALERT_WEBHOOK_URL && env.ALERT_WEBHOOK_SECRET),
        urlConfigured: Boolean(env.ALERT_WEBHOOK_URL),
        secretConfigured: Boolean(env.ALERT_WEBHOOK_SECRET),
        timeoutMs: env.ALERT_WEBHOOK_TIMEOUT_MS,
        maxAttempts: env.ALERT_WEBHOOK_MAX_ATTEMPTS,
      },
      rules: STAFFING_ALERT_RULES,
    };
  }

  @Post('scan')
  async scan(@Req() request: AuthenticatedRequest) {
    const scannedAt = new Date();
    const summary = await this.scanner.scan(scannedAt, {
      actor: actorFromRequest(request),
      requestId: request.requestId,
    });
    return { scannedAt, ...summary };
  }
}
