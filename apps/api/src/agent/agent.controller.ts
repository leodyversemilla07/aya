import { Body, Controller, Post } from '@nestjs/common';
import type { AgentService } from './agent.service';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  async chat(@Body() body: { message: string; conversationId?: string }) {
    return this.agentService.chat(body.message, body.conversationId);
  }
}
