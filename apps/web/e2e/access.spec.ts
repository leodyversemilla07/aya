import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

const WEB_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3001';
const API_KEY = 'playwright-api-key';

test.describe('workspace roles', () => {
  test('enforces read, manager, and administrator access', async ({ browser }) => {
    const adminContext = await browser.newContext({ baseURL: WEB_URL });
    const adminPage = await adminContext.newPage();
    const { email: adminEmail } = await signUp(adminPage, {
      email: 'playwright-admin@example.com',
      role: 'admin',
    });

    await adminPage.goto('/admin/users');
    await expect(adminPage.getByRole('heading', { name: 'Users' })).toBeVisible();
    await expect(
      adminPage.getByText('Full access, including user roles and audit history.').first(),
    ).toBeVisible();

    const lastAdminDemotion = await adminPage.evaluate(async (email) => {
      const usersResponse = await fetch(
        `http://localhost:3001/admin/users?search=${encodeURIComponent(email)}`,
        { credentials: 'include' },
      );
      const users = (await usersResponse.json()) as { items?: Array<{ id: string }> };
      const userId = users.items?.[0]?.id;
      if (!userId) return 404;

      const updateResponse = await fetch(`http://localhost:3001/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'viewer' }),
      });
      return updateResponse.status;
    }, adminEmail);
    expect(lastAdminDemotion).toBe(400);

    await adminPage.goto('/admin/audit-logs');
    await expect(adminPage.getByRole('heading', { name: 'Audit log' })).toBeVisible();

    const viewerContext = await browser.newContext({ baseURL: WEB_URL });
    const viewerPage = await viewerContext.newPage();
    await signUp(viewerPage, { role: 'viewer' });

    await viewerPage.goto('/developers');
    await expect(viewerPage.getByRole('heading', { name: 'Developers' })).toBeVisible();
    await expect(viewerPage.getByRole('button', { name: 'Add developer' })).toHaveCount(0);
    await expect(viewerPage.getByRole('button', { name: /^Edit / })).toHaveCount(0);

    const viewerWrite = await viewerPage.evaluate(async () => {
      const response = await fetch('http://localhost:3001/developers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Forbidden Viewer Developer',
          email: `forbidden-viewer-${Date.now()}@example.com`,
          role: 'Engineer',
          seniority: 'mid',
        }),
      });
      return response.status;
    });
    expect(viewerWrite).toBe(403);

    const managerContext = await browser.newContext({ baseURL: WEB_URL });
    const managerPage = await managerContext.newPage();
    await signUp(managerPage, { role: 'manager' });

    const managerWrite = await managerPage.evaluate(async () => {
      const response = await fetch('http://localhost:3001/developers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Allowed Manager Developer',
          email: `allowed-manager-${Date.now()}@example.com`,
          role: 'Engineer',
          seniority: 'mid',
        }),
      });
      return { status: response.status, body: await response.json() };
    });
    expect(managerWrite.status).toBe(201);

    await fetch(`${API_URL}/developers/${managerWrite.body.id}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    });

    await adminContext.close();
    await viewerContext.close();
    await managerContext.close();
  });
});
