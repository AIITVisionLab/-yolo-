const { test, expect } = require('@playwright/test');
const { FRONTEND_BASE_URL, loginAsAdmin, sampleAnnotationImageFile, sampleImageFile } = require('./helpers.cjs');

test.describe.configure({ mode: 'serial' });

test('ui core flows', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.locator('.native-workspace--recognition')).toBeVisible();
  await expect(page.getByRole('button', { name: '热力图', exact: true })).toBeVisible();

  await page.setInputFiles('input[type="file"][accept="image/*"]', sampleImageFile());
  await page.getByRole('button', { name: '开始识别', exact: true }).click();
  await expect(page.locator('.recognition-result-grid')).toBeVisible();
  await expect(page.locator('.recognition-result-card strong').first()).not.toHaveText('--', { timeout: 30000 });
  await expect(page.getByRole('heading', { name: '候选结果', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '标签统计', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await expect(page.locator('.recognition-stage__heatmap.is-visible')).toBeVisible();
  await expect(page.getByRole('heading', { name: '智能分析', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '送去标注', exact: true }).click();
  await expect(page.locator('.native-workspace--annotation')).toBeVisible();
  await expect(page.getByRole('heading', { name: '标注画面', exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/?workspace=details`, { waitUntil: 'networkidle' });
  await expect(page.locator('.native-workspace--details')).toBeVisible();
  await expect(page.getByRole('heading', { name: '模型资产中心', exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_BASE_URL}/?workspace=admin`, { waitUntil: 'networkidle' });
  await expect(page.locator('.native-workspace--admin')).toBeVisible();
  await expect(page.getByRole('heading', { name: '模型资源', exact: true }).first()).toBeVisible();
  const boardTabs = page.getByRole('tablist', { name: '平台资源视图' });
  await boardTabs.locator('.workspace-mode-switch__item', { hasText: '平台用户' }).first().click();
  await expect(page.getByRole('heading', { name: '平台用户', exact: true }).first()).toBeVisible();
  await boardTabs.locator('.workspace-mode-switch__item', { hasText: '增强脚本' }).first().click();
  await expect(page.getByRole('heading', { name: '增强算法上架台', exact: true }).first()).toBeVisible();
});

test('annotation can draw boxes from accessible dataset records', async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto(`${FRONTEND_BASE_URL}/?workspace=annotation`, { waitUntil: 'networkidle' });
  await expect(page.locator('.native-workspace--annotation')).toBeVisible();

  const datasetSelect = page.locator('.annotation-sidebar select').first();
  await expect(datasetSelect.locator('option')).not.toHaveCount(0);
  await expect(datasetSelect).not.toHaveValue('');

  const classSelect = page.locator('.annotation-sidebar select').nth(1);
  await expect(classSelect.locator('option')).not.toHaveCount(0);
  await expect(classSelect).not.toHaveValue('');

  await page.setInputFiles('input[type="file"][accept="image/*"]', sampleAnnotationImageFile());
  await page.getByRole('button', { name: /专注标注模式/ }).click();
  const focusDialog = page.getByRole('dialog', { name: '专注标注模式' });
  await expect(focusDialog).toBeVisible();
  const stageFrame = focusDialog.locator('.annotation-stage__frame');
  await expect(stageFrame).toBeVisible();

  const box = await stageFrame.boundingBox();
  if (!box) {
    throw new Error('annotation stage frame is not measurable');
  }

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();

  await expect(focusDialog.locator('.annotation-box')).toHaveCount(1);
  await expect(focusDialog.locator('.annotation-focus__summary strong', { hasText: '1 个框' })).toBeVisible();
});
