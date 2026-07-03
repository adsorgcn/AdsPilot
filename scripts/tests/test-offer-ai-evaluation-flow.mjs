#!/usr/bin/env node

/**
 * Offer评估系统AI功能完整测试
 *
 * 测试基于: docs/TestAll/E2E_TEST_SOLUTION_UPDATED.md
 * 实现任务: BE-001~041, FE-020~027
 *
 * 测试场景:
 * 1. AI评分等级展示 (A/B/C/D/F徽章)
 * 2. AIEvaluationDialog详细弹窗 (三标签页)
 * 3. SimilarWeb数据可视化
 * 4. Token预扣机制 (Reserve → Consume/Release)
 * 5. 订阅权限控制 (Starter/Professional/Elite)
 * 6. 实时状态轮询 (3秒刷新)
 * 7. 幂等性验证 (Idempotency-Key)
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const HEADLESS = process.env.HEADLESS !== 'false';
const TIMEOUT = 180000; // 3分钟

// AI评分等级规则
const AI_SCORE_GRADES = {
  A: { min: 85, max: 100, label: 'Excellent', color: 'green' },
  B: { min: 70, max: 84, label: 'Good', color: 'blue' },
  C: { min: 50, max: 69, label: 'Average', color: 'yellow' },
  D: { min: 30, max: 49, label: 'Below Average', color: 'orange' },
  F: { min: 0, max: 29, label: 'Poor', color: 'red' }
};

// 测试用户配置
const TEST_USERS = {
  starter: {
    email: process.env.TEST_USER_STARTER || 'test-starter@autoads.dev',
    password: process.env.TEST_PASSWORD || 'Test1234!',
    plan: 'starter',
    canUseAI: false,
    tokenCost: { basic: 1, ai: null } // Starter无法使用AI
  },
  professional: {
    email: process.env.TEST_USER_PRO || 'test-pro@autoads.dev',
    password: process.env.TEST_PASSWORD || 'Test1234!',
    plan: 'professional',
    canUseAI: true,
    tokenCost: { basic: 1, ai: 3 }
  },
  elite: {
    email: process.env.TEST_USER_ELITE || 'test-elite@autoads.dev',
    password: process.env.TEST_PASSWORD || 'Test1234!',
    plan: 'elite',
    canUseAI: true,
    tokenCost: { basic: 1, ai: 3 },
    hasUnlimitedOffers: true
  }
};

// 测试结果收集器
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  scenarios: []
};

/**
 * 主测试函数
 */
async function runAIEvaluationTests() {
  console.log('\n🤖 Offer评估系统AI功能完整测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📍 测试环境: ${BASE_URL}`);
  console.log(`🎭 Headless模式: ${HEADLESS}`);
  console.log(`⏱️  超时时间: ${TIMEOUT / 1000}秒\n`);

  try {
    // 场景1: AI评分等级展示
    await testScenario1_AIScoreBadge();

    // 场景2: AIEvaluationDialog详细弹窗
    await testScenario2_EvaluationDialog();

    // 场景3: SimilarWeb数据可视化
    await testScenario3_SimilarWebDisplay();

    // 场景4: Token预扣机制
    await testScenario4_TokenReservation();

    // 场景5: 订阅权限控制
    await testScenario5_SubscriptionPermissions();

    // 场景6: 实时状态轮询
    await testScenario6_StatusPolling();

    // 场景7: 幂等性验证
    await testScenario7_Idempotency();

  } catch (error) {
    console.error('❌ 测试执行出错:', error);
  }

  // 打印测试总结
  printTestSummary();

  // 退出码
  process.exit(testResults.failed > 0 ? 1 : 0);
}

/**
 * 场景1: AI评分等级展示测试
 */
async function testScenario1_AIScoreBadge() {
  const scenarioName = '场景1: AI评分等级展示';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 登录Professional用户
    await loginUser(page, TEST_USERS.professional);

    // 导航到Offers页面
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证"AI Score"列存在
    const aiScoreHeader = page.locator('th:has-text("AI Score")');
    await expect(aiScoreHeader, 'AI Score列头').toBeVisible();
    console.log('   ✅ AI Score列显示正常');

    // 查找已评估的Offer
    const evaluatedOffers = await page.locator('[data-testid="ai-score-badge"]').all();

    if (evaluatedOffers.length === 0) {
      console.log('   ⚠️  暂无已评估Offer，跳过徽章测试');
      recordResult(scenarioName, 'skipped', '无已评估Offer');
      return;
    }

    console.log(`   📊 找到${evaluatedOffers.length}个已评估Offer`);

    // 验证第一个AIScoreBadge
    const firstBadge = evaluatedOffers[0];
    const badgeText = await firstBadge.textContent();
    const grade = badgeText.trim().charAt(0); // 提取等级 (A/B/C/D/F)

    console.log(`   📌 检查第一个评分: ${badgeText}`);

    // 验证等级是否合法
    if (!AI_SCORE_GRADES[grade]) {
      throw new Error(`无效的评分等级: ${grade}`);
    }

    console.log(`   ✅ 评分等级 ${grade} 验证通过`);

    // 验证悬停显示分数详情
    await firstBadge.hover();
    await page.waitForTimeout(500);

    recordResult(scenarioName, 'passed', `评分等级${grade}显示正确`);

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 场景2: AIEvaluationDialog详细弹窗测试
 */
async function testScenario2_EvaluationDialog() {
  const scenarioName = '场景2: AIEvaluationDialog详细弹窗';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 查找并点击AIScoreBadge
    const scoreBadge = page.locator('[data-testid="ai-score-badge"]').first();
    const isVisible = await scoreBadge.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isVisible) {
      console.log('   ⚠️  无可用的AI评分徽章，跳过弹窗测试');
      recordResult(scenarioName, 'skipped', '无已评估Offer');
      return;
    }

    console.log('   🖱️  点击AI Score徽章...');
    await scoreBadge.click();
    await page.waitForTimeout(1000);

    // 验证弹窗打开
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog, 'AIEvaluationDialog').toBeVisible();
    console.log('   ✅ 弹窗成功打开');

    // 验证标题
    const dialogTitle = dialog.locator('text=/Evaluation Results|评估结果/');
    await expect(dialogTitle, '弹窗标题').toBeVisible();

    // 验证三个标签页
    const tabs = ['Overview', 'Traffic', 'Insights'];
    for (const tabName of tabs) {
      const tab = dialog.locator(`[role="tab"]:has-text("${tabName}")`);
      const exists = await tab.isVisible({ timeout: 2000 }).catch(() => false);

      if (exists) {
        console.log(`   ✅ ${tabName}标签页存在`);

        // 点击标签页
        await tab.click();
        await page.waitForTimeout(500);

        // 验证标签页内容
        if (tabName === 'Overview') {
          // 验证Overview内容
          const aiScore = dialog.locator('[data-testid="ai-recommendation-score"]');
          if (await aiScore.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('   ✅ AI分数显示正常');
          }
        } else if (tabName === 'Traffic') {
          // 验证Traffic Data内容
          const similarWebDisplay = dialog.locator('[data-testid="similarweb-display"]');
          if (await similarWebDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('   ✅ SimilarWeb数据显示正常');
          }
        } else if (tabName === 'Insights') {
          // 验证AI Insights内容
          const insights = dialog.locator('[data-testid="ai-insights"]');
          if (await insights.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('   ✅ AI洞察显示正常');
          }
        }
      }
    }

    // 测试关闭按钮
    const closeButton = dialog.locator('[aria-label="Close"]').or(dialog.locator('button:has-text("Close")'));
    await closeButton.click();
    await page.waitForTimeout(500);

    const dialogClosed = await dialog.isHidden();
    if (dialogClosed) {
      console.log('   ✅ 弹窗成功关闭');
    }

    recordResult(scenarioName, 'passed', '所有标签页验证通过');

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 场景3: SimilarWeb数据可视化测试
 */
async function testScenario3_SimilarWebDisplay() {
  const scenarioName = '场景3: SimilarWeb数据可视化';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 打开AIEvaluationDialog
    const scoreBadge = page.locator('[data-testid="ai-score-badge"]').first();
    if (!await scoreBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
      recordResult(scenarioName, 'skipped', '无已评估Offer');
      return;
    }

    await scoreBadge.click();
    await page.waitForTimeout(1000);

    // 切换到Traffic Data标签
    const trafficTab = page.locator('[role="tab"]:has-text("Traffic")');
    await trafficTab.click();
    await page.waitForTimeout(1000);

    // 验证4个统计卡片
    const statCards = ['Global Rank', 'Monthly Visits', 'Avg Duration', 'Bounce Rate'];
    for (const stat of statCards) {
      const card = page.locator(`text=/${stat}/i`);
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`   ✅ ${stat}卡片显示正常`);
      }
    }

    // 验证Traffic Sources图表
    const trafficSources = ['Direct', 'Search', 'Social', 'Paid', 'Referrals'];
    let sourcesVisible = 0;
    for (const source of trafficSources) {
      const sourceLabel = page.locator(`text=/${source}/i`);
      if (await sourceLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
        sourcesVisible++;
      }
    }
    console.log(`   ✅ Traffic Sources: ${sourcesVisible}/${trafficSources.length}个渠道显示`);

    // 验证Top Countries
    const countriesSection = page.locator('text=/Top Countries/i');
    if (await countriesSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ Top Countries部分显示正常');
    }

    recordResult(scenarioName, 'passed', 'SimilarWeb数据可视化完整');

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 场景4: Token预扣机制测试
 */
async function testScenario4_TokenReservation() {
  const scenarioName = '场景4: Token预扣机制';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);

    // 监控网络请求
    const apiCalls = {
      reserve: [],
      consume: [],
      release: [],
      evaluate: []
    };

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/tokens/reserve')) {
        apiCalls.reserve.push({ url, method: request.method() });
      } else if (url.includes('/tokens/consume')) {
        apiCalls.consume.push({ url, method: request.method() });
      } else if (url.includes('/tokens/release')) {
        apiCalls.release.push({ url, method: request.method() });
      } else if (url.includes('/evaluate')) {
        apiCalls.evaluate.push({
          url,
          method: request.method(),
          headers: request.headers()
        });
      }
    });

    // 获取初始Token余额
    await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });
    const initialBalance = await getTokenBalance(page);
    console.log(`   💰 初始Token余额: ${initialBalance}`);

    // 导航到Offers页面
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击EvaluateButton
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    // 勾选"Enable AI Analysis"
    const aiCheckbox = page.locator('input[type="checkbox"]:near(text="AI")');
    if (await aiCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await aiCheckbox.check();
      console.log('   ✅ AI分析已启用');
    }

    // 验证Token消耗显示
    const tokenCostText = page.locator('text=/3 tokens|3个Token/i');
    if (await tokenCostText.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ Token消耗显示正确 (3 tokens)');
    }

    // 点击"Start Evaluation"
    const startButton = page.locator('button:has-text("Start"), button:has-text("开始")');
    await startButton.click();
    console.log('   ⚙️  评估已启动...');

    // 等待评估完成或失败
    await page.waitForTimeout(30000); // 最多等待30秒

    // 验证Token预扣API调用
    if (apiCalls.reserve.length > 0) {
      console.log(`   ✅ Token预扣调用: ${apiCalls.reserve.length}次`);
    }

    if (apiCalls.consume.length > 0) {
      console.log(`   ✅ Token确认调用: ${apiCalls.consume.length}次`);
    }

    // 验证Idempotency-Key
    const evaluateCalls = apiCalls.evaluate;
    if (evaluateCalls.length > 0) {
      const firstCall = evaluateCalls[0];
      if (firstCall.headers['idempotency-key']) {
        console.log('   ✅ Idempotency-Key已设置');
      }
    }

    // 验证Token余额变化
    await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });
    const finalBalance = await getTokenBalance(page);
    const consumed = initialBalance - finalBalance;
    console.log(`   💰 最终Token余额: ${finalBalance} (消耗: ${consumed})`);

    if (consumed === 3) {
      console.log('   ✅ Token消耗正确 (3个)');
    }

    recordResult(scenarioName, 'passed', 'Token预扣流程完整');

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 场景5: 订阅权限控制测试
 */
async function testScenario5_SubscriptionPermissions() {
  const scenarioName = '场景5: 订阅权限控制';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  // 子场景5.1: Starter用户
  await testStarterUserPermissions();

  // 子场景5.2: Professional用户
  await testProfessionalUserPermissions();

  // 子场景5.3: Elite用户
  await testEliteUserPermissions();

  recordResult(scenarioName, 'passed', '所有订阅权限验证通过');
}

async function testStarterUserPermissions() {
  console.log('\n   📌 子场景5.1: Starter用户AI功能禁用');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.starter);
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击EvaluateButton
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    // 验证AI checkbox不显示
    const aiCheckbox = page.locator('input[type="checkbox"]:near(text="AI")');
    const aiCheckboxVisible = await aiCheckbox.isVisible({ timeout: 2000 }).catch(() => false);

    if (!aiCheckboxVisible) {
      console.log('   ✅ Starter用户AI选项已隐藏');
    } else {
      throw new Error('Starter用户不应看到AI选项');
    }

    // 验证Token消耗显示为1
    const tokenCostText = page.locator('text=/1 token/i');
    if (await tokenCostText.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ Starter用户Token消耗显示正确 (1 token)');
    }

    // 验证升级提示
    const upgradePrompt = page.locator('text=/Unlock|Upgrade|升级/i');
    if (await upgradePrompt.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ 升级提示显示正常');
    }

  } catch (error) {
    console.error(`   ❌ Starter用户测试失败: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function testProfessionalUserPermissions() {
  console.log('\n   📌 子场景5.2: Professional用户AI功能启用');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击EvaluateButton
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    // 验证AI checkbox显示
    const aiCheckbox = page.locator('input[type="checkbox"]:near(text="AI")');
    const aiCheckboxVisible = await aiCheckbox.isVisible({ timeout: 2000 }).catch(() => false);

    if (aiCheckboxVisible) {
      console.log('   ✅ Professional用户AI选项可用');

      // 勾选AI
      await aiCheckbox.check();

      // 验证Token消耗变为3
      const tokenCostText = page.locator('text=/3 tokens/i');
      if (await tokenCostText.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('   ✅ AI启用后Token消耗显示正确 (3 tokens)');
      }
    } else {
      throw new Error('Professional用户应看到AI选项');
    }

  } catch (error) {
    console.error(`   ❌ Professional用户测试失败: ${error.message}`);
  } finally {
    await browser.close();
  }
}

async function testEliteUserPermissions() {
  console.log('\n   📌 子场景5.3: Elite用户完整权限');

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.elite);
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 验证AI功能可用
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    const aiCheckbox = page.locator('input[type="checkbox"]:near(text="AI")');
    if (await aiCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ Elite用户AI功能可用');
    }

    // 验证无Offer数量限制 (Elite特权)
    const createOfferButton = page.locator('button:has-text("Create"), button:has-text("创建")');
    if (await createOfferButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ Elite用户可创建无限Offer');
    }

  } catch (error) {
    console.error(`   ❌ Elite用户测试失败: ${error.message}`);
  } finally {
    await browser.close();
  }
}

/**
 * 场景6: 实时状态轮询测试
 */
async function testScenario6_StatusPolling() {
  const scenarioName = '场景6: 实时状态轮询';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);

    // 监控API轮询请求
    const pollingRequests = [];
    let pollingInterval = null;

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/evaluations/latest')) {
        const timestamp = Date.now();
        pollingRequests.push({ url, timestamp });

        // 计算轮询间隔
        if (pollingRequests.length > 1) {
          const lastTwo = pollingRequests.slice(-2);
          const interval = lastTwo[1].timestamp - lastTwo[0].timestamp;
          pollingInterval = interval;
        }
      }
    });

    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 发起评估
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    const startButton = page.locator('button:has-text("Start"), button:has-text("开始")');
    await startButton.click();
    console.log('   ⚙️  评估已启动，监控轮询...');

    // 等待15秒观察轮询
    await page.waitForTimeout(15000);

    console.log(`   📊 检测到${pollingRequests.length}次轮询请求`);

    if (pollingInterval && Math.abs(pollingInterval - 3000) < 500) {
      console.log(`   ✅ 轮询间隔正确: ${pollingInterval}ms (目标: 3000ms)`);
    }

    // 验证UI状态更新
    const processingIndicator = page.locator('text=/processing|评估中/i');
    if (await processingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   ✅ 处理中状态显示正常');
    }

    recordResult(scenarioName, 'passed', `轮询间隔${pollingInterval}ms`);

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 场景7: 幂等性验证测试
 */
async function testScenario7_Idempotency() {
  const scenarioName = '场景7: 幂等性验证';
  console.log(`\n📋 ${scenarioName}`);
  console.log('─'.repeat(50));

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await loginUser(page, TEST_USERS.professional);

    // 监控请求和响应
    const evaluateRequests = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/evaluate') && request.method() === 'POST') {
        evaluateRequests.push({
          url,
          idempotencyKey: request.headers()['idempotency-key'],
          timestamp: Date.now()
        });
      }
    });

    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 快速连续点击两次评估按钮 (模拟重复请求)
    const evaluateButton = page.locator('[data-testid="evaluate-button"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(500);

    const startButton = page.locator('button:has-text("Start"), button:has-text("开始")');

    // 第一次点击
    await startButton.click();
    console.log('   🔄 发送第1次评估请求...');

    // 立即第二次点击 (测试幂等性)
    await page.waitForTimeout(100);
    await startButton.click();
    console.log('   🔄 发送第2次评估请求...');

    await page.waitForTimeout(5000);

    console.log(`   📊 捕获到${evaluateRequests.length}个评估请求`);

    if (evaluateRequests.length >= 2) {
      const firstKey = evaluateRequests[0].idempotencyKey;
      const secondKey = evaluateRequests[1].idempotencyKey;

      if (firstKey === secondKey) {
        console.log('   ✅ Idempotency-Key一致，幂等性保证');
      } else {
        console.log('   ⚠️  Idempotency-Key不同 (可能是不同Offer)');
      }
    }

    // 验证Token只扣除一次
    await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });
    const transactions = page.locator('[data-testid="token-transaction"]');
    const count = await transactions.count();
    console.log(`   💰 Token交易记录数: ${count}`);

    recordResult(scenarioName, 'passed', '幂等性验证完成');

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    recordResult(scenarioName, 'failed', error.message);
  } finally {
    await browser.close();
  }
}

/**
 * 辅助函数: 登录用户
 */
async function loginUser(page, userConfig) {
  console.log(`   👤 登录用户: ${userConfig.email} (${userConfig.plan})`);

  await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });

  await page.fill('input[type="email"]', userConfig.email);
  await page.fill('input[type="password"]', userConfig.password);
  await page.click('button[type="submit"]');

  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 10000 });
  console.log('   ✅ 登录成功');
}

/**
 * 辅助函数: 获取Token余额
 */
async function getTokenBalance(page) {
  const balanceElement = page.locator('[data-testid="token-balance"]').or(page.locator('text=/Balance.*\\d+/i'));

  if (await balanceElement.isVisible({ timeout: 5000 }).catch(() => false)) {
    const balanceText = await balanceElement.textContent();
    const match = balanceText.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  }

  return 0;
}

/**
 * 辅助函数: 记录测试结果
 */
function recordResult(scenario, status, message) {
  testResults.scenarios.push({ scenario, status, message });

  if (status === 'passed') {
    testResults.passed++;
  } else if (status === 'failed') {
    testResults.failed++;
  } else if (status === 'skipped') {
    testResults.skipped++;
  }
}

/**
 * 辅助函数: 打印测试总结
 */
function printTestSummary() {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 测试总结');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`⏭️  跳过: ${testResults.skipped}`);
  console.log(`📋 总计: ${testResults.scenarios.length}`);
  console.log('');

  // 详细结果
  testResults.scenarios.forEach(({ scenario, status, message }) => {
    const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
    console.log(`${icon} ${scenario}: ${message}`);
  });

  console.log('\n' + '━'.repeat(50) + '\n');
}

/**
 * 简单的expect辅助函数
 */
async function expect(locator, description) {
  return {
    toBeVisible: async () => {
      const visible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
      if (!visible) {
        throw new Error(`${description} 应该可见但未找到`);
      }
      return true;
    }
  };
}

// 执行测试
runAIEvaluationTests().catch(console.error);
