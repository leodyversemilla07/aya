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
import { ClientsService } from './clients.service';
import { parseOrThrow } from './management.http';
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
} from './management.schemas';

@Controller('clients')
export class ClientsController {
  constructor(@Inject(ClientsService) private readonly service: ClientsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(clientListQuerySchema, query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    return this.service.create(parseOrThrow(clientCreateSchema, body));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parseOrThrow(clientUpdateSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
