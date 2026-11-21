'use client';

import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
} from '@workspace/ui/components/code-block';
import { useHighlightedCode } from '@workspace/ui/hooks/use-highlighted-code';
import { type ReactNode, isValidElement } from 'react';

// Maps a markdown fenced code block onto the shadcn Code Block component.
export function ChatCodeBlock({ children }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children;

  if (!isValidElement(child)) {
    return <pre>{children}</pre>;
  }

  const props = child.props as { className?: string; children?: ReactNode };
  const language = /language-([\w-]+)/.exec(props.className ?? '')?.[1] ?? 'text';
  const code = String(props.children).replace(/\n$/, '');
  const lines = useHighlightedCode(code, language);

  return (
    <CodeBlock size="sm" className="my-3">
      <CodeBlockContent wrap className="max-h-80">
        {lines.map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: code lines are positional
          <span key={index} data-line={index + 1}>
            {line}
            {'\n'}
          </span>
        ))}
      </CodeBlockContent>
      <CodeBlockCopyButton value={code} aria-label="Copy code" />
    </CodeBlock>
  );
}
