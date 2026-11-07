import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.describe('dashboard and chat', () => {
  test('renders live staffing stats and navigates to chat', async ({ page }) => {
    await signUp(page);

    await expect(page.getByText('Developers', { exact: true })).toBeVisible();
    await expect(page.getByText('On Bench', { exact: true })).toBeVisible();
    await expect(page.getByText('Assigned', { exact: true })).toBeVisible();
    await expect(page.getByText('Clients', { exact: true })).toBeVisible();
    await expect(page.getByText('Active contracts:')).toBeVisible();

    await page.getByRole('link', { name: 'Chat', exact: true }).click();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByPlaceholder('Ask about your team...')).toBeVisible();
  });

  test('sends a message and renders the assistant reply', async ({ page }) => {
    await signUp(page);
    await page.route('**/agent/chat', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: 'e2e-conversation',
          content: '**2 developers** are on the bench.',
        }),
      });
    });

    const input = page.getByLabel('Message Aya');
    await input.fill('Who is on the bench?');
    await input.press('Enter');

    await expect(page.getByText('Who is on the bench?')).toBeVisible();
    await expect(page.getByText('2 developers')).toBeVisible();

    const storedId = await page.evaluate(() => window.localStorage.getItem('aya:conversation-id'));
    expect(storedId).toBe('e2e-conversation');
  });

  test('shows an error when the chat request fails', async ({ page }) => {
    await signUp(page);
    await page.route('**/agent/chat', async (route) => {
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
});
