import { Controller, Delete, Get, Param } from '@nestjs/common';
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

  @Get('stats')
  getStats() {
    return this.appService.getStats();
  }

  @Get('conversations')
  listConversations() {
    return this.appService.listConversations();
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string) {
    return this.appService.getConversation(id);
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string) {
    return this.appService.deleteConversation(id);
  }
}
