import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { ChatQuotaService } from './chat-quota.service';

@Module({
  imports: [LlmModule],
  controllers: [AgentController],
  providers: [AgentService, ChatQuotaService],
})
export class AgentModule {}
