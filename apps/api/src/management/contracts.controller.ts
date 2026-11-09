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
import { ContractsService } from './contracts.service';
import { parseOrThrow } from './management.http';
import {
  contractCreateSchema,
  contractListQuerySchema,
  contractUpdateSchema,
} from './management.schemas';

@Controller('contracts')
export class ContractsController {
  constructor(@Inject(ContractsService) private readonly service: ContractsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(contractListQuerySchema, query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    return this.service.create(parseOrThrow(contractCreateSchema, body));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parseOrThrow(contractUpdateSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
