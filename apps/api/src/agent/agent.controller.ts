import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AgentService } from './agent.service';

interface ChatBody {
  message: string;
  conversationId?: string;
}

function isValidChatBody(body: unknown): body is ChatBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof (body as ChatBody).message === 'string' &&
    (body as ChatBody).message.length > 0 &&
    (body as ChatBody).message.length <= 10000
  );
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: unknown) {
    if (!isValidChatBody(body)) {
      return {
        error: 'Invalid request: message is required and must be a non-empty string (max 10000 chars)',
      };
    }
    return this.agentService.chat(body.message, body.conversationId);
  }
}