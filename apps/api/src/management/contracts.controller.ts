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
import { ContractsService } from './contracts.service';
import { parseOrThrow } from './management.http';
import {
  contractCreateSchema,
  contractListQuerySchema,
  contractUpdateSchema,
} from './management.schemas';

@Controller('contracts')
@Roles('admin', 'manager', 'viewer')
@UseGuards(RolesGuard)
export class ContractsController {
  constructor(@Inject(ContractsService) private readonly service: ContractsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(contractListQuerySchema, query));
  }

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.service.create(
      parseOrThrow(contractCreateSchema, body),
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
      parseOrThrow(contractUpdateSchema, body),
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
