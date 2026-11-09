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
} from '@nestjs/common';
import { parseOrThrow } from './management.http';
import {
  performanceCreateSchema,
  performanceListQuerySchema,
  performanceUpdateSchema,
} from './management.schemas';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(@Inject(PerformanceService) private readonly service: PerformanceService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(performanceListQuerySchema, query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    return this.service.create(parseOrThrow(performanceCreateSchema, body));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parseOrThrow(performanceUpdateSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
