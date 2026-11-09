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
import { DevelopersService } from './developers.service';
import { parseOrThrow } from './management.http';
import {
  developerCreateSchema,
  developerListQuerySchema,
  developerUpdateSchema,
} from './management.schemas';

@Controller('developers')
export class DevelopersController {
  constructor(@Inject(DevelopersService) private readonly service: DevelopersService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(developerListQuerySchema, query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    return this.service.create(parseOrThrow(developerCreateSchema, body));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parseOrThrow(developerUpdateSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
