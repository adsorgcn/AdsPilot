#!/usr/bin/env node

/**
 * 测试辅助模块 - 程序化登录
 *
 * 依赖后端API: POST /api/test/create-session
 *
 * @param {Page} page - Playwright页面对象
 * @param {string} role - 用户角色 ('user' | 'admin' | 'guest')
 */

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const TEST_API_URL = process.env.TEST_API_URL || BASE_URL;

export async function setupAuthForTest(page, role = 'user') {
  console.log(`\n🔐 程序化登录: ${role}`);

  // 监听console错误和网络错误
  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', response => {
    if (response.status() === 404) {
      failedRequests.push(response.url());
    }
  });

  try {
    // Step 1: 调用后端测试API创建Session
    const response = await fetch(`${TEST_API_URL}/api/test/create-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `test-${role}@autoads.dev`,
        role: role,
      }),
    });

    if (!response.ok) {
      throw new Error(`创建测试Session失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const { action_link, user_id, email } = data;

    if (!action_link) {
      throw new Error('API响应中缺少action_link字段');
    }

    console.log(`   ✓ 测试Session已创建`);
    console.log(`   ✓ User ID: ${user_id}`);
    console.log(`   ✓ Email: ${email}`);

    // Step 2: 访问Supabase magic link完成认证
    console.log(`   → 访问认证链接...`);

    // 不等待networkidle,因为页面会立即重定向
    await page.goto(action_link, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Step 3: 等待/auth/confirm页面处理tokens并自动重定向到dashboard
    // 页面会从hash fragment提取tokens,设置session,然后重定向到/dashboard
    console.log(`   → 等待认证确认和自动重定向...`);

    // 等待URL变化到dashboard (等待最长20秒,因为confirm页面有2.5秒延迟)
    try {
      await page.waitForURL('**/dashboard**', { timeout: 20000 });
      console.log(`   ✓ 已重定向到dashboard`);
    } catch (timeoutError) {
      // 如果超时,检查当前URL
      const currentUrl = page.url();
      console.log(`   ⚠ 等待重定向超时,当前URL: ${currentUrl}`);

      // 检查是否已经在dashboard页面
      if (currentUrl.includes('/dashboard')) {
        console.log(`   ✓ 已在dashboard页面,继续`);
      } else if (currentUrl.includes('/auth/confirm')) {
        // 如果还在confirm页面,手动等待并检查
        console.log(`   → 仍在confirm页面,手动等待3秒...`);
        await page.waitForTimeout(3000);

        const newUrl = page.url();
        if (!newUrl.includes('/dashboard')) {
          throw new Error(`认证确认超时: 停留在 ${newUrl}`);
        }
      } else {
        throw new Error(`认证失败: 意外的URL ${currentUrl}`);
      }
    }

    // Step 4: 验证登录成功
    const finalUrl = page.url();
    console.log(`   ✓ 认证重定向完成`);
    console.log(`   → 最终URL: ${finalUrl}`);

    // 等待页面完全加载
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      console.log(`   ✓ 页面加载完成`);
    } catch (e) {
      console.log(`   ⚠ networkidle超时,但继续执行`);
    }

    const isLoggedIn = finalUrl.includes('/dashboard');
    if (!isLoggedIn) {
      // 打印404资源帮助调试
      if (failedRequests.length > 0) {
        console.log(`\n   ⚠ 404错误资源 (前10个):`);
        failedRequests.slice(0, 10).forEach(url => console.log(`     - ${url}`));
      }
      // 打印console错误
      if (consoleErrors.length > 0) {
        console.log(`\n   ⚠ Console错误 (前5个):`);
        consoleErrors.slice(0, 5).forEach(err => console.log(`     - ${err}`));
      }
      throw new Error(`登录验证失败: 期望包含/dashboard，实际: ${finalUrl}`);
    }

    console.log(`   ✓ 登录验证成功\n`);
    return true;

  } catch (error) {
    console.error(`\n❌ 程序化登录失败: ${error.message}`);
    console.error(`\n⚠️  请确保:`);
    console.error(`   1. 后端测试API已实现: POST /api/test/create-session`);
    console.error(`   2. 后端服务正在运行: ${TEST_API_URL}`);
    console.error(`   3. Supabase认证回调正常工作\n`);
    throw error;
  }
}

/**
 * 清理测试Session (可选)
 */
export async function cleanupAuthForTest(page) {
  console.log(`\n🧹 清理测试Session`);

  try {
    // 清除所有Cookies
    await page.context().clearCookies();
    console.log(`   ✓ Session已清除\n`);
  } catch (error) {
    console.error(`   ⚠️  清理失败: ${error.message}\n`);
  }
}

/**
 * 获取测试用户邮箱
 */
export function getTestUserEmail(role = 'user') {
  return `test-${role}@autoads.dev`;
}
