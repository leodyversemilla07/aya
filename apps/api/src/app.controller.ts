import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import type { AuthenticatedRequest } from './auth/request';

@Controller()
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('ready')
  @Public()
  getReadiness() {
    return this.appService.getReadiness();
  }

  @Get('stats')
  getStats() {
    return this.appService.getStats();
  }

  @Get('conversations')
  listConversations(@Req() request: AuthenticatedRequest) {
    return this.appService.listConversations(request.auth?.user.id);
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @Query('limit') limitQuery: string | undefined,
    @Query('before') before: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const limit = limitQuery === undefined ? 100 : Number(limitQuery);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException('limit must be an integer between 1 and 200.');
    }

    return this.appService.getConversation(id, { limit, before }, request.auth?.user.id);
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.appService.deleteConversation(id, request.auth?.user.id);
  }
}
