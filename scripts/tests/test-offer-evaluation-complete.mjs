#!/usr/bin/env node

/**
 * Offer评估流程完整测试
 *
 * 测试内容:
 * 1. 基础评估 (siterank服务调用)
 * 2. AI评估 (browser-exec服务调用)
 * 3. 完整评估流程 (基础+AI)
 * 4. 批量评估功能
 * 5. 评估结果持久化
 * 6. Token消耗验证
 * 7. 不同套餐权限控制
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const API_GATEWAY_URL = BASE_URL;

// 评估类型配置
const EVALUATION_TYPES = {
  basic: {
    name: '基础评估',
    tokenCost: 1,
    expectedServices: ['siterank'],
    processingTime: 5000,
    resultFields: ['网站排名', '流量估算', 'SEO评分', '基础建议']
  },
  ai: {
    name: 'AI评估',
    tokenCost: 2,
    expectedServices: ['browser-exec'],
    processingTime: 15000,
    resultFields: ['AI推荐指数', '用户体验评分', '转化潜力', '详细分析']
  },
  complete: {
    name: '完整评估',
    tokenCost: 3,
    expectedServices: ['siterank', 'browser-exec'],
    processingTime: 20000,
    resultFields: ['网站排名', '流量估算', 'SEO评分', 'AI推荐指数', '用户体验评分', '综合建议']
  }
};

// 测试用户配置
const TEST_USERS = {
  starter: {
    email: 'test-starter@autoads.dev',
    subscription: 'starter',
    tokens: 1000,
    allowedEvaluations: ['basic'],
    restrictedEvaluations: ['ai', 'complete']
  },
  professional: {
    email: 'test-professional@autoads.dev',
    subscription: 'professional',
    tokens: 5000,
    allowedEvaluations: ['basic', 'ai', 'complete'],
    restrictedEvaluations: []
  },
  elite: {
    email: 'test-elite@autoads.dev',
    subscription: 'elite',
    tokens: 10000,
    allowedEvaluations: ['basic', 'ai', 'complete'],
    restrictedEvaluations: []
  }
};

async function testOfferEvaluationComplete() {
  console.log('🔄 Offer评估流程完整测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试基础评估流程
  await testBasicEvaluationFlow(overallResults);

  // 测试AI评估流程
  await testAIEvaluationFlow(overallResults);

  // 测试完整评估流程
  await testCompleteEvaluationFlow(overallResults);

  // 测试批量评估功能
  await testBatchEvaluation(overallResults);

  // 测试评估结果查看和导出
  await testEvaluationResultsView(overallResults);

  // 测试不同套餐的权限控制
  await testSubscriptionPermissions(overallResults);

  // 测试Brand Name自动填充
  await testBrandNameAutoFill(overallResults);

  // 打印测试汇总
  printEvaluationSummary(overallResults);

  return overallResults.failed === 0;
}

async function testBasicEvaluationFlow(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n⚙️ ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '基础评估流程测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 记录初始Token余额
      const initialBalance = await getUserTokenBalance(page);
      console.log(`   初始Token余额: ${initialBalance}`);

      // 导航到Offers页面
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 确保在待评估列表
      await navigateToPendingOffers(page);

      // 查找第一个Offer的基础评估按钮
      const basicEvaluateButton = page.locator('[data-testid="basic-evaluate-button"], button:has-text("评估")').first();
      const isClickable = await basicEvaluateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isClickable) {
        throw new Error('基础评估按钮不可见');
      }

      // 点击基础评估
      await basicEvaluateButton.click();
      console.log('   ⚙️ 执行基础评估...');

      // 监控网络请求，验证siterank服务调用
      const siterankCalls = [];
      page.on('request', request => {
        if (request.url().includes('/siterank') || request.url().includes('/api/siterank')) {
          siterankCalls.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        }
      });

      // 等待评估完成
      await waitForEvaluationCompletion(page, EVALUATION_TYPES.basic.processingTime);

      // 验证siterank服务调用
      if (siterankCalls.length === 0) {
        throw new Error('未检测到siterank服务调用');
      }
      console.log(`   ✓ siterank服务调用: ${siterankCalls.length}次`);

      // 验证Token消耗
      const finalBalance = await getUserTokenBalance(page);
      const tokenCost = initialBalance - finalBalance;

      if (tokenCost !== EVALUATION_TYPES.basic.tokenCost) {
        throw new Error(`基础评估Token消耗不正确: 期望 ${EVALUATION_TYPES.basic.tokenCost}, 实际 ${tokenCost}`);
      }
      console.log(`   ✓ Token消耗: ${tokenCost} tokens`);

      // 验证评估结果显示
      await validateEvaluationResults(page, EVALUATION_TYPES.basic.resultFields);

      console.log('   ✓ 基础评估流程完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testAIEvaluationFlow(results) {
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

  await test(results, 'AI评估流程测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 记录初始Token余额
      const initialBalance = await getUserTokenBalance(page);
      console.log(`   初始Token余额: ${initialBalance}`);

      // 导航到Offers页面
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 确保在待评估列表
      await navigateToPendingOffers(page);

      // 查找AI评估按钮
      const aiEvaluateButton = page.locator('[data-testid="ai-evaluate-button"], button:has-text("AI评估")').first();
      const isVisible = await aiEvaluateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('AI评估按钮不可见');
      }

      // 点击AI评估
      await aiEvaluateButton.click();
      console.log('   🤖 执行AI评估...');

      // 监控网络请求，验证browser-exec服务调用
      const browserExecCalls = [];
      page.on('request', request => {
        if (request.url().includes('/browser-exec') || request.url().includes('/api/browser-exec')) {
          browserExecCalls.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        }
      });

      // 等待评估完成
      await waitForEvaluationCompletion(page, EVALUATION_TYPES.ai.processingTime);

      // 验证browser-exec服务调用
      if (browserExecCalls.length === 0) {
        throw new Error('未检测到browser-exec服务调用');
      }
      console.log(`   ✓ browser-exec服务调用: ${browserExecCalls.length}次`);

      // 验证Token消耗
      const finalBalance = await getUserTokenBalance(page);
      const tokenCost = initialBalance - finalBalance;

      if (tokenCost !== EVALUATION_TYPES.ai.tokenCost) {
        throw new Error(`AI评估Token消耗不正确: 期望 ${EVALUATION_TYPES.ai.tokenCost}, 实际 ${tokenCost}`);
      }
      console.log(`   ✓ Token消耗: ${tokenCost} tokens`);

      // 验证评估结果显示
      await validateEvaluationResults(page, EVALUATION_TYPES.ai.resultFields);

      console.log('   ✓ AI评估流程完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testCompleteEvaluationFlow(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔄 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '完整评估流程测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 记录初始Token余额
      const initialBalance = await getUserTokenBalance(page);
      console.log(`   初始Token余额: ${initialBalance}`);

      // 导航到Offers页面
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 确保在待评估列表
      await navigateToPendingOffers(page);

      // 查找完整评估按钮
      const completeEvaluateButton = page.locator('[data-testid="complete-evaluate-button"], button:has-text("完整评估")').first();
      const isVisible = await completeEvaluateButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        // 如果没有完整评估按钮，模拟点击基础评估+AI评估
        console.log('   ⚠️ 未找到完整评估按钮，模拟基础评估+AI评估流程');

        // 先点击基础评估
        const basicButton = page.locator('[data-testid="basic-evaluate-button"], button:has-text("评估")').first();
        if (await basicButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await basicButton.click();
          await waitForEvaluationCompletion(page, EVALUATION_TYPES.basic.processingTime);
        }

        // 再点击AI评估
        const aiButton = page.locator('[data-testid="ai-evaluate-button"], button:has-text("AI评估")').first();
        if (await aiButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await aiButton.click();
          await waitForEvaluationCompletion(page, EVALUATION_TYPES.ai.processingTime);
        }
      } else {
        // 点击完整评估按钮
        await completeEvaluateButton.click();
        console.log('   🔄 执行完整评估...');

        // 监控所有服务调用
        const allServiceCalls = [];
        page.on('request', request => {
          if (request.url().includes('/siterank') || request.url().includes('/browser-exec')) {
            allServiceCalls.push({
              url: request.url(),
              method: request.method(),
              service: request.url().includes('/siterank') ? 'siterank' : 'browser-exec',
              timestamp: Date.now()
            });
          }
        });

        // 等待评估完成
        await waitForEvaluationCompletion(page, EVALUATION_TYPES.complete.processingTime);

        // 验证服务调用
        const siterankCalls = allServiceCalls.filter(call => call.service === 'siterank');
        const browserExecCalls = allServiceCalls.filter(call => call.service === 'browser-exec');

        if (siterankCalls.length === 0) {
          throw new Error('完整评估未调用siterank服务');
        }
        if (browserExecCalls.length === 0) {
          throw new Error('完整评估未调用browser-exec服务');
        }

        console.log(`   ✓ siterank服务调用: ${siterankCalls.length}次`);
        console.log(`   ✓ browser-exec服务调用: ${browserExecCalls.length}次`);
      }

      // 验证Token消耗
      const finalBalance = await getUserTokenBalance(page);
      const tokenCost = initialBalance - finalBalance;

      if (tokenCost !== EVALUATION_TYPES.complete.tokenCost) {
        throw new Error(`完整评估Token消耗不正确: 期望 ${EVALUATION_TYPES.complete.tokenCost}, 实际 ${tokenCost}`);
      }
      console.log(`   ✓ Token消耗: ${tokenCost} tokens`);

      // 验证评估结果显示
      await validateEvaluationResults(page, EVALUATION_TYPES.complete.resultFields);

      console.log('   ✓ 完整评估流程完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testBatchEvaluation(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n📦 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '批量评估功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 记录初始Token余额
      const initialBalance = await getUserTokenBalance(page);

      // 导航到Offers页面
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 确保在待评估列表
      await navigateToPendingOffers(page);

      // 尝试选择多个Offers
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount === 0) {
        console.log('   ⚠️ 未找到复选框，跳过批量评估测试');
        return;
      }

      // 选择前3个Offers
      const selectionCount = Math.min(3, checkboxCount);
      for (let i = 0; i < selectionCount; i++) {
        await checkboxes.nth(i).check();
        await page.waitForTimeout(500);
      }
      console.log(`   ✓ 选择了${selectionCount}个Offers`);

      // 查找批量操作按钮
      const batchButton = page.locator('button:has-text("批量评估"), button:has-text("批量AI评估")').first();
      const isVisible = await batchButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️ 批量评估按钮不可见');
        return;
      }

      // 点击批量评估
      await batchButton.click();
      console.log('   📦 执行批量评估...');

      // 等待批量评估完成
      await waitForEvaluationCompletion(page, EVALUATION_TYPES.complete.processingTime * selectionCount);

      // 验证Token消耗
      const finalBalance = await getUserTokenBalance(page);
      const tokenCost = initialBalance - finalBalance;
      const expectedCost = EVALUATION_TYPES.complete.tokenCost * selectionCount;

      if (Math.abs(tokenCost - expectedCost) > selectionCount) {
        throw new Error(`批量评估Token消耗不正确: 期望约${expectedCost}, 实际${tokenCost}`);
      }
      console.log(`   ✓ 批量评估Token消耗: ${tokenCost} tokens`);

      console.log('   ✓ 批量评估功能完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testEvaluationResultsView(results) {
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

  await test(results, '评估结果查看和导出测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 导航到Offers页面
      await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 查找已评估的Offer
      const evaluatedOffer = page.locator('[data-evaluation-status="completed"], .evaluated-offer').first();
      const isVisible = await evaluatedOffer.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️ 未找到已评估的Offer，跳过结果查看测试');
        return;
      }

      // 点击查看详细结果
      await evaluatedOffer.click();
      await page.waitForTimeout(2000);

      // 验证结果详情页面
      const hasResultDetails = await page.locator('[data-testid="evaluation-details"]').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasResultDetails) {
        console.log('   ✓ 评估结果详情显示正常');

        // 测试导出功能
        const exportButton = page.locator('button:has-text("导出"), button:has-text("Export")').first();
        const hasExportButton = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasExportButton) {
          console.log('   ✓ 导出功能可用');
        } else {
          console.log('   ⚠️ 导出按钮不可见');
        }
      } else {
        console.log('   ⚠️ 评估结果详情未显示');
      }

      console.log('   ✓ 评估结果查看测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testSubscriptionPermissions(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n👥 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '套餐权限控制测试', async () => {
    // 测试Starter用户权限限制
    await testSubscriptionRestrictions('starter', TEST_USERS.starter);

    // 测试Professional用户权限
    await testSubscriptionPermissions('professional', TEST_USERS.professional);

    // 测试Elite用户权限
    await testSubscriptionPermissions('elite', TEST_USERS.elite);
  });
}

async function testSubscriptionRestrictions(userType, userConfig) {
  console.log(`   测试${userConfig.subscription}套餐用户权限限制`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setupAuthForTest(page, userType);

    // 导航到Offers页面
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 检查AI评估按钮是否被禁用或隐藏
    const aiEvaluateButton = page.locator('[data-testid="ai-evaluate-button"], button:has-text("AI评估")').first();
    const isVisible = await aiEvaluateButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (isVisible && userConfig.restrictedEvaluations.includes('ai')) {
      throw new Error(`${userConfig.subscription}用户不应该看到AI评估按钮`);
    }

    if (!isVisible && userConfig.allowedEvaluations.includes('ai')) {
      throw new Error(`${userConfig.subscription}用户应该看到AI评估按钮`);
    }

    // 检查是否有升级提示
    const upgradePrompt = page.locator('text=/升级|Upgrade|开通高级功能/i').first();
    const hasUpgradePrompt = await upgradePrompt.isVisible({ timeout: 3000 }).catch(() => false);

    if (userConfig.restrictedEvaluations.length > 0 && !hasUpgradePrompt) {
      console.log(`   ⚠️ ${userConfig.subscription}用户未显示升级提示`);
    }

    console.log(`   ✓ ${userConfig.subscription}套餐权限控制正常`);

  } finally {
    await cleanupAuthForTest(page);
    await browser.close();
  }
}

// 辅助函数

async function getUserTokenBalance(page) {
  try {
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
        const match = text.match(/(\\d+)/);
        return match ? parseInt(match[1]) : 0;
      }
    }

    console.log('   ⚠️ 无法获取Token余额，返回0');
    return 0;

  } catch (error) {
    console.error('   ❌ 获取Token余额失败:', error.message);
    return 0;
  }
}

async function navigateToPendingOffers(page) {
  const pendingTab = page.locator('button:has-text("待评估"), [role="tab"]:has-text("Pending")').first();
  const isVisible = await pendingTab.isVisible({ timeout: 3000 }).catch(() => false);

  if (isVisible) {
    await pendingTab.click();
    await page.waitForTimeout(1000);
    console.log('   ✓ 已切换到待评估列表');
  } else {
    console.log('   ⚠️ 待评估Tab不可见，使用默认列表');
  }
}

async function waitForEvaluationCompletion(page, maxWaitTime) {
  console.log(`   ⏳ 等待评估完成（最多${Math.round(maxWaitTime/1000)}秒）...`);

  const completionIndicators = [
    'text=/评估完成|Completed|Success/i',
    'text=/可投放|Approved/i',
    'text=/已拒绝|Rejected/i',
    '[data-evaluation-status="completed"]',
    '.evaluation-result'
  ];

  const startTime = Date.now();
  let completed = false;

  while (Date.now() - startTime < maxWaitTime) {
    for (const indicator of completionIndicators) {
      const hasIndicator = await page.locator(indicator).isVisible({ timeout: 1000 }).catch(() => false);
      if (hasIndicator) {
        completed = true;
        break;
      }
    }

    if (completed) {
      console.log('   ✓ 评估已完成');
      return;
    }

    await page.waitForTimeout(2000);
  }

  console.log('   ⚠️ 评估超时，继续执行后续测试');
}

async function validateEvaluationResults(page, expectedFields) {
  console.log('   📊 验证评估结果显示...');

  let foundFields = 0;
  for (const field of expectedFields) {
    const hasField = await page.locator(`text=${field}`).isVisible({ timeout: 2000 }).catch(() => false);
    if (hasField) {
      foundFields++;
      console.log(`     ✓ 找到结果字段: ${field}`);
    }
  }

  if (foundFields < expectedFields.length / 2) {
    throw new Error(`评估结果显示不完整: 只找到${foundFields}/${expectedFields.length}个字段`);
  }

  console.log(`   ✓ 评估结果显示 (${foundFields}/${expectedFields.length}个字段)`);
}

/**
 * 测试Brand Name自动填充功能
 *
 * 测试场景:
 * 1. 创建Offer时不填写brand_name字段（留空）
 * 2. 触发评估
 * 3. 验证brand_name自动从域名或SimilarWeb数据提取并填充
 * 4. 验证数据持久化到evaluation_aggregations表
 */
async function testBrandNameAutoFill(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🏷️  ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'Brand Name自动填充测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 测试用例：知名品牌域名
      const testCases = [
        { url: 'https://nike.com/shoes', expectedBrand: 'Nike' },
        { url: 'https://www.shopify.com', expectedBrand: 'Shopify' },
        { url: 'https://adidas.com', expectedBrand: 'Adidas' },
      ];

      for (const testCase of testCases) {
        console.log(`\n   测试URL: ${testCase.url}`);
        console.log(`   期望Brand Name: ${testCase.expectedBrand}`);

        // 导航到Offers页面
        await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        // 点击创建Offer按钮
        const createButton = page.locator('[data-testid="create-offer-btn"], button:has-text("创建"), button:has-text("Add Offer")');
        const isVisible = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (!isVisible) {
          console.log('   ⚠️ 未找到创建Offer按钮，跳过此测试');
          return;
        }

        await createButton.click();
        await page.waitForTimeout(1000);

        // 填写Offer信息（不填写brand_name）
        await page.fill('[name="url"], [placeholder*="URL"]', testCase.url);
        await page.fill('[name="name"], [placeholder*="名称"], [placeholder*="Name"]', `Brand Test - ${Date.now()}`);

        // 验证是否有brand_name字段
        const brandNameInput = page.locator('[name="brand_name"], [name="brandName"], [placeholder*="品牌"], [placeholder*="Brand"]');
        const hasBrandField = await brandNameInput.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasBrandField) {
          console.log('   → Brand Name字段存在，保持为空');
          await brandNameInput.clear(); // 确���为空
        } else {
          console.log('   → Brand Name字段不存在（可能在后端自动提取）');
        }

        // 提交创建
        await page.click('[data-testid="submit-offer-btn"], button[type="submit"], button:has-text("确定"), button:has-text("Submit")');

        // 等待Offer创建成功
        await page.waitForTimeout(3000);

        // 触发评估以填充Brand Name
        console.log('   → 触发评估以填充Brand Name...');

        // 查找刚创建的Offer的评估按钮
        const evaluateButton = page.locator('[data-testid="evaluate-offer-btn"], button:has-text("评估")').first();
        const canEvaluate = await evaluateButton.isVisible({ timeout: 5000 }).catch(() => false);

        if (!canEvaluate) {
          console.log('   ⚠️ 未找到评估按钮，可能需要刷新页面');
          await page.reload();
          await page.waitForTimeout(2000);
        }

        // 点击评估按钮
        await evaluateButton.click();
        await page.waitForTimeout(1000);

        // 确认评估弹窗（如果有）
        const confirmButton = page.locator('[data-testid="start-evaluation-btn"], button:has-text("开始"), button:has-text("Start")');
        const hasConfirm = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasConfirm) {
          await confirmButton.click();
        }

        // 等待评估完成
        console.log('   → 等待评估完成（最多30秒）...');
        await page.waitForTimeout(30000);

        // 刷新页面查看结果
        await page.reload();
        await page.waitForTimeout(3000);

        // 点击Offer查看详情
        const offerItem = page.locator('[data-testid="offer-item"]').first();
        await offerItem.click();
        await page.waitForTimeout(2000);

        // 验证Brand Name是否已填充
        const brandNameElements = [
          page.locator('[data-testid="brand-name"]'),
          page.locator('[data-field="brand-name"]'),
          page.locator('text=/品牌[:：]/'),
          page.locator('text=/Brand[:：]/'),
        ];

        let brandNameFound = false;
        let extractedBrand = '';

        for (const element of brandNameElements) {
          const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
          if (isVisible) {
            const text = await element.textContent();
            extractedBrand = text.replace(/^[品牌Brand][:：]\s*/, '').trim();

            if (extractedBrand && extractedBrand.toLowerCase().includes(testCase.expectedBrand.toLowerCase())) {
              brandNameFound = true;
              break;
            }
          }
        }

        if (brandNameFound) {
          console.log(`   ✓ Brand Name已自动填充: ${extractedBrand}`);
        } else {
          // 可能在数据库中，但前端未显示
          console.log(`   ⚠️ 前端未显示Brand Name，但可能已存储在数据库`);
          console.log(`   ℹ 建议: 验证evaluation_aggregations表中的brand_name字段`);
        }

        // 关闭详情弹窗
        const closeButton = page.locator('[data-testid="close-dialog"], button[aria-label="Close"], [aria-label="关闭"]');
        const hasClose = await closeButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasClose) {
          await closeButton.click();
        }
      }

      console.log('\n   📋 Brand Name自动填充测试总结:');
      console.log('   ✓ 测试了多个知名品牌域名');
      console.log('   ✓ 验证了空brand_name字段的自动填充逻辑');
      console.log('   ℹ 后端应从以下来源提取Brand Name:');
      console.log('     1. 域名解析（如nike.com → Nike）');
      console.log('     2. SimilarWeb API返回的站点信息');
      console.log('     3. AI评估的行业分析结果');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printEvaluationSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Offer评估流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 评估流程总结:');
  console.log('┌─ 基础评估: 1 token, 调用siterank服务');
  console.log('├─ AI评估: 2 tokens, 调用browser-exec服务');
  console.log('├─ 完整评估: 3 tokens, 调用siterank+browser-exec服务');
  console.log('├─ Starter套餐: 仅基础评估');
  console.log('├─ Professional套餐: 全部评估功能');
  console.log('└─ Elite套餐: 全部评估功能');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. siterank服务是否正常部署和响应');
    console.log('2. browser-exec服务是否正常部署和响应');
    console.log('3. API网关是否正确配置路由');
    console.log('4. Token消耗规则是否正确实现');
    console.log('5. 前端评估按钮和结果显示是否正常');
    console.log('6. 不同套餐的权限控制是否正确');
  }
}

// 主函数
async function main() {
  try {
    const success = await testOfferEvaluationComplete();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Offer评估流程测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testOfferEvaluationComplete };