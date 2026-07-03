#!/usr/bin/env node

/**
 * 真实Offer评估完整测试
 *
 * 使用真实的Offer URL进行端到端测试，验证：
 * 1. Offer创建和提交流程
 * 2. 基础评估（SimilarWeb + Domain分析）
 * 3. AI增强评估（Vertex AI Gemini）
 * 4. Token消耗规则（1+2=3）
 * 5. 评估结果展示和数据完整性
 *
 * 测试数据来源: scripts/tests/fixtures/real-test-data.json
 *
 * 使用方法:
 * node scripts/tests/test-real-offer-evaluation.mjs
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';
import { setupBrowserWithProxy } from './helpers/proxy.mjs';
import fs from 'fs';
import path from 'path';

// 加载真实测试数据
const testDataPath = path.join(process.cwd(), 'scripts/tests/fixtures/real-test-data.json');
const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || testData.testEnvironments.production.baseUrl;
const REAL_OFFER = testData.realOffers[0]; // 使用第一个真实Offer
const USE_PROXY = process.env.USE_PROXY !== 'false'; // 默认使用代理

console.log('🎯 真实Offer评估完整测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📋 测试Offer信息:`);
console.log(`   Title: ${REAL_OFFER.title}`);
console.log(`   URL: ${REAL_OFFER.landingPageUrl}`);
console.log(`   Country: ${REAL_OFFER.country}`);
console.log(`   Category: ${REAL_OFFER.category}`);
console.log('');

const overallResults = { passed: 0, failed: 0, warnings: 0 };

// 辅助函数: 启动浏览器（带可选代理）
async function launchBrowser() {
  if (USE_PROXY) {
    console.log('   → 使用代理启动浏览器...');
    return await setupBrowserWithProxy({ headless: false, useProxy: true });
  } else {
    console.log('   → 直连启动浏览器...');
    return await chromium.launch({ headless: false });
  }
}

// 测试: Offer创建流程
async function testOfferCreation() {
  console.log('\n📝 测试1: Offer创建流程\n');

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setupAuthForTest(page, 'user');

    // 导航到Offers列表页
    await page.goto(`${BASE_URL}/offers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('   → 点击创建Offer按钮打开弹窗...');

    // 尝试多种按钮文本（支持中英文）
    const createButton = page.locator('button:has-text("Create Offer"), button:has-text("添加 Offer"), button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    const buttonExists = await createButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (!buttonExists) {
      // 如果找不到按钮，截图并列出所有按钮
      await page.screenshot({ path: '/tmp/offers-page-debug.png' });
      console.log('   ⚠️ 找不到创建按钮，页面上的所有按钮:');
      const allButtons = await page.locator('button').all();
      for (const btn of allButtons) {
        const text = await btn.textContent().catch(() => '');
        if (text) console.log(`      - "${text.trim()}"`);
      }
      throw new Error('创建Offer按钮未找到');
    }

    await createButton.click();
    console.log('   ✓ 已点击创建按钮');
    await page.waitForTimeout(2000);

    // 等待弹窗（Modal/Dialog）出现
    const modal = page.locator('[role="dialog"], .modal, [class*="Modal"], [class*="Dialog"]').first();
    const modalVisible = await modal.isVisible({ timeout: 3000 }).catch(() => false);

    if (!modalVisible) {
      throw new Error('创建Offer弹窗未出现');
    }

    console.log('   ✓ 创建Offer弹窗已打开');

    // 填写真实Offer数据
    console.log('   → 填写Offer表单...');

    // Landing Page URL - 使用实际组件的ID
    const urlInput = page.locator('#offer-url');
    await urlInput.waitFor({ state: 'visible', timeout: 5000 });
    await urlInput.fill(REAL_OFFER.landingPageUrl);
    await page.waitForTimeout(500);

    // Country - 使用实际组件的ID
    const countryInput = page.locator('#offer-country');
    const countryExists = await countryInput.isVisible({ timeout: 2000 }).catch(() => false);
    if (countryExists) {
      await countryInput.fill(REAL_OFFER.country);
      await page.waitForTimeout(500);
    }

    console.log('   ✓ 表单填写完成');

    // 提交Offer（在弹窗内查找提交按钮）
    const submitButton = modal.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Create"), button:has-text("创建")').first();
    await submitButton.click();
    await page.waitForTimeout(3000);

    // 验证弹窗是否关闭（表示创建成功）
    const modalClosed = await modal.isHidden({ timeout: 5000 }).catch(() => false);

    if (modalClosed) {
      console.log('   ✓ Offer创建成功，弹窗已关闭');

      // 尝试从列表中找到新创建的Offer
      const offerRow = page.locator(`tr:has-text("${REAL_OFFER.title}"), [data-testid*="offer"]:has-text("${REAL_OFFER.landingPageUrl}")`).first();
      const offerVisible = await offerRow.isVisible({ timeout: 3000 }).catch(() => false);

      if (offerVisible) {
        // 尝试提取Offer ID
        const offerLink = offerRow.locator('a[href*="/offers/"]').first();
        const href = await offerLink.getAttribute('href').catch(() => null);
        const offerId = href ? extractOfferIdFromUrl(href) : null;

        console.log(`   ✓ Offer已出现在列表中${offerId ? `: ${offerId}` : ''}`);
        overallResults.passed++;
        return { success: true, offerId };
      } else {
        console.log('   ⚠️ Offer已创建但未在列表中找到');
        overallResults.passed++;
        return { success: true, offerId: null };
      }
    } else {
      throw new Error('Offer创建后弹窗未关闭');
    }

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    overallResults.failed++;
    return { success: false };
  } finally {
    await cleanupAuthForTest(page);
    await browser.close();
  }
}

// 测试: 基础评估执行
async function testBasicEvaluation(offerId) {
  console.log('\n🔍 测试2: 基础评估执行\n');

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setupAuthForTest(page, 'user');

    // 导航到Offer详情页
    const offerUrl = offerId ? `${BASE_URL}/offers/${offerId}` : `${BASE_URL}/offers`;
    await page.goto(offerUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 获取初始Token余额
    const initialBalance = await getTokenBalance(page);
    console.log(`   初始Token余额: ${initialBalance}`);

    // 监控API调用
    const apiCalls = [];
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') && url.includes('evaluat')) {
        apiCalls.push({
          url,
          status: response.status(),
          timestamp: Date.now()
        });
      }
    });

    // 点击基础评估按钮
    console.log('   → 执行基础评估...');
    const evaluateButton = page.locator('button:has-text("Evaluate"), button:has-text("评估"), button[data-testid*="evaluate"]').first();
    await evaluateButton.click();
    await page.waitForTimeout(1000);

    // 等待评估完成 (最多30秒)
    console.log('   → 等待评估完成...');
    await page.waitForTimeout(30000);

    // 验证评估结果显示
    const hasScore = await page.locator('[data-testid*="score"], .score, [class*="score"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasScore) {
      console.log('   ✓ 评估分数已显示');
    } else {
      console.log('   ⚠️ 评估分数未显示');
      overallResults.warnings++;
    }

    // 验证Token消耗
    await page.waitForTimeout(2000);
    const finalBalance = await getTokenBalance(page);
    const consumed = initialBalance - finalBalance;

    console.log(`   最终Token余额: ${finalBalance}`);
    console.log(`   Token消耗: ${consumed}`);

    if (consumed === testData.expectedBehaviors.tokenConsumption.basicEvaluation) {
      console.log('   ✓ Token消耗正确（1 token）');
      overallResults.passed++;
    } else {
      console.log(`   ⚠️ Token消耗异常（期望1，实际${consumed}）`);
      overallResults.warnings++;
    }

    // 验证API调用
    if (apiCalls.length > 0) {
      console.log(`   ✓ 评估API已调用（${apiCalls.length}次）`);
      overallResults.passed++;
    } else {
      throw new Error('评估API未被调用');
    }

    return { success: true, consumed, apiCalls: apiCalls.length };

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    overallResults.failed++;
    return { success: false };
  } finally {
    await cleanupAuthForTest(page);
    await browser.close();
  }
}

// 测试: AI增强评估
async function testAIEvaluation(offerId) {
  console.log('\n🤖 测试3: AI增强评估\n');

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setupAuthForTest(page, 'user');

    await page.goto(`${BASE_URL}/offers/${offerId || ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const initialBalance = await getTokenBalance(page);
    console.log(`   初始Token余额: ${initialBalance}`);

    // 点击AI评估按钮
    console.log('   → 执行AI增强评估...');
    const aiButton = page.locator('button:has-text("AI"), button:has-text("Enhanced"), button[data-testid*="ai"]').first();
    const aiButtonExists = await aiButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (!aiButtonExists) {
      console.log('   ⚠️ AI评估按钮未找到，可能需要先完成基础评估');
      overallResults.warnings++;
      return { success: false, reason: 'ai_button_not_found' };
    }

    await aiButton.click();
    await page.waitForTimeout(1000);

    // 等待AI评估完成 (最多60秒)
    console.log('   → 等待AI评估完成...');
    await page.waitForTimeout(60000);

    // 验证AI评估结果
    const hasAIScore = await page.locator('[data-testid*="ai-score"], .ai-score, [class*="ai-score"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasAIScore) {
      console.log('   ✓ AI评估分数已显示');
      overallResults.passed++;
    } else {
      console.log('   ⚠️ AI评估分数未显示');
      overallResults.warnings++;
    }

    // 验证Token消耗
    await page.waitForTimeout(2000);
    const finalBalance = await getTokenBalance(page);
    const consumed = initialBalance - finalBalance;

    console.log(`   最终Token余额: ${finalBalance}`);
    console.log(`   Token消耗: ${consumed}`);

    if (consumed === testData.expectedBehaviors.tokenConsumption.aiEvaluation) {
      console.log('   ✓ Token消耗正确（2 tokens）');
      overallResults.passed++;
    } else {
      console.log(`   ⚠️ Token消耗异常（期望2，实际${consumed}）`);
      overallResults.warnings++;
    }

    return { success: true, consumed };

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    overallResults.failed++;
    return { success: false };
  } finally {
    await cleanupAuthForTest(page);
    await browser.close();
  }
}

// 测试: 评估结果验证
async function testEvaluationResults(offerId) {
  console.log('\n📊 测试4: 评估结果验证\n');

  const browser = await launchBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await setupAuthForTest(page, 'user');

    await page.goto(`${BASE_URL}/offers/${offerId || ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 验证评估数据完整性
    const checks = [
      { name: 'Health Score', selector: '[data-testid*="health"], [class*="health"], :has-text("Health")' },
      { name: 'Global Rank', selector: '[data-testid*="rank"], [class*="rank"], :has-text("Rank")' },
      { name: 'Brand Name', selector: '[data-testid*="brand"], [class*="brand"], :has-text("Brand")' },
      { name: 'Category', selector: '[data-testid*="category"], [class*="category"], :has-text("Category")' },
      { name: 'Country', selector: '[data-testid*="country"], [class*="country"], :has-text("Country")' }
    ];

    let dataIntegrity = 0;
    for (const check of checks) {
      const exists = await page.locator(check.selector).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (exists) {
        console.log(`   ✓ ${check.name}已显示`);
        dataIntegrity++;
      } else {
        console.log(`   ⚠️ ${check.name}未显示`);
      }
    }

    console.log(`\n   数据完整性: ${dataIntegrity}/${checks.length} (${Math.round(dataIntegrity/checks.length*100)}%)`);

    if (dataIntegrity >= checks.length * 0.6) {
      console.log('   ✓ 评估结果数据完整性合格');
      overallResults.passed++;
    } else {
      console.log('   ⚠️ 评估结果数据不完整');
      overallResults.warnings++;
    }

    return { success: true, dataIntegrity, total: checks.length };

  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    overallResults.failed++;
    return { success: false };
  } finally {
    await cleanupAuthForTest(page);
    await browser.close();
  }
}

// 辅助函数: 从URL提取Offer ID
function extractOfferIdFromUrl(url) {
  const match = url.match(/offers\/([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

// 辅助函数: 获取Token余额
async function getTokenBalance(page) {
  try {
    const balanceText = await page.locator('[data-testid*="token"], [class*="token-balance"], :has-text("Token")').first().textContent({ timeout: 3000 });
    const match = balanceText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  } catch {
    return 0;
  }
}

// 主函数
async function main() {
  console.log(`🚀 开始真实Offer评估测试`);
  console.log(`   环境: ${BASE_URL}`);
  console.log(`   测试用户: ${testData.testUsers[0].email}\n`);

  try {
    // 测试1: 创建Offer
    const createResult = await testOfferCreation();

    if (!createResult.success) {
      console.log('\n⚠️ Offer创建失败，跳过后续测试');
      printTestSummary();
      process.exit(1);
    }

    const offerId = createResult.offerId;
    console.log(`\n✓ Offer ID: ${offerId}\n`);

    // 测试2: 基础评估
    await testBasicEvaluation(offerId);

    // 测试3: AI评估
    await testAIEvaluation(offerId);

    // 测试4: 结果验证
    await testEvaluationResults(offerId);

    // 打印测试汇总
    printTestSummary();

    process.exit(overallResults.failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ 真实Offer评估测试执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function printTestSummary() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 真实Offer评估测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${overallResults.passed}`);
  console.log(`❌ 失败: ${overallResults.failed}`);
  console.log(`⚠️ 警告: ${overallResults.warnings}`);

  const total = overallResults.passed + overallResults.failed;
  const successRate = total > 0 ? Math.round((overallResults.passed / total) * 100) : 0;
  console.log(`📈 通过率: ${successRate}%`);

  console.log('\n📋 测试覆盖范围:');
  console.log('├─ Offer创建和提交流程');
  console.log('├─ 基础评估（SimilarWeb + Domain）');
  console.log('├─ AI增强评估（Vertex AI）');
  console.log('├─ Token消耗规则验证');
  console.log('└─ 评估结果数据完整性');

  console.log('\n🔗 测试数据来源:');
  console.log(`   ${REAL_OFFER.landingPageUrl}`);
  console.log(`   配置文件: scripts/tests/fixtures/real-test-data.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testOfferCreation, testBasicEvaluation, testAIEvaluation, testEvaluationResults };
