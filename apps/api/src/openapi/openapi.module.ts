import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { OpenApiController } from './openapi.controller';
import { docsHtmlPage, docsInitializerScript } from './openapi.document';

/**
 * Serves the interactive reference page and the Swagger UI assets under
 * /docs. The page loads only external, same-origin scripts so the strict
 * helmet content-security-policy stays in effect.
 */
function docsPageMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path === '' ? '/' : req.path;
  if (path === '/' || path === '/docs') {
    res.type('html').send(docsHtmlPage());
    return;
  }
  if (path === '/init.js' || path === '/docs/init.js') {
    res.type('application/javascript').send(docsInitializerScript());
    return;
  }
  next();
}

@Module({
  controllers: [OpenApiController],
})
export class OpenApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(docsPageMiddleware, ...swaggerUi.serve).forRoutes('docs');
  }
}
