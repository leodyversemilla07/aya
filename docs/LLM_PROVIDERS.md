# LLM providers

Aya talks to model providers through `@workspace/ai`. The agent never sees a provider-specific
shape: it sends normalized messages and tools, receives text deltas and tool calls, and the API
returns a single response contract.

This document is the reference for provider selection, streaming behavior, tool-call semantics, and
token accounting.

## Selecting a provider

```env
LLM_PROVIDER="anthropic"
LLM_API_KEY="your-provider-key"
# Optional overrides
LLM_BASE_URL="https://api.anthropic.com"
LLM_MODEL="claude-sonnet-4-5"
```

| Variable | Purpose |
|----------|---------|
| `LLM_PROVIDER` | `openai`, `openrouter`, `opencode-zen`, `anthropic`, `google`, or `custom` |
| `LLM_API_KEY` | Primary credential. Provider-specific keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, …) are used as a fallback |
| `LLM_BASE_URL` | Overrides the provider base URL. Use it for proxies, gateways, and local mocks |
| `LLM_MODEL` | Overrides the provider default model |
| `LLM_TIMEOUT_MS` | Total request/stream timeout. Default `60000` |
| `LLM_MAX_RETRIES` | Retries for retryable failures before the first token. Default `2` |
| `LLM_MAX_TOKENS` | Maximum output tokens per completion. Default `4096` |

| Provider | Default base URL | Default model |
|----------|------------------|---------------|
| `opencode-zen` | `https://opencode.ai/zen/v1` | `minimax-m2.5-free` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `openrouter` | `https://openrouter.ai/api/v1` | `google/gemma-4-26b-a4b-it:free` |
| `anthropic` | `https://api.anthropic.com` | `claude-sonnet-4-5` |
| `google` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` |
| `custom` | `http://localhost:3000/v1` | `default` |

## Streaming

Every provider streams natively. The agent forwards each delta to `POST /agent/chat/stream` as a
`delta` event, so the browser renders tokens as they arrive.

| Provider | Endpoint | Wire format |
|----------|----------|-------------|
| OpenAI-compatible | `{base}/chat/completions` with `stream: true` | `data:` chunks with `choices[].delta` |
| Anthropic | `{base}/v1/messages` with `stream: true` | `message_start`, `content_block_start/delta/stop`, `message_delta`, `message_stop` |
| Google | `{base}/models/{model}:streamGenerateContent?alt=sse` | `data:` chunks with `candidates[].content.parts` |

Provider-specific behavior:

- **Anthropic** emits text as `text_delta` events and tool arguments as `input_json_delta` events.
  Partial JSON is accumulated per content block and parsed once the block closes.
- **Google** emits complete `parts` per chunk. A chunk can carry text, a `functionCall`, or both.
- **OpenAI-compatible** providers emit text in `delta.content` and tool calls in
  `delta.tool_calls`, whose `function.arguments` fragments are concatenated before parsing.

A provider that returns a non-`2xx` status fails the request with a sanitized message. A stream
that fails after the first delta is not retried, because retrying would duplicate text the browser
already rendered.

## Tool calls

Tools are declared once and translated per provider:

| Provider | Tool declaration | Assistant tool call | Tool result |
|----------|------------------|---------------------|-------------|
| OpenAI-compatible | `tools[].function` | `tool_calls[]` with `tool_call_id` | `role: "tool"` message |
| Anthropic | `tools[].input_schema` | `tool_use` content block | `tool_result` block with `tool_use_id` |
| Google | `tools[].functionDeclarations` | `functionCall` part | `functionResponse` part |

The agent sends the tool name with each result so Gemini can match a `functionResponse` to its
function declaration. Anthropic requires `tool_result` blocks to sit in the user turn that follows
the assistant turn, and Gemini expects alternating turns, so consecutive same-role turns are merged
before the request is sent.

Tool arguments are validated in the API with Zod regardless of provider. A malformed argument
object fails the tool call with a validation error instead of reaching the database.

## Token usage

`LlmResponse.usage` reports `inputTokens`, `outputTokens`, and `totalTokens` when the provider sends
usage data:

| Provider | Source |
|----------|--------|
| OpenAI-compatible | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens` |
| Anthropic | `message_start` usage for input tokens, `message_delta` usage for output tokens |
| Google | `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `totalTokenCount` |

Usage is logged per completion by the agent service and is available to any caller of
`LlmService.chat` or `LlmService.chatStream`. The API also returns the provider, model, and
streaming mode (`native` or `buffered`) on the response object.

## Testing without a provider key

`packages/ai` ships unit tests that serve recorded SSE fixtures from a local HTTP server, so no
network access or provider credential is required:

```bash
pnpm --filter @workspace/ai run test
```

The same technique works for any OpenAI-compatible gateway: point `LLM_BASE_URL` at a local server
that emits `chat/completions` SSE chunks.

## Troubleshooting

| Symptom | Checks |
|---------|--------|
| `LLM_API_KEY is not configured` | Set `LLM_API_KEY`, or the provider-specific key such as `ANTHROPIC_API_KEY` |
| `The AI provider rejected the configured API key` | The key is wrong for the selected provider, or `LLM_BASE_URL` points at a different provider |
| `The AI request timed out` | Raise `LLM_TIMEOUT_MS`, or check whether the provider is queueing the request |
| Tool call fails validation | Inspect the provider's tool arguments; the agent validates them with Zod before execution |
| The browser receives one large delta | The provider is being reached through an OpenAI-compatible proxy that buffers responses; use the provider's own endpoint |
| Blocked by Google with `422` | The request was declined by Gemini safety filters; rephrase the question |
