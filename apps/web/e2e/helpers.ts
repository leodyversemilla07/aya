import { type Page, expect } from '@playwright/test';

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export async function signUp(
  page: Page,
  options: { name?: string; email?: string } = {},
): Promise<{ email: string; name: string }> {
  const email = options.email ?? uniqueEmail();
  const name = options.name ?? 'Aya Tester';

  await page.goto('/sign-up');
  await page.getByPlaceholder('Name').fill(name);
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password (8+ characters)').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });

  return { email, name };
}
