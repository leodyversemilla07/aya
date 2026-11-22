import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { buildOpenApiDocument } from './openapi.document';

/** Serves the generated OpenAPI 3.1 document. */
@Controller()
export class OpenApiController {
  private readonly document = buildOpenApiDocument();

  @Get('openapi.json')
  @Public()
  getOpenApiJson(@Res() response: Response): void {
    response.setHeader('cache-control', 'no-store');
    response.json(this.document);
  }
}
