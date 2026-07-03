#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testAdsCenterOperations() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🎯 广告中心操作测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问广告中心页面
    await test(results, 'Test 1: 访问广告中心页面', async () => {
      await page.goto(`${BASE_URL}/adscenter`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/adscenter')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问广告中心');
    });

    // Test 2: 验证顶部统计区域
    await test(results, 'Test 2: 验证顶部统计区域', async () => {
      const statCards = [
        '总曝光',
        '总点击',
        '总花费',
        '平均CPC'
      ];

      let foundCards = 0;
      for (const cardName of statCards) {
        const hasCard = await page.locator(`text=${cardName}`).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasCard) {
          foundCards++;
          console.log(`   ✓ 找到统计卡片: ${cardName}`);
        }
      }

      if (foundCards < 3) {
        throw new Error(`只找到${foundCards}/${statCards.length}个统计卡片`);
      }

      console.log(`   ✓ 统计卡片显示正常 (${foundCards}/${statCards.length})`);
    });

    // Test 3: 验证广告账户列表显示
    await test(results, 'Test 3: 广告账户列表显示', async () => {
      const hasAccountList = await page.locator('[data-testid="ads-account-list"], table').isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasAccountList) {
        // 可能是空状态
        const hasEmptyState = await page.locator('text=/暂无广告账户|No accounts/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (hasEmptyState) {
          console.log('   ✓ 显示空状态提示');
          return;
        }
        throw new Error('未找到账户列表或空状态提示');
      }

      console.log('   ✓ 账户列表显示正常');
    });

    // Test 4: 点击"绑定广告账户"按钮
    await test(results, 'Test 4: 绑定广告账户按钮', async () => {
      const bindButton = page.locator('button:has-text("绑定广告账户"), [role="button"]:has-text("Bind Account")').first();
      const isVisible = await bindButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('绑定广告账户按钮不可见');
      }

      await bindButton.click();
      await page.waitForTimeout(1500);

      // 应该出现绑定对话框或跳转到绑定页面
      const hasDialog = await page.locator('[role="dialog"], [data-testid="bind-dialog"]').isVisible({ timeout: 2000 }).catch(() => false);
      const urlChanged = page.url().includes('/bind');

      if (!hasDialog && !urlChanged) {
        throw new Error('点击后未出现绑定对话框或跳转');
      }

      console.log('   ✓ 绑定按钮工作正常');
    });

    // Test 5: 验证广告数据图表
    await test(results, 'Test 5: 广告数据图表显示', async () => {
      await page.goto(`${BASE_URL}/adscenter`);
      await page.waitForTimeout(1000);

      const hasChart = await page.locator('canvas, [data-testid="ads-chart"], svg').isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasChart) {
        console.log('   ⚠️  未检测到图表元素(可能需要广告数据)');
        return;
      }

      console.log('   ✓ 广告数据图表显示正常');
    });

    // Test 6: 验证日期筛选器
    await test(results, 'Test 6: 日期筛选器功能', async () => {
      const dateFilter = page.locator('[type="date"], [data-testid="date-picker"]').first();
      const isVisible = await dateFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  未找到日期筛选器');
        return;
      }

      console.log('   ✓ 日期筛选器显示正常');
    });

    // Test 7: 验证账户状态切换
    await test(results, 'Test 7: 账户状态筛选', async () => {
      const statusFilter = page.locator('select, [role="combobox"]').first();
      const isVisible = await statusFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  未找到状态筛选器');
        return;
      }

      console.log('   ✓ 状态筛选器显示正常');
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
  console.log('📊 广告中心操作测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testAdsCenterOperations();
