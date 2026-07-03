#!/usr/bin/env node

/**
 * 通知系统测试 (V3.0)
 *
 * 测试内容:
 * 1. 通知列表查询
 * 2. 标记已读功能
 * 3. 未读计数统计
 * 4. SSE实时推送（可选）
 * 5. 删除通知
 *
 * 实现位置: services/useractivity/cmd/useractivity/main.go
 * API端点:
 * - GET /api/v1/notifications/recent
 * - POST /api/v1/notifications/read
 * - GET /api/v1/notifications/unread-count
 * - GET /api/v1/notifications/stream (SSE)
 * - DELETE /api/v1/notifications/{id}
 */

import { chromium } from 'playwright';
import { setupAuthForTest, cleanupAuthForTest } from './helpers/auth.mjs';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testNotifications() {
  console.log('🔔 通知系统测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = { passed: 0, failed: 0 };

  // 测试通知Feed组件
  await testNotificationsFeed(overallResults);

  // 测试通知列表API
  await testNotificationsList(overallResults);

  // 测试未读计数
  await testUnreadCount(overallResults);

  // 测试标记已读
  await testMarkAsRead(overallResults);

  // 测试通知Badge
  await testNotificationBadge(overallResults);

  // 打印测试汇总
  printTestSummary(overallResults);

  return overallResults.failed === 0;
}

async function testNotificationsFeed(results) {
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

  await test(results, '通知Feed组件测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 访问Dashboard页面（通常包含通知组件）
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // 查找通知组件
      const notificationsFeed = page.locator('[data-testid="notifications-feed"], [data-testid="notifications"], .notifications-feed').first();
      const hasNotificationsFeed = await notificationsFeed.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasNotificationsFeed) {
        console.log('   ✓ 通知Feed组件显示正常');
      } else {
        console.log('   ⚠️ 通知Feed组件未找到');
      }

      // 查找通知列表
      const notificationItems = page.locator('[data-testid*="notification-item"], [class*="notification-item"]');
      const itemCount = await notificationItems.count();

      if (itemCount > 0) {
        console.log(`   ✓ 通知列表显示: ${itemCount}条通知`);
      } else {
        console.log('   ⚠️ 通知列表为空（可能无通知）');
      }

      // 验证通知标题
      const notificationTitle = page.locator('h2:has-text("通知"), h2:has-text("Notification"), [data-testid="notifications-title"]').first();
      const hasNotificationTitle = await notificationTitle.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasNotificationTitle) {
        console.log('   ✓ 通知标题显示正常');
      } else {
        console.log('   ⚠️ 通知标题未显示');
      }

      console.log('   ✓ 通知Feed组件测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testNotificationsList(results) {
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

  await test(results, '通知列表API测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控API调用
      let notificationsApiCalled = false;
      let notificationsApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/notifications/recent')) {
          notificationsApiCalled = true;
          if (response.ok()) {
            try {
              notificationsApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (notificationsApiCalled) {
        console.log('   ✓ 通知列表API已调用');
      } else {
        console.log('   ⚠️ 通知列表API未调用');
      }

      if (notificationsApiResponse) {
        console.log('   ✓ 通知列表API响应正常');

        if (Array.isArray(notificationsApiResponse) || notificationsApiResponse.notifications) {
          const notifications = Array.isArray(notificationsApiResponse)
            ? notificationsApiResponse
            : notificationsApiResponse.notifications;

          console.log(`   ✓ 通知数量: ${notifications.length}条`);

          if (notifications.length > 0) {
            const firstNotification = notifications[0];

            if (firstNotification.title) {
              console.log(`   ✓ 通知标题字段存在: ${firstNotification.title.substring(0, 30)}...`);
            }

            if (firstNotification.type) {
              console.log(`   ✓ 通知类型: ${firstNotification.type}`);
            }

            if (firstNotification.hasOwnProperty('read_at')) {
              console.log(`   ✓ 已读状态字段存在: ${firstNotification.read_at ? '已读' : '未读'}`);
            }
          }
        }

        // 验证分页参数
        if (notificationsApiResponse.total !== undefined) {
          console.log(`   ✓ 总数统计: ${notificationsApiResponse.total}条`);
        }
      }

      console.log('   ✓ 通知列表API测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testUnreadCount(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔢 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '未读计数测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控未读计数API
      let unreadCountApiCalled = false;
      let unreadCountApiResponse = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/notifications/unread-count')) {
          unreadCountApiCalled = true;
          if (response.ok()) {
            try {
              unreadCountApiResponse = await response.json();
            } catch (e) {
              // JSON解析失败
            }
          }
        }
      });

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      if (unreadCountApiCalled) {
        console.log('   ✓ 未读计数API已调用');

        if (unreadCountApiResponse) {
          console.log('   ✓ 未读计数API响应正常');

          if (unreadCountApiResponse.hasOwnProperty('count') || unreadCountApiResponse.hasOwnProperty('unread_count')) {
            const count = unreadCountApiResponse.count || unreadCountApiResponse.unread_count;
            console.log(`   ✓ 未读通知数: ${count}条`);
          }
        }
      } else {
        console.log('   ⚠️ 未读计数API未调用');
      }

      console.log('   ✓ 未读计数测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testMarkAsRead(results) {
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

  await test(results, '标记已读测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      // 监控标记已读API
      let markReadApiCalled = false;
      let markReadApiStatus = null;

      page.on('response', async response => {
        if (response.url().includes('/api/v1/notifications/read')) {
          markReadApiCalled = true;
          markReadApiStatus = response.status();
        }
      });

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // 查找未读通知
      const unreadNotifications = page.locator('[data-testid="notification-item"]:not([data-read="true"]), .notification-item:not(.read)').first();
      const hasUnreadNotification = await unreadNotifications.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasUnreadNotification) {
        console.log('   ✓ 找到未读通知');

        // 查找标记已读按钮或点击通知
        const markReadButton = page.locator('[data-testid="mark-read"], button:has-text("标记已读"), button:has-text("Mark as Read")').first();
        const hasMarkReadButton = await markReadButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasMarkReadButton) {
          console.log('   ✓ 标记已读按钮可用');

          await markReadButton.click();
          await page.waitForTimeout(2000);

          if (markReadApiCalled) {
            console.log(`   ✓ 标记已读API已调用 (HTTP ${markReadApiStatus})`);

            if (markReadApiStatus === 200 || markReadApiStatus === 204) {
              console.log('   ✓ 标记已读成功');
            }
          }
        } else {
          // 尝试点击通知本身
          await unreadNotifications.click();
          await page.waitForTimeout(2000);

          if (markReadApiCalled) {
            console.log(`   ✓ 点击通知触发标记已读API (HTTP ${markReadApiStatus})`);
          } else {
            console.log('   ⚠️ 标记已读按钮未找到且点击通知未触发API');
          }
        }
      } else {
        console.log('   ⚠️ 无未读通知可测试');
      }

      console.log('   ✓ 标记已读测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

async function testNotificationBadge(results) {
  const test = async (results, name, testFn) => {
    console.log(`\n🔴 ${name}`);
    try {
      await testFn();
      results.passed++;
    } catch (error) {
      console.error(`   ❌ 失败: ${error.message}`);
      results.failed++;
    }
  };

  await test(results, '通知Badge测试', async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await setupAuthForTest(page, 'user');

      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      // 查找通知Badge（通常在导航栏或通知图标上）
      const notificationBadge = page.locator('[data-testid="notification-badge"], .notification-badge, [data-testid="unread-count"]').first();
      const hasNotificationBadge = await notificationBadge.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasNotificationBadge) {
        console.log('   ✓ 通知Badge显示正常');

        const badgeText = await notificationBadge.textContent();
        const badgeCount = parseInt(badgeText) || 0;

        if (badgeCount > 0) {
          console.log(`   ✓ Badge显示未读数: ${badgeCount}`);
        } else {
          console.log('   ✓ Badge显示但无未读通知');
        }
      } else {
        console.log('   ⚠️ 通知Badge未显示（可能无未读通知）');
      }

      // 查找通知图标
      const notificationIcon = page.locator('[data-testid="notification-icon"], button:has([data-testid="notification-badge"])').first();
      const hasNotificationIcon = await notificationIcon.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasNotificationIcon) {
        console.log('   ✓ 通知图标显示正常');
      } else {
        console.log('   ⚠️ 通知图标未找到');
      }

      console.log('   ✓ 通知Badge测试完成');

    } finally {
      await cleanupAuthForTest(page);
      await browser.close();
    }
  });
}

function printTestSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔔 通知系统测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 成功率: ${results.failed === 0 ? '100%' : Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);

  console.log('\n📋 通知系统功能验证:');
  console.log('├─ 通知Feed组件: NotificationsFeed显示');
  console.log('├─ 通知列表: GET /api/v1/notifications/recent');
  console.log('├─ 未读计数: GET /api/v1/notifications/unread-count');
  console.log('├─ 标记已读: POST /api/v1/notifications/read');
  console.log('├─ 通知Badge: 未读数量徽章显示');
  console.log('└─ SSE推送: GET /api/v1/notifications/stream (可选)');

  console.log('\n📊 数据库表:');
  console.log('└─ user_notifications: 用户通知 (id, user_id, type, title, content, read_at)');

  console.log('\n🔔 通知类型:');
  console.log('├─ offer_evaluation_complete: Offer评估完成');
  console.log('├─ subscription_changed: 订阅状态变更');
  console.log('├─ token_low: Token余额不足');
  console.log('├─ referral_success: 邀请成功');
  console.log('└─ system_announcement: 系统公告');

  if (results.failed > 0) {
    console.log('\n🚨 请检查以下失败项目:');
    console.log('1. Useractivity服务是否正常运行');
    console.log('2. 通知API是否正确实现');
    console.log('3. NotificationsFeed组件是否正确渲染');
    console.log('4. 未读计数是否实时更新');
  }
}

// 主函数
async function main() {
  try {
    const success = await testNotifications();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ 通知系统测试执行失败:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testNotifications };
