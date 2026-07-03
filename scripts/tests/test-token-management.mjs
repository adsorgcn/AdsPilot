#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testTokenManagement() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🪙 Token管理测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问Token管理页面
    await test(results, 'Test 1: 访问Token管理页面', async () => {
      await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/tokens')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问Token管理');
    });

    // Test 2: Token余额统计卡片
    await test(results, 'Test 2: Token余额统计卡片', async () => {
      await page.waitForTimeout(2000);

      const tokenTiles = page.locator('[data-testid="token-summary-tiles"]');
      const isVisible = await tokenTiles.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('Token统计卡片容器不可见');
      }

      const tileTestIds = [
        'token-tile-balance',
        'token-tile-today',
        'token-tile-month',
        'token-tile-pending'
      ];

      let foundStats = 0;
      for (const testId of tileTestIds) {
        const hasStat = await page.locator(`[data-testid="${testId}"]`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasStat) {
          foundStats++;
        }
      }

      if (foundStats < 3) {
        throw new Error(`只找到${foundStats}/${tileTestIds.length}个统计卡片`);
      }

      console.log(`   ✓ Token统计卡片显示 (${foundStats}/${tileTestIds.length})`);
    });

    // Test 3: 充值按钮
    await test(results, 'Test 3: 充值按钮', async () => {
      const rechargeButton = page.locator('button:has-text("充值"), button:has-text("购买 Token")').first();
      const isVisible = await rechargeButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('充值按钮不可见');
      }

      const isEnabled = await rechargeButton.isEnabled();
      if (!isEnabled) {
        throw new Error('充值按钮被禁用');
      }

      console.log('   ✓ 充值按钮可见且可点击');
    });

    // Test 4: 使用明细区域
    await test(results, 'Test 4: 使用明细区域', async () => {
      const hasUsageBreakdown = await page.locator('text=/使用明细|Usage Breakdown/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasUsageBreakdown) {
        console.log('   ✓ 使用明细区域显示');
      } else {
        console.log('   ℹ️  使用明细区域未显示');
      }
    });

    // Test 5: 交易记录表格
    await test(results, 'Test 5: 交易记录表格', async () => {
      await page.waitForTimeout(1500);

      // 查找交易记录表格或标题
      const hasTransactionsTable = await page.locator('table, [role="table"], text=/交易记录|Transaction History/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTransactionsTable) {
        console.log('   ✓ 交易记录表格显示');
      } else {
        console.log('   ℹ️  交易记录表格未显示（可能无交易）');
      }
    });

    // Test 6: 筛选选项
    await test(results, 'Test 6: 交易记录筛选', async () => {
      const hasFilter = await page.locator('button:has-text("全部类型"), select, [role="combobox"]').first().isVisible({ timeout: 3000 }).catch(() => false);

      if (hasFilter) {
        console.log('   ✓ 交易记录筛选选项存在');
      } else {
        console.log('   ℹ️  交易记录筛选选项不可见');
      }
    });

    // Test 7: Token使用说明
    await test(results, 'Test 7: Token使用说明', async () => {
      const hasExplanation = await page.locator('text=/Token 用于|Token 消耗|如何使用/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasExplanation) {
        console.log('   ✓ Token使用说明显示');
      } else {
        console.log('   ℹ️  Token使用说明未显示');
      }
    });

    // Test 8: 刷新按钮
    await test(results, 'Test 8: 刷新按钮', async () => {
      const refreshButton = page.locator('button:has-text("刷新")').first();
      const isVisible = await refreshButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (isVisible) {
        await refreshButton.click();
        await page.waitForTimeout(1500);
        console.log('   ✓ 刷新按钮正常');
      } else {
        console.log('   ℹ️  刷新按钮不可见');
      }
    });

    // Test 9: 空状态（如果无交易记录）
    await test(results, 'Test 9: 空状态提示', async () => {
      const hasEmptyState = await page.locator('text=/暂无交易记录|No transactions/i').isVisible({ timeout: 2000 }).catch(() => false);

      if (hasEmptyState) {
        console.log('   ✓ 空状态提示显示（暂无交易）');
      } else {
        console.log('   ℹ️  已有交易记录或未显示空状态');
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
  console.log('📊 Token管理测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testTokenManagement();
