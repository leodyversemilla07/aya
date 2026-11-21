import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOrThrow } from '../management/management.http';
import { forecastQuerySchema } from './forecast.schemas';
import { ForecastService } from './forecast.service';

@Controller('forecast')
@Roles('admin', 'manager', 'viewer')
@UseGuards(RolesGuard)
export class ForecastController {
  constructor(@Inject(ForecastService) private readonly service: ForecastService) {}

  @Get()
  forecast(@Query() query: unknown) {
    return this.service.forecast(parseOrThrow(forecastQuerySchema, query));
  }
}
