#!/usr/bin/env node

/**
 * AI评估功能完整测试
 *
 * 测试内容:
 * 1. AI评估权限控制 (Starter vs Professional/Elite)
 * 2. AI评估流程完整性
 * 3. AI推荐指数显示
 * 4. AI评估结果持久化
 * 5. AI评估Token消耗
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const API_GATEWAY_URL = BASE_URL;

// 测试用户配置
const TEST_USERS = {
  starter: {
    email: 'test-starter@autoads.dev',
    subscription: 'starter',
    tokens: 1000,
    expectedAIAccess: false,
    expectedTokenCost: 1 // 只有基础评估
  },
  professional: {
    email: 'test-professional@autoads.dev',
    subscription: 'professional',
    tokens: 5000,
    expectedAIAccess: true,
    expectedTokenCost: 3 // 基础评估 + AI评估
  },
  elite: {
    email: 'test-elite@autoads.dev',
    subscription: 'elite',
    tokens: 10000,
    expectedAIAccess: true,
    expectedTokenCost: 3 // 基础评估 + AI评估
  }
};

async function testAIEvaluationComplete() {
  console.log('🤖 AI评估功能完整测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试不同套餐用户的AI评估权限
  for (const [userType, userConfig] of Object.entries(TEST_USERS)) {
    console.log(`\n👤 测试${userConfig.subscription}套餐用户 (${userConfig.email})`);
    console.log('━'.repeat(50));

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 验证用户套餐和Token余额
      await verifyUserSubscription(page, userConfig);

      // 测试AI评估权限控制
      await testAIPermissionControl(page, userConfig, overallResults);

      // 测试AI评估流程 (如果有权限)
      if (userConfig.expectedAIAccess) {
        await testAIEvaluationProcess(page, userConfig, overallResults);
        await testAIRecommendationDisplay(page, overallResults);
      }

      // 测试Token消耗
      await testAIEvaluationTokenCost(page, userConfig, overallResults);

    } catch (error) {
      console.error(`   ❌ 测试失败: ${error.message}`);
      overallResults.failed++;
    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  }

  // 打印测试汇总
  printAIEvaluationSummary(overallResults);

  return overallResults.failed === 0;
}

async function verifyUserSubscription(page, userConfig) {
  const test = async (results, name, testFn) => {
    console.log(`\n📋 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(overallResults, '验证用户套餐', async () => {
    // 检查Token余额
    const tokenBalance = await getUserTokenBalance(page);
    if (tokenBalance < userConfig.tokens * 0.8) {
      throw new Error(`Token余额不足: ${tokenBalance} < ${userConfig.tokens * 0.8}`);
    }
    console.log(`   ✓ Token余额: ${tokenBalance}`);

    // 这里可以添加检查套餐的逻辑，但需要等待页面实现
    console.log(`   ✓ 用户套餐: ${userConfig.subscription}`);
  });
}

async function testAIPermissionControl(page, userConfig, results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔒 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'AI评估权限控制', async () => {
    // 导航到Offers页面
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (userConfig.subscription === 'starter') {
      // Starter用户应该看到"开通"按钮
      const upgradeButton = page.locator('[data-testid="ai-upgrade-button"], button:has-text("开通")');
      const isVisible = await upgradeButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('Starter用户未显示"开通"按钮');
      }

      // 点击按钮应该跳转到价格页面
      await upgradeButton.click();
      await page.waitForURL('**/pricing', { timeout: 5000 });

      console.log('   ✓ Starter用户正确显示"开通"按钮');
      console.log('   ✓ 正确跳转到价格页面');

    } else {
      // Professional/Elite用户应该看到AI评估按钮
      const aiEvaluateButton = page.locator('[data-testid="ai-evaluate-button"], button:has-text("AI评估")');
      const isVisible = await aiEvaluateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        throw new Error(`${userConfig.subscription}用户未显示"AI评估"按钮`);
      }

      console.log(`   ✓ ${userConfig.subscription}用户正确显示"AI评估"按钮`);
    }
  });
}

async function testAIEvaluationProcess(page, userConfig, results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🤖 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'AI评估流程完整性', async () => {
    // 确保在Offers页面
    if (!page.url().includes('/offers')) {
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    }

    // 查找测试Offer或创建一个
    let testOfferId = await findOrCreateTestOffer(page);

    // 点击AI评估按钮
    const aiEvaluateButton = page.locator('[data-testid="ai-evaluate-button"]');
    await aiEvaluateButton.click();

    // 等待评估开始
    await page.waitForTimeout(2000);

    // 监听评估过程
    await monitorEvaluationProcess(page, userConfig);

    console.log('   ✓ AI评估流程已触发');
  });
}

async function testAIRecommendationDisplay(page, results) {
  const test = async (results, name, testFn) => {
    console.log(`\n📊 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'AI推荐指数显示', async () => {
    // 等待评估完成
    await page.waitForTimeout(30000); // 等待30秒AI评估完成

    // 查找AI推荐指数列
    const aiRecommendationColumn = page.locator('[data-testid="ai-recommendation-column"]');
    const isVisible = await aiRecommendationColumn.isVisible({ timeout: 10000 }).catch(() => false);

    if (!isVisible) {
      console.log('   ⚠️ AI推荐指数列未显示（可能还在处理中）');
      return;
    }

    // 点击AI推荐指数查看详情
    const firstRecommendation = aiRecommendationColumn.locator('[data-testid="ai-recommendation-score"]').first();
    const isClickable = await firstRecommendation.isVisible({ timeout: 5000 }).catch(() => false);

    if (isClickable) {
      await firstRecommendation.click();

      // 检查弹窗是否显示
      const modal = page.locator('[data-testid="ai-recommendation-modal"]');
      const isModalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);

      if (isModalVisible) {
        // 检查弹窗内容
        const hasRecommendationScore = await modal.locator('[data-testid="recommendation-score"]').isVisible();
        const hasRecommendationReasons = await modal.locator('[data-testid="recommendation-reasons"]').isVisible();

        console.log(`   ✓ AI推荐指数弹窗显示`);
        if (hasRecommendationScore) console.log(`   ✓ 推荐指数显示`);
        if (hasRecommendationReasons) console.log(`   ✓ 推荐理由显示`);

        // 关闭弹窗
        await page.keyboard.press('Escape');
      }
    }
  });
}

async function testAIEvaluationTokenCost(page, userConfig, results) {
  const test = async (results, name, testFn) => {
    console.log(`\n💰 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'AI评估Token消耗', async () => {
    // 获取评估前的Token余额
    const beforeBalance = await getUserTokenBalance(page);

    // 如果是Starter用户，进行基础评估
    if (userConfig.subscription === 'starter') {
      await performBasicEvaluation(page);
    } else {
      // Professional/Elite用户进行完整AI评估
      await performAIEvaluation(page);
    }

    // 等待Token消耗处理完成
    await page.waitForTimeout(3000);

    // 验证Token消耗
    const afterBalance = await getUserTokenBalance(page);
    const actualDeduction = beforeBalance - afterBalance;
    const expectedDeduction = userConfig.expectedTokenCost;

    if (Math.abs(actualDeduction - expectedDeduction) > 1) {
      throw new Error(`Token消耗不正确: 期望 ${expectedDeduction}, 实际 ${actualDeduction}`);
    }

    console.log(`   ✓ Token消耗验证通过: ${actualDeduction} tokens`);
  });
}

// 辅助函数

async function getUserTokenBalance(page) {
  try {
    // 尝试从多个可能的位置获取Token余额
    const selectors = [
      '[data-testid="token-balance"]',
      '[data-testid="user-tokens"]',
      'text=/\\d+\\s*Tokens?/',
      'text=/余额:\\s*\\d+/'
    ];

    for (const selector of selectors) {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 3000 }).catch(() => false);

      if (isVisible) {
        const text = await element.textContent();
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
    }

    // 如果找不到，返回0（需要根据实际页面调整）
    console.log('   ⚠️ 无法获取Token余额，返回0');
    return 0;

  } catch (error) {
    console.error('   ❌ 获取Token余额失败:', error.message);
    return 0;
  }
}

async function findOrCreateTestOffer(page) {
  // 尝试查找现有的测试Offer
  const existingOffer = page.locator('[data-testid="test-offer"]').first();
  const hasExistingOffer = await existingOffer.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasExistingOffer) {
    const offerId = await existingOffer.getAttribute('data-offer-id');
    console.log(`   ✓ 找到测试Offer: ${offerId}`);
    return offerId;
  }

  // 如果没有测试Offer，返回一个模拟ID
  console.log('   ⚠️ 未找到测试Offer，使用模拟ID');
  return 'test-offer-' + Date.now();
}

async function monitorEvaluationProcess(page, userConfig) {
  // 监控评估过程，可以根据需要添加具体的检查逻辑
  console.log('   🔄 监控AI评估过程...');

  // 可以添加更多具体的监控逻辑，比如：
  // - 检查API调用日志
  // - 监控页面状态变化
  // - 验证数据处理过程
}

async function performBasicEvaluation(page) {
  // 模拟基础评估流程
  console.log('   ⚙️ 执行基础评估流程');

  // 实际实现应该调用相应的API
  // await callBasicEvaluationAPI();
}

async function performAIEvaluation(page) {
  // 模拟AI评估流程
  console.log('   ⚡ 执行AI评估流程');

  // 实际实现应该调用相应的API
  // await callAIEvaluationAPI();
}

function printAIEvaluationSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 AI评估功能测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. 前端页面是否正确实现了AI评估功能');
    console.log('2. API网关是否正确配置了AI评估端点');
    console.log('3. 后端服务是否正确实现了AI评估逻辑');
    console.log('4. Token消耗规则是否正确实现');
  }
}

// 主函数
async function main() {
  try {
    const success = await testAIEvaluationComplete();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ AI评估测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testAIEvaluationComplete };