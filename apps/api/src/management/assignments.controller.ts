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
import { AssignmentsService } from './assignments.service';
import { parseOrThrow } from './management.http';
import {
  assignmentCreateSchema,
  assignmentListQuerySchema,
  assignmentUpdateSchema,
} from './management.schemas';

@Controller('assignments')
export class AssignmentsController {
  constructor(@Inject(AssignmentsService) private readonly service: AssignmentsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.service.list(parseOrThrow(assignmentListQuerySchema, query));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown) {
    return this.service.create(parseOrThrow(assignmentCreateSchema, body));
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.service.update(id, parseOrThrow(assignmentUpdateSchema, body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
