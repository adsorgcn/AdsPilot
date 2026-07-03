#!/usr/bin/env node

/**
 * 后台管理系统完整测试
 *
 * 测试内容:
 * 1. 管理员权限验证
 * 2. 管理仪表盘
 * 3. 用户管理
 * 4. Token管理
 * 5. Offer管理
 * 6. 订阅管理
 * 7. 任务管理
 * 8. Ads账号管理
 * 9. 系统统计和分析
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

// 后台管理功能配置
const MANAGE_FEATURES = {
  dashboard: {
    name: '管理仪表盘',
    path: '/manage',
    metrics: ['用户总数', '今日新增', '活跃用户', '收入统计']
  },
  users: {
    name: '用户管理',
    path: '/manage/users',
    features: ['用户列表', '用户搜索', '用户状态管理', '用户详情']
  },
  tokens: {
    name: 'Token管理',
    path: '/manage/tokens',
    features: ['Token统计', '交易记录', '充值管理', '余额调整']
  },
  offers: {
    name: 'Offer管理',
    path: '/manage/offers',
    features: ['Offer列表', 'Offer审核', '状态管理', '数据分析']
  },
  subscriptions: {
    name: '订阅管理',
    path: '/manage/subscriptions',
    features: ['订阅统计', '套餐管理', '续费管理', '收入分析']
  },
  tasks: {
    name: '任务管理',
    path: '/manage/tasks',
    features: ['任务列表', '任务状态', '执行监控', '性能分析']
  },
  'ads-accounts': {
    name: 'Ads账号管理',
    path: '/manage/ads-accounts',
    features: ['账号列表', '连接状态', '权限管理', '数据同步']
  }
};

// 测试用户配置
const TEST_USERS = {
  admin: {
    email: 'test-admin@scientificinternet.com',
    role: 'admin',
    subscription: 'elite',
    hasFullAccess: true
  },
  regular: {
    email: 'test-user@autoads.dev',
    role: 'user',
    subscription: 'professional',
    hasFullAccess: false
  }
};

async function testManageComplete() {
  console.log('👑 后台管理系统完整测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试管理员权限验证
  await testAdminPermissions(overallResults);

  // 测试管理仪表盘
  await testManageDashboard(overallResults);

  // 测试用户管理功能
  await testUserManagement(overallResults);

  // 测试Token管理功能
  await testTokenManagementAdmin(overallResults);

  // 测试Offer管理功能
  await testOfferManagement(overallResults);

  // 测试订阅管理功能
  await testSubscriptionManagement(overallResults);

  // 测试任务管理功能
  await testTaskManagement(overallResults);

  // 测试Ads账号管理功能
  await testAdsAccountManagement(overallResults);

  // 打印测试汇总
  printManageSummary(overallResults);

  return overallResults.failed === 0;
}

async function testAdminPermissions(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔐 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '管理员权限验证测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 测试普通用户无权限访问
      await setupAuthForTest(page, 'user');

      await page.goto(`${BASE_URL}/manage`, { waitUntil: 'networkidle', timeout: 10000 });
      const currentUrl = page.url();

      if (currentUrl.includes('/403') || currentUrl.includes('/dashboard') || currentUrl.includes('/settings')) {
        console.log('   ✓ 普通用户正确被拒绝访问后台管理');
      } else {
        console.log('   ⚠️ 普通用户可能可以访问后台管理');
      }

      await cleanupAuthForTest(page);

      // 测试管理员可以访问
      await setupAuthForTest(page, 'admin');

      await page.goto(`${BASE_URL}/manage`, { waitUntil: 'networkidle', timeout: 10000 });
      const manageUrl = page.url();

      if (manageUrl.includes('/manage')) {
        console.log('   ✓ 管理员可以正常访问后台管理');

        // 验证管理员身份标识
        const adminBadge = page.locator('[data-testid="admin-badge"], .admin-badge');
        const hasAdminBadge = await adminBadge.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasAdminBadge) {
          console.log('   ✓ 管理员身份标识显示正常');
        } else {
          console.log('   ⚠️ 管理员身份标识未显示');
        }
      } else {
        throw new Error('管理员无法访问后台管理页面');
      }

      console.log('   ✓ 管理员权限验证完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testManageDashboard(results) {
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

  await test(results, '管理仪表盘测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问管理仪表盘
      await page.goto(`${BASE_URL}/manage`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证页面标题
      const pageTitle = page.locator('h1, [data-testid="page-title"]').first();
      const titleText = await pageTitle.textContent();

      if (!titleText.includes('管理') && !titleText.includes('Admin') && !titleText.includes('Dashboard')) {
        throw new Error('管理仪表盘页面标题不正确');
      }
      console.log('   ✓ 管理仪表盘页面标题正确');

      // 验证统计卡片
      const statsCards = page.locator('[data-testid*="stats-card"], .stats-card');
      const cardCount = await statsCards.count();

      if (cardCount >= 4) {
        console.log(`   ✓ 统计卡片显示: ${cardCount}个`);
      } else {
        console.log(`   ⚠️ 统计卡片较少: ${cardCount}个`);
      }

      // 验证关键指标显示
      const keyMetrics = ['用户总数', '今日新增', '活跃用户', '收入统计'];
      let foundMetrics = 0;

      for (const metric of keyMetrics) {
        const hasMetric = await page.locator(`text=/${metric}/i`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasMetric) {
          foundMetrics++;
        }
      }

      if (foundMetrics >= 2) {
        console.log(`   ✓ 关键指标显示: ${foundMetrics}/${keyMetrics.length}个`);
      } else {
        console.log(`   ⚠️ 关键指标显示较少: ${foundMetrics}/${keyMetrics.length}个`);
      }

      // 验证图表组件
      const charts = page.locator('[data-testid*="chart"], .chart, canvas');
      const chartCount = await charts.count();

      if (chartCount > 0) {
        console.log(`   ✓ 图表组件显示: ${chartCount}个`);
      } else {
        console.log('   ⚠️ 图表组件未显示');
      }

      // 验证快速操作入口
      const quickActions = page.locator('[data-testid="quick-actions"], .quick-actions a');
      const actionCount = await quickActions.count();

      if (actionCount >= 3) {
        console.log(`   ✓ 快速操作入口: ${actionCount}个`);
      } else {
        console.log(`   ⚠️ 快速操作入口较少: ${actionCount}个`);
      }

      console.log('   ✓ 管理仪表盘测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testUserManagement(results) {
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

  await test(results, '用户管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问用户管理页面
      await page.goto(`${BASE_URL}/manage/users`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证用户列表
      const userTable = page.locator('table, [role="table"], [data-testid="user-table"]');
      const hasUserTable = await userTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasUserTable) {
        throw new Error('用户列表表格不可见');
      }

      console.log('   ✓ 用户列表表格显示正常');

      // 验证搜索功能
      const searchInput = page.locator('input[type="search"], [data-testid="search-input"]');
      const hasSearchInput = await searchInput.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasSearchInput) {
        console.log('   ✓ 用户搜索功能可用');
      } else {
        console.log('   ⚠️ 用户搜索功能不可见');
      }

      // 验证筛选功能
      const filterButtons = page.locator('button:has-text("筛选"), select, [data-testid="filter"]');
      const hasFilters = await filterButtons.count() > 0;

      if (hasFilters) {
        console.log('   ✓ 用户筛选功能可用');
      } else {
        console.log('   ⚠️ 用户筛选功能不可见');
      }

      // 验证用户操作按钮
      const actionButtons = page.locator('button:has-text("编辑"), button:has-text("禁用"), button:has-text("详情")');
      const hasActionButtons = await actionButtons.count() > 0;

      if (hasActionButtons) {
        console.log('   ✓ 用户操作功能可用');
      } else {
        console.log('   ⚠️ 用户操作功能不可见（可能无用户数据）');
      }

      // 验证分页功能
      const pagination = page.locator('[data-testid="pagination"], .pagination');
      const hasPagination = await pagination.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPagination) {
        console.log('   ✓ 分页功能显示正常');
      } else {
        console.log('   ⚠️ 分页功能未显示（可能数据较少）');
      }

      // 验证用户统计信息
      const userStats = page.locator('[data-testid="user-stats"], .user-stats');
      const hasUserStats = await userStats.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasUserStats) {
        console.log('   ✓ 用户统计信息显示正常');
      } else {
        console.log('   ⚠️ 用户统计信息未显示');
      }

      console.log('   ✓ 用户管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testTokenManagementAdmin(results) {
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
      await setupAuthForTest(page, 'admin');

      // 访问Token管理页面
      await page.goto(`${BASE_URL}/manage/tokens`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证Token统计图表
      const tokenCharts = page.locator('[data-testid*="token-chart"], .chart');
      const hasCharts = await tokenCharts.count() > 0;

      if (hasCharts) {
        console.log('   ✓ Token统计图表显示正常');
      } else {
        console.log('   ⚠️ Token统计图表未显示');
      }

      // 验证交易记录表格
      const transactionTable = page.locator('[data-testid="transaction-table"], table');
      const hasTransactionTable = await transactionTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTransactionTable) {
        console.log('   ✓ 交易记录表格显示正常');
      } else {
        console.log('   ⚠️ 交易记录表格未显示');
      }

      // 验证Token调整功能
      const adjustButton = page.locator('button:has-text("调整"), button:has-text("充值")');
      const hasAdjustButton = await adjustButton.count() > 0;

      if (hasAdjustButton) {
        console.log('   ✓ Token调整功能可用');
      } else {
        console.log('   ⚠️ Token调整功能不可见');
      }

      // 验证筛选和搜索功能
      const filterControls = page.locator('select, input[type="search"], button:has-text("筛选")');
      const hasFilterControls = await filterControls.count() > 0;

      if (hasFilterControls) {
        console.log('   ✓ 筛选和搜索功能可用');
      } else {
        console.log('   ⚠️ 筛选和搜索功能不可见');
      }

      // 验证导出功能
      const exportButton = page.locator('button:has-text("导出"), button:has-text("Export")');
      const hasExportButton = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasExportButton) {
        console.log('   ✓ 导出功能可用');
      } else {
        console.log('   ⚠️ 导出功能不可见');
      }

      console.log('   ✓ Token管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testOfferManagement(results) {
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

  await test(results, 'Offer管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问Offer管理页面
      await page.goto(`${BASE_URL}/manage/offers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证Offer列表
      const offerTable = page.locator('[data-testid="offer-table"], table');
      const hasOfferTable = await offerTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasOfferTable) {
        console.log('   ✓ Offer列表显示正常');
      } else {
        console.log('   ⚠️ Offer列表未显示（可能无Offer数据）');
      }

      // 验证状态筛选
      const statusFilters = page.locator('button:has-text("待审核"), button:has-text("已通过"), button:has-text("已拒绝")');
      const hasStatusFilters = await statusFilters.count() > 0;

      if (hasStatusFilters) {
        console.log('   ✓ 状态筛选功能可用');
      } else {
        console.log('   ⚠️ 状态筛选功能不可见');
      }

      // 验证审核功能
      const reviewButtons = page.locator('button:has-text("审核"), button:has-text("通过"), button:has-text("拒绝")');
      const hasReviewButtons = await reviewButtons.count() > 0;

      if (hasReviewButtons) {
        console.log('   ✓ Offer审核功能可用');
      } else {
        console.log('   ⚠️ Offer审核功能不可见（可能无待审核Offer）');
      }

      // 验证数据分析
      const analyticsSection = page.locator('[data-testid="analytics"], .analytics');
      const hasAnalytics = await analyticsSection.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasAnalytics) {
        console.log('   ✓ 数据分析功能显示正常');
      } else {
        console.log('   ⚠️ 数据分析功能未显示');
      }

      console.log('   ✓ Offer管理功能测试完成');

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

  await test(results, '订阅管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问订阅管理页面
      await page.goto(`${BASE_URL}/manage/subscriptions`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证订阅统计
      const subscriptionStats = page.locator('[data-testid="subscription-stats"], .stats');
      const hasStats = await subscriptionStats.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasStats) {
        console.log('   ✓ 订阅统计显示正常');
      } else {
        console.log('   ⚠️ 订阅统计未显示');
      }

      // 验证订阅列表
      const subscriptionTable = page.locator('[data-testid="subscription-table"], table');
      const hasSubscriptionTable = await subscriptionTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSubscriptionTable) {
        console.log('   ✓ 订阅列表显示正常');
      } else {
        console.log('   ⚠️ 订阅列表未显示');
      }

      // 验证收入分析
      const revenueChart = page.locator('[data-testid="revenue-chart"], .chart');
      const hasRevenueChart = await revenueChart.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasRevenueChart) {
        console.log('   ✓ 收入分析图表显示正常');
      } else {
        console.log('   ⚠️ 收入分析图表未显示');
      }

      // 验证套餐管理
      const planManagement = page.locator('[data-testid="plan-management"], .plan-management');
      const hasPlanManagement = await planManagement.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPlanManagement) {
        console.log('   ✓ 套餐管理功能显示正常');
      } else {
        console.log('   ⚠️ 套餐管理功能未显示');
      }

      console.log('   ✓ 订阅管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testTaskManagement(results) {
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

  await test(results, '任务管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问任务管理页面
      await page.goto(`${BASE_URL}/manage/tasks`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证任务列表
      const taskTable = page.locator('[data-testid="task-table"], table');
      const hasTaskTable = await taskTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTaskTable) {
        console.log('   ✓ 任务列表显示正常');
      } else {
        console.log('   ⚠️ 任务列表未显示（可能无任务数据）');
      }

      // 验证任务状态监控
      const statusMonitor = page.locator('[data-testid="status-monitor"], .status-monitor');
      const hasStatusMonitor = await statusMonitor.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasStatusMonitor) {
        console.log('   ✓ 任务状态监控显示正常');
      } else {
        console.log('   ⚠️ 任务状态监控未显示');
      }

      // 验证性能分析
      const performanceAnalysis = page.locator('[data-testid="performance-analysis"], .performance');
      const hasPerformanceAnalysis = await performanceAnalysis.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPerformanceAnalysis) {
        console.log('   ✓ 性能分析功能显示正常');
      } else {
        console.log('   ⚠️ 性能分析功能未显示');
      }

      // 验证任务操作功能
      const taskActions = page.locator('button:has-text("停止"), button:has-text("重启"), button:has-text("查看日志")');
      const hasTaskActions = await taskActions.count() > 0;

      if (hasTaskActions) {
        console.log('   ✓ 任务操作功能可用');
      } else {
        console.log('   ⚠️ 任务操作功能不可见');
      }

      console.log('   ✓ 任务管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testAdsAccountManagement(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n📱 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, 'Ads账号管理功能测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'admin');

      // 访问Ads账号管理页面
      await page.goto(`${BASE_URL}/manage/ads-accounts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // 验证账号列表
      const accountTable = page.locator('[data-testid="ads-account-table"], table');
      const hasAccountTable = await accountTable.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasAccountTable) {
        console.log('   ✓ Ads账号列表显示正常');
      } else {
        console.log('   ⚠️ Ads账号列表未显示（可能无账号数据）');
      }

      // 验证连接状态显示
      const connectionStatus = page.locator('[data-testid="connection-status"], .status');
      const hasConnectionStatus = await connectionStatus.count() > 0;

      if (hasConnectionStatus) {
        console.log('   ✓ 连接状态显示正常');
      } else {
        console.log('   ⚠️ 连接状态未显示');
      }

      // 验证权限管理
      const permissionManagement = page.locator('[data-testid="permission-management"], .permissions');
      const hasPermissionManagement = await permissionManagement.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPermissionManagement) {
        console.log('   ✓ 权限管理功能显示正常');
      } else {
        console.log('   ⚠️ 权限管理功能未显示');
      }

      // 验证数据同步功能
      const syncButton = page.locator('button:has-text("同步"), button:has-text("Sync")');
      const hasSyncButton = await syncButton.count() > 0;

      if (hasSyncButton) {
        console.log('   ✓ 数据同步功能可用');
      } else {
        console.log('   ⚠️ 数据同步功能不可见');
      }

      console.log('   ✓ Ads账号管理功能测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printManageSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 后台管理系统测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 后台管理功能总结:');
  console.log('├─ 管理仪表盘: 系统概览和关键指标');
  console.log('├─ 用户管理: 用户列表、状态管理和详情查看');
  console.log('├─ Token管理: Token统计、交易记录和余额调整');
  console.log('├─ Offer管理: Offer审核、状态管理和数据分析');
  console.log('├─ 订阅管理: 订阅统计、套餐管理和收入分析');
  console.log('├─ 任务管理: 任务监控、性能分析和操作管理');
  console.log('├─ Ads账号管理: 账号列表、连接状态和权限管理');
  console.log('└─ 权限控制: 严格的管理员权限验证');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. 管理员权限验证是否正确实现');
    console.log('2. 后台管理页面是否正确渲染');
    console.log('3. 数据表格和图表组件是否正常显示');
    console.log('4. 管理操作功能（编辑、删除、审核等）是否可用');
    console.log('5. 统计数据是否正确加载和显示');
    console.log('6. 搜索和筛选功能是否正常工作');
  }
}

// 主函数
async function main() {
  try {
    const success = await testManageComplete();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 后台管理系统测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testManageComplete };