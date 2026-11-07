import { expect, test } from '@playwright/test';
import { TEST_PASSWORD, signUp } from './helpers';

test.describe('authentication', () => {
  test('redirects unauthenticated visitors to sign in', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: 'Sign in to Aya' })).toBeVisible();
  });

  test('signs up, signs out, and signs back in', async ({ page }) => {
    const { email, name } = await signUp(page);

    await expect(page.getByText(name).first()).toBeVisible();

    await page.getByRole('button', { name: new RegExp(name) }).click();
    const signOutResponse = page.waitForResponse(
      (response) => response.url().includes('/api/auth/sign-out') && response.ok(),
    );
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await signOutResponse;

    await page.goto('/');
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByPlaceholder('Email').fill(email);
    await page.getByPlaceholder('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
