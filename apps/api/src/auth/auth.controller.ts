import { All, Controller, Req, Res } from '@nestjs/common';
import { auth } from '@workspace/auth';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';

@Controller('api/auth')
export class AuthController {
  @All('*')
  @Public()
  async handle(@Req() request: Request, @Res() response: Response) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(name, value);
      else if (Array.isArray(value)) headers.set(name, value.join(', '));
    }

    const body =
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : JSON.stringify(request.body ?? {});
    const result = await auth.handler(
      new Request(`${request.protocol}://${request.get('host')}${request.originalUrl}`, {
        method: request.method,
        headers,
        body,
      }),
    );

    response.status(result.status);
    result.headers.forEach((value, key) => response.setHeader(key, value));
    response.send(await result.text());
  }
}
