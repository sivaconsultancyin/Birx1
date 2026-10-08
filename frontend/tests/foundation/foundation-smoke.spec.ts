import { test, expect } from '@playwright/test';

test.describe('Foundation smoke', () => {
  test('frontend starts and serves the application shell', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('backend health endpoint is reachable', async ({ request }) => {
    const base = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
    const response = await request.get(base + '/api/health');
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
  });
});
