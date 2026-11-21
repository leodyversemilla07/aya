import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('shows the capacity forecast with openings and backfill recommendations', async ({ page }) => {
  await signUp(page, { role: 'viewer' });

  await page.getByRole('link', { name: /Capacity/ }).click();
  await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible();

  await expect(page.getByText('Available now', { exact: true })).toBeVisible();
  await expect(page.getByText('Projected utilization', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Weekly supply and demand' })).toBeVisible();

  const openings = page.getByRole('heading', { name: 'Openings and backfills' });
  await expect(openings).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bench pool' })).toBeVisible();

  // The seeded workspace has contracts ending inside the eight week horizon.
  await expect(page.getByText('UnionBank').first()).toBeVisible();

  await page.getByRole('button', { name: '12w' }).click();
  await expect(page.getByText('Projected bench', { exact: true })).toBeVisible();
});
