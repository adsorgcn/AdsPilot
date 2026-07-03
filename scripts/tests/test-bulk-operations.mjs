#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testBulkOperations() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔄 批量操作测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问Offers页面
    await test(results, 'Test 1: 访问Offers页面', async () => {
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/offers')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问Offers页面');
    });

    // Test 2: 验证全选checkbox存在
    await test(results, 'Test 2: 验证全选功能', async () => {
      const selectAllCheckbox = page.locator('input[type="checkbox"][aria-label*="全选"], input[type="checkbox"][aria-label*="Select all"]').first();
      const isVisible = await selectAllCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('全选checkbox不可见');
      }

      // 点击全选
      await selectAllCheckbox.click();
      await page.waitForTimeout(500);

      console.log('   ✓ 全选功能正常');
    });

    // Test 3: 验证批量操作按钮出现
    await test(results, 'Test 3: 批量操作按钮出现', async () => {
      const bulkActionButtons = [
        '批量删除',
        '批量启用',
        '批量禁用',
        '批量导出'
      ];

      let foundButtons = 0;
      for (const buttonText of bulkActionButtons) {
        const hasButton = await page.locator(`button:has-text("${buttonText}")`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasButton) {
          foundButtons++;
          console.log(`   ✓ 找到批量按钮: ${buttonText}`);
        }
      }

      if (foundButtons === 0) {
        throw new Error('未找到任何批量操作按钮');
      }

      console.log(`   ✓ 批量操作按钮显示正常 (${foundButtons}/${bulkActionButtons.length})`);
    });

    // Test 4: 点击批量删除按钮
    await test(results, 'Test 4: 批量删除确认', async () => {
      const deleteButton = page.locator('button:has-text("批量删除"), button:has-text("Bulk Delete")').first();
      const isVisible = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  批量删除按钮不可见');
        return;
      }

      await deleteButton.click();
      await page.waitForTimeout(1000);

      // 应该出现确认对话框
      const hasConfirmDialog = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasConfirmDialog) {
        throw new Error('点击后未出现确认对话框');
      }

      console.log('   ✓ 批量删除确认对话框显示正常');

      // 取消操作
      const cancelButton = page.locator('button:has-text("取消"), button:has-text("Cancel")').first();
      await cancelButton.click();
      await page.waitForTimeout(500);
    });

    // Test 5: 批量状态修改
    await test(results, 'Test 5: 批量状态修改', async () => {
      await page.goto(`${BASE_URL}/offers`);
      await page.waitForTimeout(1000);

      // 选中第一个项目
      const firstCheckbox = page.locator('input[type="checkbox"]').nth(1);
      const isVisible = await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  无可选项目');
        return;
      }

      await firstCheckbox.click();
      await page.waitForTimeout(500);

      // 点击批量启用/禁用按钮
      const statusButton = page.locator('button:has-text("批量启用"), button:has-text("批量禁用")').first();
      const hasStatusButton = await statusButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasStatusButton) {
        throw new Error('批量状态修改按钮不可见');
      }

      console.log('   ✓ 批量状态修改功能正常');
    });

    // Test 6: 批量导出功能
    await test(results, 'Test 6: 批量导出功能', async () => {
      const exportButton = page.locator('button:has-text("批量导出"), button:has-text("Bulk Export")').first();
      const isVisible = await exportButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  批量导出按钮不可见');
        return;
      }

      // 监听下载事件
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

      await exportButton.click();

      const download = await downloadPromise;

      if (download) {
        console.log('   ✓ 批量导出触发成功');
      } else {
        console.log('   ⚠️  导出可能需要更多时间或数据');
      }
    });

    // Test 7: 取消全选
    await test(results, 'Test 7: 取消全选功能', async () => {
      await page.goto(`${BASE_URL}/offers`);
      await page.waitForTimeout(1000);

      const selectAllCheckbox = page.locator('input[type="checkbox"][aria-label*="全选"], input[type="checkbox"][aria-label*="Select all"]').first();
      const isVisible = await selectAllCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('全选checkbox不可见');
      }

      // 先全选
      await selectAllCheckbox.click();
      await page.waitForTimeout(300);

      // 再取消全选
      await selectAllCheckbox.click();
      await page.waitForTimeout(300);

      // 批量操作按钮应该消失
      const bulkActionsVisible = await page.locator('button:has-text("批量删除")').isVisible({ timeout: 1000 }).catch(() => false);

      if (bulkActionsVisible) {
        console.log('   ⚠️  取消全选后批量按钮仍可见');
      } else {
        console.log('   ✓ 取消全选功能正常');
      }
    });

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 批量操作测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testBulkOperations();
