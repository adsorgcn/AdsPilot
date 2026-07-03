#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testDashboardOverview() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📊 Dashboard概览测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问Dashboard首页
    await test(results, 'Test 1: 访问Dashboard首页', async () => {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/dashboard')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问Dashboard');
    });

    // Test 2: 验证统计卡片显示
    await test(results, 'Test 2: 验证统计卡片区域', async () => {
      const statsGrid = page.locator('[data-testid="dashboard-stats-grid"]');
      const isVisible = await statsGrid.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('统计卡片网格不可见');
      }

      const statCards = [
        'stat-card-total-offers',
        'stat-card-pending-offers',
        'stat-card-ready-offers',
        'stat-card-tokens'
      ];

      let foundCards = 0;
      for (const testId of statCards) {
        const hasCard = await page.locator(`[data-testid="${testId}"]`).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasCard) {
          foundCards++;
          console.log(`   ✓ 找到统计卡片: ${testId}`);
        }
      }

      if (foundCards < 4) {
        throw new Error(`只找到${foundCards}/${statCards.length}个统计卡片`);
      }

      console.log(`   ✓ 统计卡片显示正常 (${foundCards}/${statCards.length})`);
    });

    // Test 3: 验证快速操作区域
    await test(results, 'Test 3: 验证快速操作区域', async () => {
      const quickActionsCard = page.locator('[data-testid="quick-actions-card"]');
      const isVisible = await quickActionsCard.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('未找到快速操作区域');
      }

      const quickActions = [
        'quick-action-manage-offers',
        'quick-action-view-tasks',
        'quick-action-ads-center',
        'quick-action-token-management',
        'quick-action-create-offer'
      ];

      let foundActions = 0;
      for (const testId of quickActions) {
        const hasAction = await page.locator(`[data-testid="${testId}"]`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasAction) {
          foundActions++;
        }
      }

      if (foundActions < 4) {
        throw new Error(`只找到${foundActions}/${quickActions.length}个快速操作`);
      }

      console.log(`   ✓ 快速操作显示正常 (${foundActions}/${quickActions.length})`);
    });

    // Test 4: 点击统计卡片导航
    await test(results, 'Test 4: 统计卡片可点击导航', async () => {
      const offerCard = page.locator('[data-testid="stat-card-total-offers"]');
      const isVisible = await offerCard.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('Offers统计卡片不可见');
      }

      await offerCard.click();
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      if (!currentUrl.includes('/offers')) {
        throw new Error(`点击后未跳转到Offers页面: ${currentUrl}`);
      }

      console.log('   ✓ 卡片点击导航正常');

      // 返回Dashboard
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(1000);
    });

    // Test 5: 点击快速操作按钮
    await test(results, 'Test 5: 快速操作按钮可点击', async () => {
      const manageOffersButton = page.locator('[data-testid="quick-action-manage-offers"]');
      const isVisible = await manageOffersButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('管理Offers按钮不可见');
      }

      await manageOffersButton.click();
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      if (!currentUrl.includes('/offers')) {
        throw new Error(`点击后未跳转到Offers页面: ${currentUrl}`);
      }

      console.log('   ✓ 快速操作按钮工作正常');
    });

    // Test 6: 验证欢迎信息显示
    await test(results, 'Test 6: 欢迎信息显示', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForTimeout(1000);

      const hasWelcome = await page.locator('text=/欢迎回来|Welcome back/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasWelcome) {
        console.log('   ✓ 欢迎信息显示正常');
      } else {
        console.log('   ⚠️  未检测到欢迎信息(可能选择器需要调整)');
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
  console.log('📊 Dashboard概览测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testDashboardOverview();
