import { BadRequestException, Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

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
  listConversations() {
    return this.appService.listConversations();
  }

  @Get('conversations/:id')
  getConversation(
    @Param('id') id: string,
    @Query('limit') limitQuery?: string,
    @Query('before') before?: string,
  ) {
    const limit = limitQuery === undefined ? 100 : Number(limitQuery);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new BadRequestException('limit must be an integer between 1 and 200.');
    }

    return this.appService.getConversation(id, { limit, before });
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string) {
    return this.appService.deleteConversation(id);
  }
}
