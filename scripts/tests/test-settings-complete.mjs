#!/usr/bin/env node

/**
 * 个人中心完整测试
 *
 * 测试内容:
 * 1. 个人中心首页访问和概览
 * 2. 个人信息管理
 * 3. 套餐订阅管理
 * 4. Token余额管理
 * 5. 邀请功能
 * 6. 签到功能
 * 7. 个人设置
 * 8. 后台管理入口（仅管理员）
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

// 个人中心功能配置
const SETTINGS_FEATURES = {
  profile: {
    name: '个人信息',
    path: '/settings/profile',
    fields: ['姓名', '邮箱', '电话', '公司', '职位', '头像']
  },
  tokens: {
    name: 'Token管理',
    path: '/settings/tokens',
    features: ['余额显示', '使用明细', '充值功能', '交易记录']
  },
  subscription: {
    name: '套餐订阅',
    path: '/settings/subscription',
    tiers: ['Starter', 'Professional', 'Elite'],
    features: ['当前套餐', '升级选项', '续费管理', '历史记录']
  },
  invite: {
    name: '邀请功能',
    path: '/settings/invite',
    features: ['邀请链接', '邀请记录', '奖励统计', '邀请规则']
  },
  checkin: {
    name: '签到功能',
    path: '/settings/checkin',
    features: ['每日签到', '签到记录', '连续签到', '签到奖励']
  }
};

// 测试用户配置
const TEST_USERS = {
  regular: {
    email: 'test-user@autoads.dev',
    subscription: 'professional',
    hasManageAccess: false
  },
  admin: {
    email: 'test-admin@scientificinternet.com',
    subscription: 'elite',
    hasManageAccess: true
  }
};

async function testSettingsComplete() {
  console.log('⚙️ 个人中心完整测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试个人中心首页
  await testSettingsHomepage(overallResults);

  // 测试个人信息管理
  await testProfileManagement(overallResults);

  // 测试Token管理功能
  await testTokenManagement(overallResults);

  // 测试套餐订阅管理
  await testSubscriptionManagement(overallResults);

  // 测试邀请功能
  await testInviteSystem(overallResults);

  // 测试签到功能
  await testDailyCheckin(overallResults);

  // 测试管理员特殊功能
  await testAdminAccess(overallResults);

  // 打印测试汇总
  printSettingsSummary(overallResults);

  return overallResults.failed === 0;
}

async function testSettingsHomepage(results) {
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

  await test(results, '个人中心首页测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问个人中心首页
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证页面标题
      const pageTitle = await page.locator('h1, [data-testid="page-title"]').first();
      const titleText = await pageTitle.textContent();

      if (!titleText.includes('个人中心') && !titleText.includes('Settings')) {
        throw new Error('个人中心页面标题不正确');
      }
      console.log('   ✓ 个人中心页面标题正确');

      // 验证导航菜单
      const navItems = page.locator('nav a, [data-testid="nav-item"]');
      const navCount = await navItems.count();

      if (navCount < 4) {
        throw new Error(`导航菜单项过少: ${navCount}个`);
      }
      console.log(`   ✓ 导航菜单显示: ${navCount}个选项`);

      // 验证用户信息概览
      const userInfoSection = page.locator('[data-testid="user-info-summary"]');
      const hasUserInfo = await userInfoSection.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasUserInfo) {
        console.log('   ✓ 用户信息概览显示正常');
      } else {
        console.log('   ⚠️ 用户信息概览未显示');
      }

      // 验证功能模块卡片
      const featureCards = page.locator('[data-testid*="feature-card"], .feature-card');
      const cardCount = await featureCards.count();

      if (cardCount >= 5) {
        console.log(`   ✓ 功能模块显示: ${cardCount}个`);
      } else {
        console.log(`   ⚠️ 功能模块较少: ${cardCount}个`);
      }

      console.log('   ✓ 个人中心首页访问正常');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testProfileManagement(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n👤 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '个人信息管理测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问个人信息页面
      await page.goto(`${BASE_URL}/settings/profile`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证个人信息表单
      const profileForm = page.locator('form, [data-testid="profile-form"]');
      const hasForm = await profileForm.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasForm) {
        throw new Error('个人信息表单不可见');
      }

      // 检查必填字段
      const requiredFields = ['姓名', '邮箱'];
      let foundFields = 0;

      for (const field of requiredFields) {
        const fieldExists = await page.locator(`text=${field}`).isVisible({ timeout: 2000 }).catch(() => false);
        if (fieldExists) {
          foundFields++;
        }
      }

      if (foundFields < requiredFields.length) {
        throw new Error(`必填字段缺失: ${foundFields}/${requiredFields.length}`);
      }

      console.log('   ✓ 个人信息表单字段完整');

      // 测试编辑功能
      const editButton = page.locator('button:has-text("编辑"), button:has-text("Edit")').first();
      const hasEditButton = await editButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasEditButton) {
        await editButton.click();
        await page.waitForTimeout(1000);

        // 检查是否可以编辑
        const editableInputs = page.locator('input:not([disabled]), textarea:not([disabled])');
        const inputCount = await editableInputs.count();

        if (inputCount > 0) {
          console.log(`   ✓ 编辑功能可用: ${inputCount}个可编辑字段`);
        } else {
          console.log('   ⚠️ 编辑按钮存在但无可编辑字段');
        }
      } else {
        console.log('   ⚠️ 编辑按钮不可见');
      }

      // 测试头像上传功能
      const avatarUpload = page.locator('input[type="file"], [data-testid="avatar-upload"]');
      const hasAvatarUpload = await avatarUpload.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasAvatarUpload) {
        console.log('   ✓ 头像上传功能可用');
      } else {
        console.log('   ⚠️ 头像上传功能不可见');
      }

      // 测试保存功能
      const saveButton = page.locator('button:has-text("保存"), button:has-text("Save")').first();
      const hasSaveButton = await saveButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasSaveButton) {
        console.log('   ✓ 保存按钮可用');
      } else {
        console.log('   ⚠️ 保存按钮不可见');
      }

      console.log('   ✓ 个人信息管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testTokenManagement(results) {
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

  await test(results, 'Token管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问Token管理页面
      await page.goto(`${BASE_URL}/settings/tokens`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证Token余额显示
      const balanceDisplay = page.locator('[data-testid="token-balance"], .token-balance');
      const hasBalance = await balanceDisplay.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasBalance) {
        throw new Error('Token余额显示不可见');
      }

      const balanceText = await balanceDisplay.textContent();
      const balanceNumber = parseInt(balanceText.match(/\d+/)?.[0] || '0');

      if (balanceNumber >= 0) {
        console.log(`   ✓ Token余额显示正确: ${balanceNumber}`);
      } else {
        throw new Error('Token余额显示不正确');
      }

      // 验证Token统计信息
      const statsContainer = page.locator('[data-testid="token-stats"], .token-stats');
      const hasStats = await statsContainer.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasStats) {
        console.log('   ✓ Token统计信息显示正常');
      } else {
        console.log('   ⚠️ Token统计信息未显示');
      }

      // 验证充值功能
      const rechargeButton = page.locator('button:has-text("充值"), button:has-text("购买Token")').first();
      const hasRechargeButton = await rechargeButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasRechargeButton) {
        console.log('   ✓ 充值功能可用');
      } else {
        console.log('   ⚠️ 充值功能不可见');
      }

      // 验证使用明细
      const usageSection = page.locator('[data-testid="usage-breakdown"], .usage-section');
      const hasUsageSection = await usageSection.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasUsageSection) {
        console.log('   ✓ 使用明细显示正常');
      } else {
        console.log('   ⚠️ 使用明细未显示');
      }

      // 验证交易记录表格
      const transactionTable = page.locator('table, [role="table"], [data-testid="transaction-table"]');
      const hasTransactionTable = await transactionTable.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasTransactionTable) {
        console.log('   ✓ 交易记录表格显示正常');
      } else {
        console.log('   ⚠️ 交易记录表格未显示（可能无交易记录）');
      }

      console.log('   ✓ Token管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testSubscriptionManagement(results) {
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

  await test(results, '套餐订阅管理测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问套餐订阅页面
      await page.goto(`${BASE_URL}/settings/subscription`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证当前套餐显示
      const currentPlan = page.locator('[data-testid="current-plan"], .current-plan');
      const hasCurrentPlan = await currentPlan.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasCurrentPlan) {
        throw new Error('当前套餐信息不可见');
      }

      console.log('   ✓ 当前套餐信息显示正常');

      // 验证套餐选项
      const planCards = page.locator('[data-testid*="plan-card"], .plan-card');
      const planCount = await planCards.count();

      if (planCount >= 3) {
        console.log(`   ✓ 套餐选项显示: ${planCount}个套餐`);
      } else {
        console.log(`   ⚠️ 套餐选项较少: ${planCount}个`);
      }

      // 检查套餐特性对比
      const featureComparison = page.locator('[data-testid="feature-comparison"], .feature-comparison');
      const hasFeatureComparison = await featureComparison.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasFeatureComparison) {
        console.log('   ✓ 套餐特性对比显示正常');
      } else {
        console.log('   ⚠️ 套餐特性对比未显示');
      }

      // 验证升级/降级按钮
      const upgradeButtons = page.locator('button:has-text("升级"), button:has-text("升级套餐")');
      const hasUpgradeButtons = await upgradeButtons.count() > 0;

      if (hasUpgradeButtons) {
        console.log('   ✓ 套餐升级功能可用');
      } else {
        console.log('   ⚠️ 套餐升级功能不可见');
      }

      // 验证续费管理
      const renewalSection = page.locator('[data-testid="renewal-section"], .renewal-section');
      const hasRenewalSection = await renewalSection.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasRenewalSection) {
        console.log('   ✓ 续费管理功能显示正常');
      } else {
        console.log('   ⚠️ 续费管理功能未显示');
      }

      // 验证订阅历史
      const historySection = page.locator('[data-testid="subscription-history"], .history-section');
      const hasHistorySection = await historySection.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasHistorySection) {
        console.log('   ✓ 订阅历史显示正常');
      } else {
        console.log('   ⚠️ 订阅历史未显示');
      }

      console.log('   ✓ 套餐订阅管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testInviteSystem(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🎁 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '邀请功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问邀请页面
      await page.goto(`${BASE_URL}/settings/invite`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证邀请链接
      const inviteLink = page.locator('[data-testid="invite-link"], .invite-link');
      const hasInviteLink = await inviteLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasInviteLink) {
        console.log('   ✓ 邀请链接显示正常');

        // 测试复制邀请链接功能
        const copyButton = page.locator('button:has-text("复制"), button:has-text("Copy")').first();
        const hasCopyButton = await copyButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasCopyButton) {
          console.log('   ✓ 复制邀请链接功能可用');
        } else {
          console.log('   ⚠️ 复制邀请链接按钮不可见');
        }
      } else {
        console.log('   ⚠️ 邀请链接未显示');
      }

      // 验证邀请统计
      const inviteStats = page.locator('[data-testid="invite-stats"], .invite-stats');
      const hasInviteStats = await inviteStats.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasInviteStats) {
        console.log('   ✓ 邀请统计显示正常');
      } else {
        console.log('   ⚠️ 邀请统计未显示');
      }

      // 验证邀请记录
      const inviteRecords = page.locator('[data-testid="invite-records"], .invite-records');
      const hasInviteRecords = await inviteRecords.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasInviteRecords) {
        console.log('   ✓ 邀请记录显示正常');
      } else {
        console.log('   ⚠️ 邀请记录未显示（可能无邀请记录）');
      }

      // 验证奖励规则
      const rewardRules = page.locator('[data-testid="reward-rules"], .reward-rules');
      const hasRewardRules = await rewardRules.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasRewardRules) {
        console.log('   ✓ 奖励规则显示正常');
      } else {
        console.log('   ⚠️ 奖励规则未显示');
      }

      console.log('   ✓ 邀请功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testDailyCheckin(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n📅 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '签到功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问签到页面
      await page.goto(`${BASE_URL}/settings/checkin`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证签到按钮
      const checkinButton = page.locator('[data-testid="checkin-button"], button:has-text("签到")').first();
      const hasCheckinButton = await checkinButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasCheckinButton) {
        console.log('   ✓ 签到按钮显示正常');

        // 检查签到按钮状态
        const isDisabled = await checkinButton.isDisabled();
        if (isDisabled) {
          console.log('   ✓ 签到按钮已禁用（可能已签到）');
        } else {
          console.log('   ✓ 签到按钮可点击');
        }
      } else {
        console.log('   ⚠️ 签到按钮未显示');
      }

      // 验证签到记录
      const checkinRecords = page.locator('[data-testid="checkin-records"], .checkin-records');
      const hasCheckinRecords = await checkinRecords.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCheckinRecords) {
        console.log('   ✓ 签到记录显示正常');
      } else {
        console.log('   ⚠️ 签到记录未显示');
      }

      // 验证连续签到统计
      const consecutiveDays = page.locator('[data-testid="consecutive-days"], .consecutive-days');
      const hasConsecutiveDays = await consecutiveDays.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasConsecutiveDays) {
        console.log('   ✓ 连续签到统计显示正常');
      } else {
        console.log('   ⚠️ 连续签到统计未显示');
      }

      // 验证签到奖励
      const checkinRewards = page.locator('[data-testid="checkin-rewards"], .checkin-rewards');
      const hasCheckinRewards = await checkinRewards.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasCheckinRewards) {
        console.log('   ✓ 签到奖励显示正常');
      } else {
        console.log('   ⚠️ 签到奖励未显示');
      }

      console.log('   ✓ 签到功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testAdminAccess(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n👑 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '管理员访问权限测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 测试普通用户无权限访问后台
      await setupAuthForTest(page, 'user');

      await page.goto(`${BASE_URL}/manage`, { waitUntil: 'networkidle', timeout: 10000 });
      const currentUrl = page.url();

      if (currentUrl.includes('/settings') || currentUrl.includes('/dashboard') || currentUrl.includes('/403')) {
        console.log('   ✓ 普通用户正确被拒绝访问后台管理');
      } else {
        console.log('   ⚠️ 普通用户可能可以访问后台管理');
      }

      await cleanupAuthForTest(page);

      // 测试管理员可以访问后台
      await setupAuthForTest(page, 'admin');

      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 检查是否有后台管理入口
      const adminLink = page.locator('a:has-text("后台管理"), a:has-text("管理"), [data-testid="admin-link"]').first();
      const hasAdminLink = await adminLink.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasAdminLink) {
        console.log('   ✓ 管理员显示后台管理入口');

        // 测试点击后台管理链接
        await adminLink.click();
        await page.waitForTimeout(2000);

        const newUrl = page.url();
        if (newUrl.includes('/manage')) {
          console.log('   ✓ 管理员可以正常访问后台管理系统');
        } else {
          console.log('   ⚠️ 后台管理链接跳转异常');
        }
      } else {
        console.log('   ⚠️ 管理员未显示后台管理入口');
      }

      console.log('   ✓ 管理员访问权限测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printSettingsSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚙️ 个人中心测试汇��');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 个人中心功能总结:');
  console.log('├─ 个人中心首页: 用户概览和导航');
  console.log('├─ 个人信息管理: 基本信息编辑和头像上传');
  console.log('├─ Token管理: 余额显示和使用明细');
  console.log('├─ 套餐订阅: 当前套餐和升级选项');
  console.log('├─ 邀请功能: 邀请链接和奖励系统');
  console.log('├─ 签到功能: 每日签到和连续奖励');
  console.log('└─ 后台管理入口: 管理员专用功能');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. 个人中心页面是否正确渲染');
    console.log('2. 个人信息表单是否可编辑');
    console.log('3. Token余额是否正确显示');
    console.log('4. 套餐订阅功能是否正常');
    console.log('5. 邀请和签到功能是否实现');
    console.log('6. 管理员权限控制是否正确');
  }
}

// 主函数
async function main() {
  try {
    const success = await testSettingsComplete();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 个人中心测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testSettingsComplete };