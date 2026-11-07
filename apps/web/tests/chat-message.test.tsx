import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessage, ChatTypingIndicator } from '../components/chat/chat-message';

describe('ChatMessage', () => {
  it('renders user messages as plain text', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Who is on the bench?' }} />);

    expect(screen.getByText('Who is on the bench?')).toBeInTheDocument();
  });

  it('renders assistant markdown, tables, and links', () => {
    const content = [
      '**2 developers** are available.',
      '',
      '| Name | Skill |',
      '| --- | --- |',
      '| Ada | React |',
      '',
      '[Open roster](https://example.com/roster)',
    ].join('\n');

    render(<ChatMessage message={{ role: 'assistant', content }} />);

    expect(screen.getByText('2 developers')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open roster' })).toHaveAttribute(
      'href',
      'https://example.com/roster',
    );
  });

  it('announces the typing indicator', () => {
    render(<ChatTypingIndicator />);

    expect(screen.getByLabelText('Aya is thinking')).toBeInTheDocument();
  });
});
