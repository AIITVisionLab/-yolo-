const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers.cjs');

test('auth persists across hard navigation', async ({ page }) => {
  await loginAsAdmin(page);

  const before = await page.evaluate(() => window.localStorage.getItem('plant_auth_token'));
  await page.goto('http://127.0.0.1:5500/?workspace=details', { waitUntil: 'networkidle' });
  const after = await page.evaluate(() => window.localStorage.getItem('plant_auth_token'));
  const userBlockCount = await page.locator('.topbar__user').count();
  const dialogCount = await page.getByRole('dialog', { name: '登录与注册' }).count();

  expect(Boolean(before)).toBe(true);
  expect(Boolean(after)).toBe(true);
  expect(userBlockCount).toBe(1);
  expect(dialogCount).toBe(0);
});
