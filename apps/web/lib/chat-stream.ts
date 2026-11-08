export interface ChatStreamHandlers {
  onConversation?: (conversation: { id: string; title: string }) => void;
  onStatus?: (message: string) => void;
  onDelta?: (content: string) => void;
}

export interface ChatStreamResult {
  conversationId: string;
  content: string;
}

export class ChatStreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatStreamError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function consumeChatStream(
  response: Response,
  handlers: ChatStreamHandlers = {},
): Promise<ChatStreamResult> {
  if (!response.body) {
    throw new ChatStreamError('Streaming is not supported by this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = 'message';
  let dataLines: string[] = [];
  let result: ChatStreamResult | null = null;
  let streamError: string | null = null;

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = 'message';
      return;
    }

    const name = eventName;
    const data = dataLines.join('\n');
    eventName = 'message';
    dataLines = [];

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return;
    }
    if (!isRecord(payload)) return;

    if (name === 'conversation') {
      if (typeof payload.id === 'string') {
        handlers.onConversation?.({
          id: payload.id,
          title: typeof payload.title === 'string' ? payload.title : '',
        });
      }
      return;
    }

    if (name === 'status') {
      if (typeof payload.message === 'string') handlers.onStatus?.(payload.message);
      return;
    }

    if (name === 'delta') {
      if (typeof payload.content === 'string') handlers.onDelta?.(payload.content);
      return;
    }

    if (name === 'done') {
      if (typeof payload.conversationId === 'string' && typeof payload.content === 'string') {
        result = { conversationId: payload.conversationId, content: payload.content };
      } else {
        streamError = 'Aya returned an invalid response.';
      }
      return;
    }

    if (name === 'error') {
      streamError =
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : 'The assistant could not complete that request.';
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        if (line === '') {
          dispatch();
        } else if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
        // Comment lines (": ping") and unknown fields are ignored.

        if (streamError) break;
        newline = buffer.indexOf('\n');
      }

      if (streamError) break;
    }

    buffer += decoder.decode();
    if (!streamError && buffer.startsWith('data:')) {
      dataLines.push(buffer.slice(5).trimStart());
    }
    if (!streamError) dispatch();
  } finally {
    reader.releaseLock();
  }

  if (streamError) {
    throw new ChatStreamError(streamError);
  }
  if (!result) {
    throw new ChatStreamError('The assistant response ended unexpectedly. Please try again.');
  }
  return result;
}
