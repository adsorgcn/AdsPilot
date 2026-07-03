#!/usr/bin/env node

/**
 * 测试程序化登录功能
 * 验证：
 * 1. POST /api/test/create-session API可用
 * 2. 返回有效的action_link
 * 3. Playwright能够使用action_link完成登录
 * 4. 登录后可以访问受保护的dashboard页面
 */

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

const BASE_URL = process.env.PREVIEW_BASE || 'http://localhost:3000';
const TEST_API_URL = process.env.TEST_API_URL || BASE_URL;

async function testProgrammaticLogin() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 程序化登录功能测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 测试环境: ${BASE_URL}`);
  console.log(`📍 API地址: ${TEST_API_URL}`);
  console.log('');

  let browser;
  let passed = 0;
  let failed = 0;

  try {
    // Test 1: API可用性测试
    console.log('Test 1: API可用性检查');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const response = await fetch(`${TEST_API_URL}/api/test/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-playwright@autoads.dev',
          role: 'user',
        }),
      });

      if (!response.ok) {
        throw new Error(`API返回错误: ${response.status}`);
      }

      const data = await response.json();

      console.log(`   ✓ API响应成功`);
      console.log(`   ✓ User ID: ${data.user_id}`);
      console.log(`   ✓ Email: ${data.email}`);

      if (!data.action_link) {
        throw new Error('响应中缺少action_link字段');
      }

      console.log(`   ✓ action_link存在`);
      console.log(`   → ${data.action_link.substring(0, 80)}...`);
      passed++;
    } catch (error) {
      console.error(`   ❌ API测试失败: ${error.message}`);
      failed++;
      throw error; // API不可用，无需继续测试
    }

    console.log('');

    // Test 2: Playwright集成测试
    console.log('Test 2: Playwright集成测试');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    try {
      // 执行程序化登录
      await setupAuthForTest(page, 'user');

      console.log(`   ✓ setupAuthForTest执行成功`);
      passed++;
    } catch (error) {
      console.error(`   ❌ 程序化登录失败: ${error.message}`);
      failed++;
      throw error;
    }

    console.log('');

    // Test 3: Dashboard访问验证
    console.log('Test 3: Dashboard访问验证');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const currentUrl = page.url();
      console.log(`   → 当前URL: ${currentUrl}`);

      if (!currentUrl.includes('/dashboard')) {
        throw new Error(`未重定向到dashboard，当前: ${currentUrl}`);
      }

      console.log(`   ✓ 成功访问Dashboard`);

      // 检查是否有用户菜单或其他登录标识
      const pageContent = await page.content();
      console.log(`   ✓ 页面内容长度: ${pageContent.length} bytes`);

      passed++;
    } catch (error) {
      console.error(`   ❌ Dashboard验证失败: ${error.message}`);
      failed++;
    }

    console.log('');

    // Test 4: Session持久性测试
    console.log('Test 4: Session持久性测试');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 刷新页面，验证session仍然有效
      await page.reload({ waitUntil: 'networkidle' });

      const urlAfterReload = page.url();
      console.log(`   → 刷新后URL: ${urlAfterReload}`);

      if (!urlAfterReload.includes('/dashboard')) {
        throw new Error(`刷新后丢失session，重定向到: ${urlAfterReload}`);
      }

      console.log(`   ✓ Session刷新后仍然有效`);
      passed++;
    } catch (error) {
      console.error(`   ❌ Session持久性测试失败: ${error.message}`);
      failed++;
    }

  } catch (error) {
    console.error(`\n❌ 测试过程中发生错误: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // 打印汇总
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  const total = passed + failed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`📈 通过率: ${passRate}%`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

testProgrammaticLogin().catch((error) => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
