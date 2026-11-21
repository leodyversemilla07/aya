import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

const API_URL = 'http://localhost:3001';
const API_KEY = 'playwright-api-key';

test('shows a background alert and persists its read state', async ({ page }) => {
  const scan = await fetch(`${API_URL}/admin/alerts/scan`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
  });
  expect(scan.status).toBe(201);

  await signUp(page, { role: 'viewer' });
  await expect(page.getByRole('link', { name: /Notifications/ })).toBeVisible();

  await page.getByRole('link', { name: /Notifications/ }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  const firstUnread = page.getByTestId('notification-read-button').first();
  await expect(firstUnread).toBeVisible();
  await firstUnread.click();
  await expect(firstUnread).toHaveText('Read');

  await page.reload();
  await expect(page.getByRole('button', { name: 'Read' }).first()).toBeVisible();
});
