import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOrThrow } from '../management/management.http';
import { alertDeliveryListQuerySchema, alertListQuerySchema } from './alert.schemas';
import { AlertService } from './alert.service';

@Controller('alerts')
@UseGuards(RolesGuard)
export class AlertController {
  constructor(@Inject(AlertService) private readonly service: AlertService) {}

  @Get()
  @Roles('admin', 'manager', 'viewer')
  listAlerts(@Query() query: unknown) {
    return this.service.listAlerts(parseOrThrow(alertListQuerySchema, query));
  }

  @Get('deliveries')
  @Roles('admin')
  listDeliveries(@Query() query: unknown) {
    return this.service.listDeliveries(parseOrThrow(alertDeliveryListQuerySchema, query));
  }
}
