import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [LlmModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
