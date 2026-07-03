#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const HEADLESS = process.env.HEADLESS !== 'false';

async function testLoginFlow() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔐 登录流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    // Test 1: 访问登录页面
    await test(results, 'Test 1: 访问登录页面', async () => {
      await page.goto(`${BASE_URL}/auth/sign-in`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/auth/sign-in')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log(`   ✓ 成功访问: ${page.url()}`);
    });

    // Test 2: Google登录按钮存在且可点击
    await test(results, 'Test 2: Google登录按钮', async () => {
      const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")').first();

      const isVisible = await googleButton.isVisible();
      if (!isVisible) {
        throw new Error('Google登录按钮不可见');
      }

      const isEnabled = await googleButton.isEnabled();
      if (!isEnabled) {
        throw new Error('Google登录按钮被禁用');
      }

      const buttonText = await googleButton.textContent();
      console.log(`   ✓ 按钮可见且可点击: "${buttonText?.trim()}"`);
    });

    // Test 3: 点击Google登录（触发OAuth）
    await test(results, 'Test 3: 触发OAuth流程', async () => {
      if (!HEADLESS) {
        console.log('   ⏳ 请在浏览器中完成Google登录...');
      }

      const googleButton = page.locator('button:has-text("Google"), a:has-text("Google")').first();

      // 监听新窗口（OAuth弹窗）
      const [popup] = await Promise.all([
        context.waitForEvent('page', { timeout: 10000 }),
        googleButton.click()
      ]).catch(() => [null]);

      if (popup) {
        const popupUrl = popup.url();
        console.log(`   ✓ OAuth弹窗已打开: ${popupUrl.substring(0, 50)}...`);

        if (!popupUrl.includes('accounts.google.com')) {
          throw new Error('OAuth URL不正确');
        }

        if (!HEADLESS) {
          // 等待用户手动登录
          await popup.waitForEvent('close', { timeout: 60000 }).catch(() => {
            console.log('   ⚠️  登录超时');
          });

          if (popup.isClosed()) {
            console.log('   ✓ OAuth完成，弹窗已关闭');
          }
        }
      } else {
        if (HEADLESS) {
          console.log('   ℹ️  无头模式下跳过实际OAuth');
        } else {
          throw new Error('未检测到OAuth弹窗');
        }
      }
    });

    // Test 4: 登录后重定向到Dashboard
    if (!HEADLESS && page.url().includes('/dashboard')) {
      await test(results, 'Test 4: 登录后重定向', async () => {
        console.log(`   ✓ 已重定向到: ${page.url()}`);

        if (!page.url().includes('/dashboard')) {
          throw new Error('未重定向到Dashboard');
        }
      });

      // Test 5: Session持久化验证
      await test(results, 'Test 5: Session持久化', async () => {
        // 刷新页面
        await page.reload({ waitUntil: 'networkidle' });

        // 仍然在Dashboard（未被重定向到登录页）
        if (!page.url().includes('/dashboard')) {
          throw new Error('Session未持久化，被重定向到登录页');
        }

        console.log('   ✓ Session持久化正常');
      });

      // Test 6: 用户信息显示
      await test(results, 'Test 6: 用户信息显示', async () => {
        // 查找用户菜单或邮箱显示
        const userMenu = page.locator('[data-testid="profile-dropdown"], button[aria-label*="profile" i]').first();
        const hasMenu = await userMenu.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasMenu) {
          console.log('   ✓ 用户菜单可见');
        } else {
          console.log('   ⚠️  未找到用户菜单（可能选择器需要更新）');
        }
      });

      // Test 7: 退出登录
      await test(results, 'Test 7: 退出登录', async () => {
        const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("退出")').first();
        const hasButton = await signOutButton.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasButton) {
          await signOutButton.click();
          await page.waitForTimeout(2000);

          const afterLogoutUrl = page.url();
          console.log(`   ✓ 退出后URL: ${afterLogoutUrl}`);

          // 验证重定向到登录页或首页
          if (afterLogoutUrl.includes('/auth') || afterLogoutUrl.match(/\/(en|zh-CN)\/?$/)) {
            console.log('   ✓ 成功退出登录');
          } else {
            throw new Error('退出后未正确重定向');
          }

          // Test 8: 退出后无法访问Dashboard
          await page.goto(`${BASE_URL}/dashboard`);
          await page.waitForTimeout(1000);

          if (page.url().includes('/auth')) {
            console.log('   ✓ 退出后Dashboard受保护');
          } else {
            throw new Error('退出后仍可访问Dashboard');
          }
        } else {
          console.log('   ⚠️  未找到退出按钮，跳过退出测试');
        }
      });
    } else {
      console.log('\n   ℹ️  未完成登录，跳过登录后测试');
      results.failed += 5; // 标记为未测试
    }

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    if (!HEADLESS) {
      console.log('\n⏸️  浏览器将在3秒后关闭...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    await browser.close();
  }

  printSummary(results);
}

async function test(results, name, testFn) {
  console.log(`\n${name}`);
  try {
    await testFn();
    results.passed++;
  } catch (error) {
    console.error(`   ❌ 失败: ${error.message}`);
    results.failed++;
  }
}

function printSummary(results) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 登录流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  const total = results.passed + results.failed;
  const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  console.log(`📈 通过率: ${passRate}%`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testLoginFlow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
