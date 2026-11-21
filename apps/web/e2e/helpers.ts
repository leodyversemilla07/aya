import { type Page, expect } from '@playwright/test';

const API_URL = 'http://localhost:3001';
const API_KEY = 'playwright-api-key';

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function assignRole(email: string, role: 'admin' | 'manager' | 'viewer'): Promise<void> {
  const usersResponse = await fetch(
    `${API_URL}/admin/users?search=${encodeURIComponent(email)}&limit=10`,
    { headers: { 'x-api-key': API_KEY } },
  );
  if (!usersResponse.ok) throw new Error(`Could not load the test user: ${usersResponse.status}`);

  const users = (await usersResponse.json()) as {
    items?: Array<{ id: string; role: 'admin' | 'manager' | 'viewer' }>;
  };
  const user = users.items?.[0];
  if (!user) throw new Error(`Could not find the test user ${email}.`);
  if (user.role === 'admin' || user.role === role) return;

  const updateResponse = await fetch(`${API_URL}/admin/users/${user.id}/role`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ role }),
  });
  if (!updateResponse.ok) {
    throw new Error(`Could not assign the test user role: ${updateResponse.status}`);
  }
}

export async function signUp(
  page: Page,
  options: {
    name?: string;
    email?: string;
    role?: 'admin' | 'manager' | 'viewer';
  } = {},
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

  // The first account is the bootstrap administrator. Later test accounts are
  // viewers by default and are promoted so management CRUD remains testable.
  await assignRole(email, options.role ?? 'manager');
  // Better Auth caches the session returned during signup. Reload so the
  // client observes a role that was assigned immediately afterwards.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
    timeout: 15_000,
  });

  return { email, name };
}
