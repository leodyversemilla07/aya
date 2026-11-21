import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.describe('dashboard and chat', () => {
  test('renders live staffing stats and navigates to chat', async ({ page }) => {
    await signUp(page);

    const main = page.getByRole('main');
    await expect(main.getByText('Developers', { exact: true })).toBeVisible();
    await expect(main.getByText('On Bench', { exact: true })).toBeVisible();
    await expect(main.getByText('Assigned', { exact: true })).toBeVisible();
    await expect(main.getByText('Clients', { exact: true })).toBeVisible();
    await expect(main.getByText('Active contracts:')).toBeVisible();

    await page.getByRole('link', { name: 'Chat', exact: true }).click();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByPlaceholder('Ask about your team...')).toBeVisible();
  });

  test('sends a message and renders the streamed assistant reply', async ({ page }) => {
    await signUp(page);
    await page.route('**/agent/chat/stream', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: [
          'event: conversation\ndata: {"id":"e2e-conversation","title":"Who is on the bench?"}\n\n',
          'event: tool_call\ndata: {"index":0,"name":"get_utilization","input":{"scope":"all"}}\n\n',
          'event: tool_result\ndata: {"index":0,"name":"get_utilization","output":{"onBench":2}}\n\n',
          'event: delta\ndata: {"content":"**2 developers** are on the bench."}\n\n',
          'event: usage\ndata: {"inputTokens":8420,"outputTokens":1260,"totalInputTokens":8420,"totalOutputTokens":1260,"contextLimit":128000}\n\n',
          'event: done\ndata: {"conversationId":"e2e-conversation","content":"**2 developers** are on the bench."}\n\n',
        ].join(''),
      });
    });

    const input = page.getByLabel('Message Aya');
    await input.fill('Who is on the bench?');
    await input.press('Enter');

    await expect(page.getByText('Who is on the bench?')).toBeVisible();
    await expect(page.getByText('2 developers')).toBeVisible();

    // The tool call renders as an expandable trace step above the reply.
    await expect(page.getByText('Checking utilization')).toBeVisible();
    await page.getByText('Checking utilization').click();
    await expect(page.getByText('"scope": "all"')).toBeVisible();

    // The usage event surfaces a context indicator.
    await expect(page.getByText('7% context')).toBeVisible();
    await page.getByText('7% context').hover();
    await expect(page.getByText('Context', { exact: true })).toBeVisible();
    await expect(page.getByText('8.4k / 128k')).toBeVisible();

    const storedId = await page.evaluate(() => window.localStorage.getItem('aya:conversation-id'));
    expect(storedId).toBe('e2e-conversation');
  });

  test('shows an error when the chat request fails', async ({ page }) => {
    await signUp(page);
    await page.route('**/agent/chat/stream', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Provider unavailable' }),
      });
    });

    const input = page.getByLabel('Message Aya');
    await input.fill('Who is on the bench?');
    await input.press('Enter');

    await expect(page.getByRole('alert').filter({ hasText: 'Provider unavailable' })).toBeVisible();
  });

  test('deletes a conversation after confirmation', async ({ page }) => {
    let conversations = [
      {
        id: 'e2e-conversation',
        title: 'Delete me',
        preview: 'Old question',
        messageCount: 2,
        lastMessageAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    let deleted = false;

    await page.route('**/conversations**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());

      if (request.method() === 'GET' && url.pathname === '/conversations') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(conversations),
        });
        return;
      }

      if (request.method() === 'DELETE' && url.pathname === '/conversations/e2e-conversation') {
        deleted = true;
        conversations = [];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ deleted: true, id: 'e2e-conversation' }),
        });
        return;
      }

      await route.fallback();
    });

    await signUp(page);
    await page.getByRole('link', { name: 'Chat', exact: true }).click();
    await expect(page.getByText('Delete me')).toBeVisible();

    await page.getByRole('button', { name: 'More' }).click();
    await page.getByRole('menuitem', { name: 'Delete chat' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => deleted).toBe(true);
    await expect(page.getByText('Delete me')).toHaveCount(0);
  });
});
