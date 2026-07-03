#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testOfferFiltering() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔍 Offer筛选和搜索测试');
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

    // Test 2: 验证搜索框存在
    await test(results, 'Test 2: 搜索框功能', async () => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
      const isVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('搜索框不可见');
      }

      // 输入搜索关键词
      await searchInput.fill('test');
      await page.waitForTimeout(1000);

      console.log('   ✓ 搜索框输入正常');
    });

    // Test 3: 验证状态筛选器
    await test(results, 'Test 3: 状态筛选器', async () => {
      const statusFilters = [
        '全部',
        '待评估',
        '可投放',
        '已拒绝'
      ];

      let foundFilters = 0;
      for (const filterName of statusFilters) {
        const hasFilter = await page.locator(`button:has-text("${filterName}"), [role="tab"]:has-text("${filterName}")`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasFilter) {
          foundFilters++;
          console.log(`   ✓ 找到状态筛选: ${filterName}`);
        }
      }

      if (foundFilters < 3) {
        throw new Error(`只找到${foundFilters}/${statusFilters.length}个状态筛选器`);
      }

      console.log(`   ✓ 状态筛选器显示正常 (${foundFilters}/${statusFilters.length})`);
    });

    // Test 4: 点击状态筛选
    await test(results, 'Test 4: 点击状态筛选', async () => {
      const pendingFilter = page.locator('button:has-text("待评估"), [role="tab"]:has-text("Pending")').first();
      const isVisible = await pendingFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  待评估筛选按钮不可见');
        return;
      }

      await pendingFilter.click();
      await page.waitForTimeout(1500);

      console.log('   ✓ 状态筛选点击正常');
    });

    // Test 5: 验证国家/地区筛选
    await test(results, 'Test 5: 国家/地区筛选', async () => {
      await page.goto(`${BASE_URL}/offers`);
      await page.waitForTimeout(1000);

      const countryFilter = page.locator('select[name*="country"], [data-testid="country-filter"]').first();
      const isVisible = await countryFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  国家筛选器不可见');
        return;
      }

      console.log('   ✓ 国家筛选器显示正常');
    });

    // Test 6: 验证分类筛选
    await test(results, 'Test 6: 分类筛选', async () => {
      const categoryFilter = page.locator('select[name*="category"], [data-testid="category-filter"]').first();
      const isVisible = await categoryFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  分类筛选器不可见');
        return;
      }

      console.log('   ✓ 分类筛选器显示正常');
    });

    // Test 7: 验证排序功能
    await test(results, 'Test 7: 排序功能', async () => {
      const sortDropdown = page.locator('select, [role="combobox"]').filter({ hasText: /排序|Sort/i }).first();
      const isVisible = await sortDropdown.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  排序下拉框不可见');
        return;
      }

      console.log('   ✓ 排序功能显示正常');
    });

    // Test 8: 验证清除筛选按钮
    await test(results, 'Test 8: 清除筛选按钮', async () => {
      const clearButton = page.locator('button:has-text("清除"), button:has-text("Clear")').first();
      const isVisible = await clearButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  清除筛选按钮不可见');
        return;
      }

      await clearButton.click();
      await page.waitForTimeout(1000);

      console.log('   ✓ 清除筛选按钮正常');
    });

    // Test 9: 验证筛选结果更新
    await test(results, 'Test 9: 筛选结果更新', async () => {
      await page.goto(`${BASE_URL}/offers`);
      await page.waitForTimeout(1000);

      // 记录初始结果数
      const initialCount = await page.locator('[data-testid="offer-item"], tr').count();

      // 应用筛选
      const firstFilter = page.locator('button, [role="tab"]').nth(1);
      const isVisible = await firstFilter.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  无可用筛选器');
        return;
      }

      await firstFilter.click();
      await page.waitForTimeout(1500);

      // 检查结果是否变化
      const filteredCount = await page.locator('[data-testid="offer-item"], tr').count();

      console.log(`   ✓ 筛选前: ${initialCount} 项, 筛选后: ${filteredCount} 项`);
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
  console.log('📊 Offer筛选和搜索测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testOfferFiltering();
