#!/usr/bin/env node

/**
 * Google OAuth 登录流程测试
 *
 * 使用方法：
 * node scripts/tests/test-google-oauth.mjs
 *
 * 环境变量：
 * - PREVIEW_BASE: 测试环境 URL（默认: https://www.urlchecker.dev）
 * - TEST_EMAIL: Google 测试账号邮箱（默认: manhwarecap99@gmail.com）
 * - HEADLESS: 是否无头模式（默认: false，显示浏览器窗口）
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const TEST_EMAIL = process.env.TEST_EMAIL || 'manhwarecap99@gmail.com';
const HEADLESS = process.env.HEADLESS === 'true';

console.log('🔐 Google OAuth 登录测试');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 测试环境: ${BASE_URL}`);
console.log(`📧 测试账号: ${TEST_EMAIL}`);
console.log(`🖥️  显示模式: ${HEADLESS ? '无头模式' : '浏览器窗口'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testGoogleOAuthFlow() {
  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : 100 // 非无头模式下放慢操作以便观察
  });

  const context = await browser.newContext({
    // 模拟真实用户环境
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  let testResults = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: 访问登录页面
    await runTest(testResults, 'Test 1: 访问登录页面', async () => {
      await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });
      const url = page.url();

      if (!url.includes('/auth/sign-in')) {
        throw new Error(`URL 不正确: ${url}`);
      }

      console.log(`   ✓ 成功访问: ${url}`);
    });

    // Test 2: 检查 Google 登录按钮
    await runTest(testResults, 'Test 2: 检查 Google 登录按钮', async () => {
      const googleButton = page.locator('button:has-text("Google"), button:has-text("Continue with Google"), a:has-text("Google")').first();
      const isVisible = await googleButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (!isVisible) {
        // 尝试查找其他可能的选择器
        const allButtons = await page.locator('button, a').allTextContents();
        console.log('   页面上的所有按钮文本:', allButtons.filter(t => t.trim()).slice(0, 10));
        throw new Error('未找到 Google 登录按钮');
      }

      console.log('   ✓ Google 登录按钮存在');
    });

    // Test 3: 点击 Google 登录（但不实际登录）
    await runTest(testResults, 'Test 3: Google OAuth 重定向', async () => {
      console.log('   ⚠️  注意：此测试需要手动完成 Google 登录');
      console.log('   提示：如果是无头模式，请设置 HEADLESS=false 重新运行');

      const googleButton = page.locator('button:has-text("Google"), button:has-text("Continue with Google"), a:has-text("Google")').first();

      // 监听新窗口（Google OAuth 弹窗）
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }),
        googleButton.click()
      ]).catch(async () => {
        // 如果没有弹窗，可能是重定向
        await page.waitForTimeout(2000);
        return [null];
      });

      if (popup) {
        const popupUrl = popup.url();
        console.log(`   ✓ 打开了 OAuth 弹窗: ${popupUrl.substring(0, 50)}...`);

        if (popupUrl.includes('accounts.google.com')) {
          console.log('   ✓ 正确重定向到 Google 账号登录页');

          // 如果不是无头模式，等待用户手动登录
          if (!HEADLESS) {
            console.log('\n   ⏳ 请在浏览器窗口中完成 Google 登录...');
            console.log('   等待最多 60 秒...\n');

            // 等待弹窗关闭（表示登录完成）或超时
            await popup.waitForEvent('close', { timeout: 60000 }).catch(() => {
              console.log('   ⚠️  超时：未检测到登录完成');
            });

            if (popup.isClosed()) {
              console.log('   ✓ OAuth 弹窗已关闭');

              // 等待主页面跳转到 dashboard
              await page.waitForURL('**/dashboard**', { timeout: 5000 }).catch(() => {
                console.log('   ⚠️  未自动跳转到 Dashboard');
              });

              if (page.url().includes('/dashboard')) {
                console.log('   ✓ 成功跳转到 Dashboard');
              }
            }
          }
        } else {
          throw new Error(`OAuth URL 不正确: ${popupUrl}`);
        }
      } else {
        // 检查是否是页面重定向（而不是弹窗）
        await page.waitForTimeout(2000);
        const currentUrl = page.url();

        if (currentUrl.includes('accounts.google.com')) {
          console.log('   ✓ 通过页面重定向到 Google 登录');

          if (!HEADLESS) {
            console.log('\n   ⏳ 请完成 Google 登录...');
            await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
          }
        } else {
          throw new Error('未检测到 Google OAuth 重定向');
        }
      }
    });

    // Test 4: 检查登录后状态（如果登录成功）
    if (page.url().includes('/dashboard')) {
      await runTest(testResults, 'Test 4: 验证登录后状态', async () => {
        console.log(`   ✓ 当前 URL: ${page.url()}`);

        // 检查是否有用户菜单
        const hasUserMenu = await page.locator('[data-testid="profile-dropdown"], button[aria-label*="profile" i], button[aria-label*="account" i]').first().isVisible({ timeout: 5000 }).catch(() => false);

        if (hasUserMenu) {
          console.log('   ✓ 用户菜单存在');
        } else {
          console.log('   ⚠️  未找到用户菜单（可能选择器需要更新）');
        }

        // 检查页面标题
        const title = await page.title();
        console.log(`   ✓ 页面标题: ${title}`);
      });

      // Test 5: 访问设置页面
      await runTest(testResults, 'Test 5: 访问设置页面', async () => {
        await page.goto(`${BASE_URL}/settings/profile`, { waitUntil: 'networkidle' });

        if (!page.url().includes('/settings')) {
          throw new Error('未能访问设置页面');
        }

        console.log('   ✓ 成功访问设置页面');
      });

      // Test 6: 测试退出登录
      await runTest(testResults, 'Test 6: 退出登录', async () => {
        await page.goto(`${BASE_URL}/dashboard`);

        // 尝试找到退出按钮
        const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), button:has-text("退出")').first();
        const hasButton = await signOutButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasButton) {
          await signOutButton.click();
          await page.waitForTimeout(2000);

          const afterLogoutUrl = page.url();
          console.log(`   ✓ 退出后 URL: ${afterLogoutUrl}`);

          if (afterLogoutUrl.includes('/auth') || afterLogoutUrl.includes('/en') || afterLogoutUrl === `${BASE_URL}/`) {
            console.log('   ✓ 成功退出登录');
          }
        } else {
          console.log('   ⚠️  未找到退出按钮，跳过此测试');
        }
      });
    } else {
      console.log('\n   ℹ️  未完成登录，跳过登录后功能测试');
    }

  } catch (error) {
    console.error('\n❌ 测试执行出错:', error.message);
    testResults.failed++;
  } finally {
    if (!HEADLESS) {
      console.log('\n⏸️  按 Ctrl+C 关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    await browser.close();
  }

  // 输出测试结果
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  const total = testResults.passed + testResults.failed;
  console.log(`📈 通过率: ${total > 0 ? Math.round(testResults.passed * 100 / total) : 0}%`);

  console.log('\n测试详情:');
  testResults.tests.forEach((test, index) => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
  });

  if (testResults.failed > 0) {
    process.exit(1);
  }
}

async function runTest(results, testName, testFn) {
  console.log(`\n${testName}`);
  try {
    await testFn();
    results.passed++;
    results.tests.push({ name: testName, passed: true });
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
    results.tests.push({ name: testName, passed: false, error: error.message });
  }
}

// 检查 Playwright 是否安装
try {
  await import('playwright');
} catch (error) {
  console.error('❌ 错误: 未找到 Playwright');
  console.error('请先安装: npm install -D playwright');
  console.error('或者: npx playwright install chromium');
  process.exit(1);
}

testGoogleOAuthFlow().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
