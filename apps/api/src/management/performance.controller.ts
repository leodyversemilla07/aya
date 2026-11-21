import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { actorFromRequest } from '../audit/audit';
import type { AuthenticatedRequest } from '../auth/request';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { parseOrThrow } from './management.http';
import {
  performanceCreateSchema,
  performanceListQuerySchema,
  performanceUpdateSchema,
} from './management.schemas';
import { PerformanceService } from './performance.service';

@Controller('performance')
@Roles('admin', 'manager', 'viewer')
@UseGuards(RolesGuard)
export class PerformanceController {
  constructor(@Inject(PerformanceService) private readonly service: PerformanceService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(performanceListQuerySchema, query));
  }

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.create(
      parseOrThrow(performanceCreateSchema, body),
      actorFromRequest(request),
      request.requestId,
    );
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(@Param('id') id: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.update(
      id,
      parseOrThrow(performanceUpdateSchema, body),
      actorFromRequest(request),
      request.requestId,
    );
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.service.remove(id, actorFromRequest(request), request.requestId);
  }
}
