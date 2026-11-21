/**
 * Minimal Server-Sent Events reader shared by the OpenAI-compatible,
 * Anthropic, and Gemini streaming implementations. It yields the joined
 * payload of each `data:` field and ignores comments, `event:` names, and
 * retry hints.
 */
export async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];

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
          if (dataLines.length > 0) {
            yield dataLines.join('\n');
            dataLines = [];
          }
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart());
    if (dataLines.length > 0) yield dataLines.join('\n');
  } finally {
    reader.releaseLock();
  }
}
