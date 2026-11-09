import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test.describe('management console', () => {
  test('creates, edits, and deletes a developer', async ({ page }) => {
    await signUp(page);

    await page.getByRole('link', { name: 'Developers', exact: true }).click();
    await expect(page).toHaveURL(/\/developers$/);
    await expect(page.getByRole('heading', { name: 'Developers' })).toBeVisible();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = `Playwright Developer ${suffix}`;
    const email = `playwright-${suffix}@example.com`;

    await page.getByRole('button', { name: 'Add developer' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Role').fill('Frontend Engineer');
    await dialog.getByRole('button', { name: 'Add skill' }).click();
    await dialog.getByPlaceholder('React').fill('TypeScript');
    await dialog.getByRole('button', { name: 'Create developer' }).click();

    await expect(dialog).toBeHidden();
    const rowLink = page.getByRole('link', { name, exact: true });
    await expect(rowLink).toBeVisible();

    await rowLink.click();
    await expect(page).toHaveURL(/\/developers\/.+/);
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('TypeScript · intermediate · 1y')).toBeVisible();

    await page.getByRole('button', { name: 'Edit' }).click();
    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Role').fill('Senior Frontend Engineer');
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByText('Senior Frontend Engineer')).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'Delete' }).click();

    await expect(page).toHaveURL(/\/developers$/);
    await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
  });

  test('lists clients and contracts', async ({ page }) => {
    await signUp(page);

    await page.getByRole('link', { name: 'Clients', exact: true }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'UnionBank' })).toBeVisible();

    await page.getByRole('link', { name: 'Contracts', exact: true }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(page.getByRole('heading', { name: 'Contracts' })).toBeVisible();

    await page.getByRole('link', { name: 'Assignments', exact: true }).click();
    await expect(page).toHaveURL(/\/assignments$/);
    await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();

    await page.getByRole('link', { name: 'Performance', exact: true }).click();
    await expect(page).toHaveURL(/\/performance$/);
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
  });
});
