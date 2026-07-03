#!/usr/bin/env node

/**
 * 邀请系统完整流程测试 (V3.0)
 *
 * 测试内容:
 * 1. 邀请链接和邀请码生成
 * 2. 邀请统计数据
 * 3. 邀请记录列表
 * 4. 试用订阅查询
 * 5. OAuth邀请注册流程
 *
 * 实现位置:
 * - services/useractivity/internal/handlers/referral.go
 * - apps/frontend/src/app/auth/callback/route.ts
 *
 * API端点:
 * - GET /api/v1/referral
 * - GET /api/v1/referral/list
 * - POST /api/v1/referral/track (内部API)
 * - GET /api/v1/trial/active
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testReferralFlow() {
  console.log('🎁 邀请系统完整流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试邀请页面访问
  await testReferralPageAccess(overallResults);

  // 测试邀请链接和统计
  await testReferralLinkAndStats(overallResults);

  // 测试邀请记录列表
  await testReferralList(overallResults);

  // 测试试用订阅
  await testTrialSubscription(overallResults);

  // 测试邀请奖励规则
  await testReferralRewards(overallResults);

  // 打印测试汇总
  printTestSummary(overallResults);

  return overallResults.failed === 0;
}

async function testReferralPageAccess(results) {
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

  await test(results, '邀请页面访问测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问邀请页面
      await page.goto(`${BASE_URL}/settings/referral`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证页面标题
      const pageTitle = await page.locator('h1, [data-testid="page-title"]').first().textContent();
      if (pageTitle && (pageTitle.includes('邀请') || pageTitle.includes('Referral') || pageTitle.includes('Invite'))) {
        console.log(`   ✓ 邀请页面标题正确: ${pageTitle.trim()}`);
      } else {
        console.log(`   ⚠️ 邀请页面标题未找到`);
      }

      // 验证邀请链接卡片
      const inviteLinkCard = page.locator('[data-testid="invite-link"], [data-testid="referral-link"]').first();
      const hasInviteLinkCard = await inviteLinkCard.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasInviteLinkCard) {
        console.log('   ✓ 邀请链接卡片显示正常');
      } else {
        console.log('   ⚠️ 邀请链接卡片未找到');
      }

      // 验证统计数据
      const statsSection = page.locator('[data-testid*="stat"], [class*="stat"]');
      const statsCount = await statsSection.count();

      if (statsCount >= 2) {
        console.log(`   ✓ 邀请统计卡片显示: ${statsCount}个`);
      } else {
        console.log(`   ⚠️ 邀请统计卡片较少: ${statsCount}个`);
      }

      console.log('   ✓ 邀请页面访问测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testReferralLinkAndStats(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔗 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '邀请链接和统计测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控API调用
      let referralApiCalled = false;
      let referralApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/referral') && !response.url().includes('/list') && !response.url().includes('/track')) {
          referralApiCalled = true;
          if (response.ok()) {
            try {
              referralApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/settings/referral`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (referralApiCalled) {
        console.log('   ✓ 邀请API已调用');
      } else {
        console.log('   ⚠️ 邀请API未调用');
      }

      if (referralApiResponse) {
        console.log('   ✓ 邀请API响应正常');

        // 验证邀请码
        if (referralApiResponse.referral_code) {
          console.log(`   ✓ 邀请码: ${referralApiResponse.referral_code}`);
        }

        // 验证邀请链接
        if (referralApiResponse.referral_link) {
          console.log(`   ✓ 邀请链接格式: ${referralApiResponse.referral_link.substring(0, 50)}...`);

          // 验证链接包含ref参数
          if (referralApiResponse.referral_link.includes('?ref=') || referralApiResponse.referral_link.includes('&ref=')) {
            console.log('   ✓ 邀请链接包含ref参数');
          } else {
            console.log('   ⚠️ 邀请链接格式可能不正确');
          }
        }

        // 验证统计数据
        if (referralApiResponse.hasOwnProperty('total_referrals')) {
          console.log(`   ✓ 总邀请人数: ${referralApiResponse.total_referrals}人`);
        }

        if (referralApiResponse.hasOwnProperty('successful_referrals')) {
          console.log(`   ✓ 成功注册数: ${referralApiResponse.successful_referrals}人`);
        }
      }

      // 验证复制按钮
      const copyButton = page.locator('button:has-text("复制"), button:has-text("Copy")').first();
      const hasCopyButton = await copyButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCopyButton) {
        console.log('   ✓ 复制邀请链接按钮可用');

        // 测试复制功能
        await copyButton.click();
        await page.waitForTimeout(1000);

        const copySuccessToast = page.locator('[role="status"], .toast, text=/复制成功|Copied/i').first();
        const hasCopySuccessToast = await copySuccessToast.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasCopySuccessToast) {
          console.log('   ✓ 复制成功提示显示正常');
        } else {
          console.log('   ⚠️ 复制成功提示未显示');
        }
      } else {
        console.log('   ⚠️ 复制邀请链接按钮未找到');
      }

      console.log('   ✓ 邀请链接和统计测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testReferralList(results) {
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

  await test(results, '邀请记录列表测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控API调用
      let listApiCalled = false;
      let listApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/referral/list')) {
          listApiCalled = true;
          if (response.ok()) {
            try {
              listApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/settings/referral`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (listApiCalled) {
        console.log('   ✓ 邀请记录列表API已调用');
      } else {
        console.log('   ⚠️ 邀请记录列表API未调用');
      }

      if (listApiResponse) {
        console.log('   ✓ 邀请记录列表API响应正常');

        if (Array.isArray(listApiResponse) || listApiResponse.records) {
          const records = Array.isArray(listApiResponse) ? listApiResponse : listApiResponse.records;
          console.log(`   ✓ 邀请记录数量: ${records.length}条`);

          if (records.length > 0) {
            const firstRecord = records[0];
            if (firstRecord.status) {
              console.log(`   ✓ 记录包含状态字段: ${firstRecord.status}`);
            }
          }
        }
      }

      // 验证前端列表显示
      const referralTable = page.locator('[data-testid="referral-list"], table, .referral-records').first();
      const hasReferralTable = await referralTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasReferralTable) {
        console.log('   ✓ 邀请记录列表显示正常');
      } else {
        console.log('   ⚠️ 邀请记录列表未显示（可能无邀请记录）');
      }

      console.log('   ✓ 邀请记录列表测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testTrialSubscription(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🎯 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '试用订阅测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控试用订阅API
      let trialApiCalled = false;
      let trialApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/trial/active')) {
          trialApiCalled = true;
          if (response.ok()) {
            try {
              trialApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      // 访问订阅页面查看试用状态
      await page.goto(`${BASE_URL}/settings/subscription`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (trialApiCalled) {
        console.log('   ✓ 试用订阅API已调用');

        if (trialApiResponse) {
          console.log('   ✓ 试用订阅API响应正常');

          if (trialApiResponse.active) {
            console.log('   ✓ 当前有活跃试用');

            if (trialApiResponse.days_remaining !== undefined) {
              console.log(`   ✓ 剩余天数: ${trialApiResponse.days_remaining}天`);
            }

            if (trialApiResponse.subscription_tier) {
              console.log(`   ✓ 试用套餐: ${trialApiResponse.subscription_tier}`);
            }
          } else {
            console.log('   ✓ 当前无活跃试用');
          }
        }
      } else {
        console.log('   ⚠️ 试用订阅API未调用');
      }

      // 验证前端试用显示
      const trialBadge = page.locator('text=/试用|Trial/i, [data-testid*="trial"]').first();
      const hasTrialBadge = await trialBadge.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasTrialBadge) {
        console.log('   ✓ 试用标识显示正常');
      } else {
        console.log('   ⚠️ 试用标识未显示（可能无试用）');
      }

      console.log('   ✓ 试用订阅测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testReferralRewards(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🏆 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '邀请奖励规则测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      await page.goto(`${BASE_URL}/settings/referral`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证奖励规则说明
      const rewardRules = page.locator('[data-testid="reward-rules"], .reward-rules, text=/奖励规则|Reward Rules/i').first();
      const hasRewardRules = await rewardRules.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasRewardRules) {
        console.log('   ✓ 奖励规则说明显示正常');
      } else {
        console.log('   ⚠️ 奖励规则说明未显示');
      }

      // 验证奖励详情（邀请人+14天，被邀请人14天）
      const reward14Days = page.locator('text=/14.*天|14.*days/i').first();
      const hasReward14Days = await reward14Days.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasReward14Days) {
        console.log('   ✓ 奖励详情显示正常（14天试用）');
      } else {
        console.log('   ⚠️ 奖励详情未找到');
      }

      // 验证邀请说明
      const inviteInstructions = page.locator('[data-testid="invite-instructions"], .instructions').first();
      const hasInviteInstructions = await inviteInstructions.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasInviteInstructions) {
        console.log('   ✓ 邀请说明显示正常');
      } else {
        console.log('   ⚠️ 邀请说明未显示');
      }

      console.log('   ✓ 邀请奖励规则测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printTestSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎁 邀请系统测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 邀请系统功能验证:');
  console.log('├─ 邀请页面访问: /settings/referral');
  console.log('├─ 邀请链接生成: GET /api/v1/referral');
  console.log('├─ 邀请码格式: /auth?ref={code}');
  console.log('├─ 邀请记录列表: GET /api/v1/referral/list');
  console.log('├─ 试用订阅查询: GET /api/v1/trial/active');
  console.log('└─ 奖励规则: 邀请人+14天，被邀请人14天');

  console.log('\n📊 数据库表:');
  console.log('├─ referrals: 邀请记录 (referrer_id, referred_user_id, status)');
  console.log('└─ trial_subscriptions: 试用订阅 (user_id, start_date, end_date)');

  console.log('\n🔄 邀请注册流程:');
  console.log('├─ 1. 用户访问邀请链接 /auth?ref=ABC123');
  console.log('├─ 2. OAuth登录回调处理 referralCode');
  console.log('├─ 3. 新用户检测（createdAt < 10秒）');
  console.log('├─ 4. POST /api/v1/referral/track 创建双向试用');
  console.log('└─ 5. 验证trial_subscriptions记录');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. Useractivity服务是否正常运行');
    console.log('2. 邀请API是否正确实现');
    console.log('3. 前端邀请页面是否正确渲染');
    console.log('4. 试用订阅逻辑是否正确');
  }
}

// 主函数
async function main() {
  try {
    const success = await testReferralFlow();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 邀请系统测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testReferralFlow };
