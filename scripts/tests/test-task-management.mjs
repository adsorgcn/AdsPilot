#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testTaskManagement() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📋 任务管理测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问任务列表页面
    await test(results, 'Test 1: 访问任务列表页面', async () => {
      await page.goto(`${BASE_URL}/tasks`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/tasks')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问任务列表');
    });

    // Test 2: 验证任务状态筛选器
    await test(results, 'Test 2: 任务状态筛选器', async () => {
      const statusTabs = [
        '全部',
        '待处理',
        '进行中',
        '已完成'
      ];

      let foundTabs = 0;
      for (const tabName of statusTabs) {
        const hasTab = await page.locator(`text=${tabName}`).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasTab) {
          foundTabs++;
          console.log(`   ✓ 找到状态Tab: ${tabName}`);
        }
      }

      if (foundTabs < 3) {
        throw new Error(`只找到${foundTabs}/${statusTabs.length}个状态Tab`);
      }

      console.log(`   ✓ 状态筛选器显示正常 (${foundTabs}/${statusTabs.length})`);
    });

    // Test 3: 验证任务列表显示
    await test(results, 'Test 3: 任务列表显示', async () => {
      const hasTaskList = await page.locator('[data-testid="task-list"], table').isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasTaskList) {
        // 可能是空状态
        const hasEmptyState = await page.locator('text=/暂无任务|No tasks/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (hasEmptyState) {
          console.log('   ✓ 显示空状态提示');
          return;
        }
        throw new Error('未找到任务列表或空状态提示');
      }

      console.log('   ✓ 任务列表显示正常');
    });

    // Test 4: 点击"新建任务"按钮
    await test(results, 'Test 4: 新建任务按钮', async () => {
      const createButton = page.locator('button:has-text("新建任务"), [role="button"]:has-text("Create Task")').first();
      const isVisible = await createButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('新建任务按钮不可见');
      }

      await createButton.click();
      await page.waitForTimeout(1500);

      // 应该出现创建对话框或跳转到创建页面
      const hasDialog = await page.locator('[role="dialog"], [data-testid="create-task-dialog"]').isVisible({ timeout: 2000 }).catch(() => false);
      const urlChanged = page.url().includes('/create');

      if (!hasDialog && !urlChanged) {
        throw new Error('点击后未出现创建对话框或跳转');
      }

      console.log('   ✓ 新建任务按钮工作正常');
    });

    // Test 5: 验证任务类型筛选
    await test(results, 'Test 5: 任务类型筛选', async () => {
      await page.goto(`${BASE_URL}/tasks`);
      await page.waitForTimeout(1000);

      const typeFilter = page.locator('select, [role="combobox"]').first();
      const isVisible = await typeFilter.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  未找到任务类型筛选器');
        return;
      }

      console.log('   ✓ 任务类型筛选器显示正常');
    });

    // Test 6: 验证任务搜索功能
    await test(results, 'Test 6: 任务搜索功能', async () => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="Search"]').first();
      const isVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  未找到搜索框');
        return;
      }

      console.log('   ✓ 搜索框显示正常');
    });

    // Test 7: 验证任务详情查看
    await test(results, 'Test 7: 任务详情查看', async () => {
      const firstTask = page.locator('[data-testid="task-item"], tr').nth(1);
      const isVisible = await firstTask.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  无任务可点击');
        return;
      }

      await firstTask.click();
      await page.waitForTimeout(1500);

      // 应该出现详情对话框或跳转到详情页面
      const hasDialog = await page.locator('[role="dialog"], [data-testid="task-detail"]').isVisible({ timeout: 2000 }).catch(() => false);
      const urlChanged = page.url().includes('/tasks/');

      if (!hasDialog && !urlChanged) {
        throw new Error('点击后未出现详情对话框或跳转');
      }

      console.log('   ✓ 任务详情查看正常');
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
  console.log('📊 任务管理测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testTaskManagement();
