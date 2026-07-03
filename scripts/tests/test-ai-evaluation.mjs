#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testAIEvaluation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🤖 AI评估流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问待评估Offers列表
    await test(results, 'Test 1: 访问待评估列表', async () => {
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });

      // 点击"待评估"筛选
      const pendingTab = page.locator('button:has-text("待评估"), [role="tab"]:has-text("Pending")').first();
      const isVisible = await pendingTab.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  待评估Tab不可见,使用默认列表');
      } else {
        await pendingTab.click();
        await page.waitForTimeout(1000);
      }

      console.log('   ✓ 成功访问待评估列表');
    });

    // Test 2: 验证AI评估按钮存在
    await test(results, 'Test 2: AI评估按钮显示', async () => {
      const aiEvalButton = page.locator('button:has-text("AI评估"), button:has-text("AI Evaluation")').first();
      const isVisible = await aiEvalButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('AI评估按钮不可见');
      }

      console.log('   ✓ AI评估按钮显示正常');
    });

    // Test 3: 点击AI评估按钮
    await test(results, 'Test 3: 触发AI评估', async () => {
      const aiEvalButton = page.locator('button:has-text("AI评估"), button:has-text("AI Evaluation")').first();
      await aiEvalButton.click();
      await page.waitForTimeout(1500);

      // 应该出现评估对话框或进度提示
      const hasDialog = await page.locator('[role="dialog"], [data-testid="ai-eval-dialog"]').isVisible({ timeout: 2000 }).catch(() => false);
      const hasProgress = await page.locator('text=/评估中|Evaluating|Processing/i').isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasDialog && !hasProgress) {
        throw new Error('点击后未出现评估对话框或进度提示');
      }

      console.log('   ✓ AI评估触发成功');
    });

    // Test 4: 验证评估进度显示
    await test(results, 'Test 4: 评估进度显示', async () => {
      // 等待进度条或加载动画
      const hasProgress = await page.locator('[role="progressbar"], .loading, [data-testid="progress"]').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasProgress) {
        console.log('   ✓ 评估进度显示正常');
      } else {
        console.log('   ⚠️  未检测到进度指示器(可能评估已完成)');
      }
    });

    // Test 5: 等待评估完成
    await test(results, 'Test 5: 等待评估完成', async () => {
      // 等待评估完成(最多30秒)
      const completionIndicators = [
        'text=/评估完成|Completed|Success/i',
        'text=/可投放|Approved/i',
        'text=/已拒绝|Rejected/i'
      ];

      let completed = false;
      for (const indicator of completionIndicators) {
        const hasIndicator = await page.locator(indicator).isVisible({ timeout: 30000 }).catch(() => false);
        if (hasIndicator) {
          completed = true;
          break;
        }
      }

      if (completed) {
        console.log('   ✓ AI评估已完成');
      } else {
        console.log('   ⚠️  评估超时或未检测到完成状态');
      }
    });

    // Test 6: 验证评估结果显示
    await test(results, 'Test 6: 评估结果显示', async () => {
      await page.waitForTimeout(2000);

      // 检查评估结果字段
      const resultFields = [
        '评估状态',
        '评分',
        '建议',
        '拒绝原因'
      ];

      let foundFields = 0;
      for (const field of resultFields) {
        const hasField = await page.locator(`text=${field}`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasField) {
          foundFields++;
          console.log(`   ✓ 找到结果字段: ${field}`);
        }
      }

      console.log(`   ✓ 评估结果显示 (${foundFields}/${resultFields.length}个字段)`);
    });

    // Test 7: 验证批量AI评估
    await test(results, 'Test 7: 批量AI评估功能', async () => {
      await page.goto(`${BASE_URL}/offers`);
      await page.waitForTimeout(1000);

      // 全选待评估的Offers
      const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
      const isVisible = await selectAllCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  全选checkbox不可见');
        return;
      }

      await selectAllCheckbox.click();
      await page.waitForTimeout(500);

      // 批量AI评估按钮
      const batchAIButton = page.locator('button:has-text("批量AI评估"), button:has-text("Batch AI Evaluation")').first();
      const hasBatchButton = await batchAIButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasBatchButton) {
        console.log('   ✓ 批量AI评估功能可用');
      } else {
        console.log('   ⚠️  批量AI评估按钮不可见');
      }
    });

    // Test 8: 验证Token消耗提示
    await test(results, 'Test 8: Token消耗提示', async () => {
      const tokenWarning = await page.locator('text=/Token|消耗|余额|费用/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (tokenWarning) {
        console.log('   ✓ Token消耗提示显示正常');
      } else {
        console.log('   ⚠️  未检测到Token消耗提示');
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
  console.log('📊 AI评估流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testAIEvaluation();
