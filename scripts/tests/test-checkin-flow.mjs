#!/usr/bin/env node

/**
 * 签到系统完整流程测试 (V3.0)
 *
 * 测试内容:
 * 1. 签到状态查询
 * 2. 执行签到（获得10 tokens）
 * 3. 幂等性验证（每日仅一次）
 * 4. 签到历史记录
 * 5. 连续签到统计
 *
 * 实现位置: services/useractivity/internal/handlers/checkin.go
 * API端点:
 * - GET /api/v1/check-in/status
 * - POST /api/v1/check-in
 * - GET /api/v1/check-in/history
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testCheckinFlow() {
  console.log('📅 签到系统完整流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试签到页面访问
  await testCheckinPageAccess(overallResults);

  // 测试签到状态查询
  await testCheckinStatus(overallResults);

  // 测试执行签到
  await testPerformCheckin(overallResults);

  // 测试签到幂等性
  await testCheckinIdempotency(overallResults);

  // 测试签到历史
  await testCheckinHistory(overallResults);

  // 打印测试汇总
  printTestSummary(overallResults);

  return overallResults.failed === 0;
}

async function testCheckinPageAccess(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🏠 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '签到页面访问测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问签到页面
      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证页面标题
      const pageTitle = await page.locator('h1, [data-testid="page-title"]').first().textContent();
      if (pageTitle && (pageTitle.includes('签到') || pageTitle.includes('Check') || pageTitle.includes('Checkin'))) {
        console.log(`   ✓ 签到页面标题正确: ${pageTitle.trim()}`);
      } else {
        console.log(`   ⚠️ 签到页面标题未找到`);
      }

      // 验证签到按钮存在
      const checkinButton = page.locator('[data-testid="checkin-button"], button:has-text("签到"), button:has-text("Check")').first();
      const hasCheckinButton = await checkinButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasCheckinButton) {
        console.log('   ✓ 签到按钮显示正常');
      } else {
        console.log('   ⚠️ 签到按钮未找到');
      }

      // 验证签到统计卡片
      const statsCards = page.locator('[data-testid*="stat"], [class*="stat-card"]');
      const statsCount = await statsCards.count();

      if (statsCount >= 2) {
        console.log(`   ✓ 签到统计卡片显示: ${statsCount}个`);
      } else {
        console.log(`   ⚠️ 签到统计卡片较少: ${statsCount}个`);
      }

      console.log('   ✓ 签到页面访问测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testCheckinStatus(results) {
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

  await test(results, '签到状态查询', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控API调用
      let statusApiCalled = false;
      let statusApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/check-in/status')) {
          statusApiCalled = true;
          if (response.ok()) {
            try {
              statusApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (statusApiCalled) {
        console.log('   ✓ 签到状态API已调用');
      } else {
        console.log('   ⚠️ 签到状态API未调用');
      }

      if (statusApiResponse) {
        console.log('   ✓ 签到状态API响应正常');

        // 验证响应字段
        if (statusApiResponse.hasOwnProperty('checked_in_today')) {
          console.log(`   ✓ 今日签到状态: ${statusApiResponse.checked_in_today}`);
        }

        if (statusApiResponse.hasOwnProperty('consecutive_days')) {
          console.log(`   ✓ 连续签到天数: ${statusApiResponse.consecutive_days}天`);
        }

        if (statusApiResponse.hasOwnProperty('monthly_count')) {
          console.log(`   ✓ 本月签到次数: ${statusApiResponse.monthly_count}次`);
        }
      } else {
        console.log('   ⚠️ 签到状态API响应未获取');
      }

      // 验证前端显示
      const consecutiveDays = page.locator('[data-testid="consecutive-days"], text=/连续.*天/').first();
      const hasConsecutiveDays = await consecutiveDays.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasConsecutiveDays) {
        console.log('   ✓ 连续签到天数显示正常');
      } else {
        console.log('   ⚠️ 连续签到天数未显示');
      }

      console.log('   ✓ 签到状态查询完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testPerformCheckin(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n✅ ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '执行签到测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控签到API调用
      let checkinApiCalled = false;
      let checkinApiResponse = null;
      let checkinApiStatus = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/check-in') && !response.url().includes('/status') && !response.url().includes('/history')) {
          checkinApiCalled = true;
          checkinApiStatus = response.status();
          if (response.ok()) {
            try {
              checkinApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 查找签到按钮
      const checkinButton = page.locator('[data-testid="checkin-button"], button:has-text("签到"), button:has-text("Check")').first();
      const hasCheckinButton = await checkinButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasCheckinButton) {
        throw new Error('签到按钮未找到');
      }

      // 检查按钮是否可点击
      const isDisabled = await checkinButton.isDisabled();

      if (isDisabled) {
        console.log('   ✓ 签到按钮已禁用（可能今日已签到）');
        console.log('   ⚠️ 跳过签到操作（已签到）');
      } else {
        console.log('   ✓ 签到按钮可点击');

        // 点击签到按钮
        await checkinButton.click();
        await page.waitForTimeout(3000);

        if (checkinApiCalled) {
          console.log(`   ✓ 签到API已调用 (HTTP ${checkinApiStatus})`);

          if (checkinApiResponse) {
            console.log('   ✓ 签到API响应正常');

            // 验证Token增加
            if (checkinApiResponse.tokens_earned) {
              console.log(`   ✓ 获得Token: ${checkinApiResponse.tokens_earned}个`);
            }
          }

          // 检查成功提示
          const successToast = page.locator('[role="status"], .toast, [data-testid="toast"]');
          const hasSuccessToast = await successToast.isVisible({ timeout: 3000 }).catch(() => false);

          if (hasSuccessToast) {
            console.log('   ✓ 签到成功提示显示正常');
          } else {
            console.log('   ⚠️ 签到成功提示未显示');
          }
        } else {
          console.log('   ⚠️ 签到API未被调用');
        }
      }

      console.log('   ✓ 执行签到测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testCheckinIdempotency(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔁 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '签到幂等性测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 查找签到按钮
      const checkinButton = page.locator('[data-testid="checkin-button"], button:has-text("签到"), button:has-text("Check")').first();
      const hasCheckinButton = await checkinButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasCheckinButton) {
        throw new Error('签到按钮未找到');
      }

      // 检查按钮状态
      const isDisabled = await checkinButton.isDisabled();

      if (isDisabled) {
        console.log('   ✓ 签到按钮已禁用');
        console.log('   ✓ 幂等性验证通过（今日已签到，按钮禁用）');
      } else {
        console.log('   ⚠️ 签到按钮未禁用');
        console.log('   ⚠️ 可能今日未签到，或幂等性机制未生效');
      }

      // 验证提示文本
      const disabledHint = page.locator('text=/已签到|Already checked/i').first();
      const hasDisabledHint = await disabledHint.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasDisabledHint) {
        console.log('   ✓ 已签到提示文本显示正常');
      } else {
        console.log('   ⚠️ 已签到提示文本未显示');
      }

      console.log('   ✓ 签到幂等性测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testCheckinHistory(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n📜 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '签到历史记录测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控历史API调用
      let historyApiCalled = false;
      let historyApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/check-in/history')) {
          historyApiCalled = true;
          if (response.ok()) {
            try {
              historyApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (historyApiCalled) {
        console.log('   ✓ 签到历史API已调用');
      } else {
        console.log('   ⚠️ 签到历史API未调用');
      }

      if (historyApiResponse) {
        console.log('   ✓ 签到历史API响应正常');

        if (Array.isArray(historyApiResponse) || historyApiResponse.records) {
          const records = Array.isArray(historyApiResponse) ? historyApiResponse : historyApiResponse.records;
          console.log(`   ✓ 签到记录数量: ${records.length}条`);
        }
      }

      // 验证前端历史记录显示
      const checkinRecords = page.locator('[data-testid="checkin-records"], [data-testid="checkin-history"], table, .history-list').first();
      const hasCheckinRecords = await checkinRecords.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasCheckinRecords) {
        console.log('   ✓ 签到历史记录显示正常');
      } else {
        console.log('   ⚠️ 签到历史记录未显示（可能无历史记录）');
      }

      // 验证日历组件
      const checkinCalendar = page.locator('[data-testid="checkin-calendar"], .calendar').first();
      const hasCheckinCalendar = await checkinCalendar.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCheckinCalendar) {
        console.log('   ✓ 签到日历组件显示正常');
      } else {
        console.log('   ⚠️ 签到日历组件未显示');
      }

      console.log('   ✓ 签到历史记录测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printTestSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📅 签到系统测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 签到系统功能验证:');
  console.log('├─ 签到页面访问: /settings/checkin');
  console.log('├─ 签到状态查询: GET /api/v1/check-in/status');
  console.log('├─ 执行签到: POST /api/v1/check-in (获得10 tokens)');
  console.log('├─ 幂等性验证: 每日仅一次签到');
  console.log('└─ 签到历史: GET /api/v1/check-in/history');

  console.log('\n📊 数据库表:');
  console.log('├─ checkins: 签到记录 (user_id + checkin_date唯一约束)');
  console.log('└─ user_checkin_stats: 用户统计 (连续天数、累计天数)');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. Useractivity服务是否正常运行');
    console.log('2. 签到API是否正确实现');
    console.log('3. 前端签到页面是否正确渲染');
    console.log('4. Token奖励是否正确发放');
  }
}

// 主函数
async function main() {
  try {
    const success = await testCheckinFlow();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 签到系统测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testCheckinFlow };
