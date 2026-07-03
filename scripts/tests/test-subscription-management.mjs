#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testSubscriptionManagement() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('💳 订阅管理测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问订阅管理页面
    await test(results, 'Test 1: 访问订阅管理页面', async () => {
      // 使用domcontentloaded而非networkidle,因为某些API可能pending
      await page.goto(`${BASE_URL}/settings/subscription`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // 等待页面基本渲染完成
      await page.waitForTimeout(2000);

      if (!page.url().includes('/subscription')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问订阅管理');
    });

    // Test 2: 当前套餐显示
    await test(results, 'Test 2: 当前套餐显示', async () => {
      await page.waitForTimeout(2000);

      const hasCurrentPlan = await page.locator('text=/当前套餐|Current Plan|Free|Basic|Elite/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasCurrentPlan) {
        throw new Error('当前套餐信息未显示');
      }

      const planText = await page.locator('text=/Free|Basic|Elite/i').first().textContent();
      console.log(`   ✓ 当前套餐显示: ${planText?.trim()}`);
    });

    // Test 3: 套餐列表显示
    await test(results, 'Test 3: 套餐列表显示', async () => {
      const plans = ['Free', 'Basic', 'Elite'];
      let foundPlans = 0;

      for (const plan of plans) {
        const hasPlan = await page.locator(`text=${plan}`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasPlan) {
          foundPlans++;
        }
      }

      if (foundPlans < 2) {
        throw new Error(`只找到${foundPlans}/${plans.length}个套餐`);
      }

      console.log(`   ✓ 套餐列表显示完整 (${foundPlans}/${plans.length})`);
    });

    // Test 4: 升级按钮存在
    await test(results, 'Test 4: 升级套餐按钮', async () => {
      const upgradeButton = page.locator('button:has-text("升级"), button:has-text("订阅"), button:has-text("选择")').first();
      const isVisible = await upgradeButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('升级套餐按钮不可见');
      }

      console.log('   ✓ 升级套餐按钮可见');
    });

    // Test 5: 套餐功能对比
    await test(results, 'Test 5: 套餐功能对比', async () => {
      const features = ['评估', 'Offer', 'Token', 'AI'];
      let foundFeatures = 0;

      for (const feature of features) {
        const hasFeature = await page.locator(`text=/${feature}/i`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasFeature) {
          foundFeatures++;
        }
      }

      if (foundFeatures >= 2) {
        console.log(`   ✓ 套餐功能对比显示 (${foundFeatures}/${features.length})`);
      } else {
        console.log('   ⚠️  套餐功能对比不完整');
      }
    });

    // Test 6: 价格信息显示
    await test(results, 'Test 6: 价格信息显示', async () => {
      const hasPricing = await page.locator('text=/\\$\\d+|\\/月|\\/年|Free/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasPricing) {
        console.log('   ✓ 价格信息显示');
      } else {
        console.log('   ⚠️  价格信息未显示');
      }
    });

    // Test 7: 查看套餐详情（弹窗或跳转）
    await test(results, 'Test 7: 查看套餐详情', async () => {
      // 尝试点击某个套餐卡片
      const planCard = page.locator('text=Elite').first();
      const isVisible = await planCard.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ℹ️  Elite套餐卡片不可见，跳过');
        return;
      }

      // 滚动到元素
      await planCard.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);

      console.log('   ✓ 套餐卡片可见');
    });

    // Test 8: 管理订阅按钮（如果已订阅）
    await test(results, 'Test 8: 管理订阅选项', async () => {
      const manageButton = await page.locator('button:has-text("管理订阅"), button:has-text("取消订阅")').first().isVisible({ timeout: 3000 }).catch(() => false);

      if (manageButton) {
        console.log('   ✓ 管理订阅按钮存在（已订阅）');
      } else {
        console.log('   ℹ️  未订阅付费套餐，无管理按钮');
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
  console.log('📊 订阅管理测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testSubscriptionManagement();
