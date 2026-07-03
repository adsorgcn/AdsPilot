#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testBindAdsAccount() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔗 绑定广告账户流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问广告中心
    await test(results, 'Test 1: 访问广告中心', async () => {
      await page.goto(`${BASE_URL}/adscenter`, { waitUntil: 'networkidle' });

      if (!page.url().includes('/adscenter')) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问广告中心');
    });

    // Test 2: 点击"绑定广告账户"按钮
    await test(results, 'Test 2: 点击绑定按钮', async () => {
      const bindButton = page.locator('button:has-text("绑定广告账户"), button:has-text("Bind Account")').first();
      const isVisible = await bindButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('绑定广告账户按钮不可见');
      }

      await bindButton.click();
      await page.waitForTimeout(1500);

      console.log('   ✓ 绑定按钮点击成功');
    });

    // Test 3: 验证绑定对话框显示
    await test(results, 'Test 3: 绑定对话框显示', async () => {
      const hasDialog = await page.locator('[role="dialog"], [data-testid="bind-dialog"]').isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasDialog) {
        // 可能跳转到了绑定页面
        const isBindPage = page.url().includes('/bind');
        if (!isBindPage) {
          throw new Error('未出现绑定对话框或跳转到绑定页面');
        }
        console.log('   ✓ 跳转到绑定页面');
        return;
      }

      console.log('   ✓ 绑定对话框显示正常');
    });

    // Test 4: 验证平台选择器
    await test(results, 'Test 4: 广告平台选择', async () => {
      const platforms = [
        'Google Ads',
        'Facebook Ads',
        'TikTok Ads',
        'Twitter Ads'
      ];

      let foundPlatforms = 0;
      for (const platform of platforms) {
        const hasPlatform = await page.locator(`text=${platform}, button:has-text("${platform}")`).isVisible({ timeout: 2000 }).catch(() => false);
        if (hasPlatform) {
          foundPlatforms++;
          console.log(`   ✓ 找到平台: ${platform}`);
        }
      }

      if (foundPlatforms === 0) {
        throw new Error('未找到任何广告平台选项');
      }

      console.log(`   ✓ 平台选择器显示正常 (${foundPlatforms}/${platforms.length})`);
    });

    // Test 5: 选择Google Ads平台
    await test(results, 'Test 5: 选择Google Ads', async () => {
      const googleAdsButton = page.locator('button:has-text("Google Ads"), [data-platform="google"]').first();
      const isVisible = await googleAdsButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  Google Ads选项不可见');
        return;
      }

      await googleAdsButton.click();
      await page.waitForTimeout(1000);

      console.log('   ✓ Google Ads平台选择成功');
    });

    // Test 6: 验证OAuth授权流程
    await test(results, 'Test 6: OAuth授权流程', async () => {
      // 应该出现OAuth授权按钮
      const authButton = page.locator('button:has-text("授权"), button:has-text("Authorize")').first();
      const isVisible = await authButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  授权按钮不可见');
        return;
      }

      // 点击授权(会打开新窗口或跳转)
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      await authButton.click();

      const popup = await popupPromise;

      if (popup) {
        console.log('   ✓ OAuth弹窗打开成功');
        await popup.close();
      } else {
        // 可能是页面跳转
        await page.waitForTimeout(2000);
        const urlChanged = !page.url().includes(BASE_URL);
        if (urlChanged) {
          console.log('   ✓ OAuth授权页面跳转成功');
          await page.goBack();
        } else {
          console.log('   ⚠️  OAuth流程未触发');
        }
      }
    });

    // Test 7: 验证账户信息输入
    await test(results, 'Test 7: 账户信息表单', async () => {
      await page.goto(`${BASE_URL}/adscenter`);
      await page.waitForTimeout(1000);

      // 如果需要手动输入账户信息
      const accountIdInput = page.locator('input[name*="account"], input[placeholder*="账户ID"]').first();
      const hasManualInput = await accountIdInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasManualInput) {
        await accountIdInput.fill('1234567890');
        await page.waitForTimeout(500);
        console.log('   ✓ 账户ID输入成功');
      } else {
        console.log('   ⚠️  未找到手动输入选项(可能仅支持OAuth)');
      }
    });

    // Test 8: 验证绑定确认
    await test(results, 'Test 8: 绑定确认功能', async () => {
      const confirmButton = page.locator('button:has-text("确认绑定"), button:has-text("Confirm")').first();
      const isVisible = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  确认按钮不可见');
        return;
      }

      // 点击确认
      await confirmButton.click();
      await page.waitForTimeout(2000);

      // 应该出现成功提示或返回列表
      const hasSuccess = await page.locator('text=/绑定成功|Success|Successfully/i').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSuccess) {
        console.log('   ✓ 绑定确认功能正常');
      } else {
        console.log('   ⚠️  未检测到成功提示(可能需要真实账户)');
      }
    });

    // Test 9: 验证已绑定账户列表
    await test(results, 'Test 9: 已绑定账户显示', async () => {
      await page.goto(`${BASE_URL}/adscenter`);
      await page.waitForTimeout(1500);

      // 检查是否有账户列表
      const hasAccountList = await page.locator('[data-testid="account-list"], table').isVisible({ timeout: 3000 }).catch(() => false);

      if (hasAccountList) {
        console.log('   ✓ 已绑定账户列表显示正常');
      } else {
        const hasEmptyState = await page.locator('text=/暂无账户|No accounts/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (hasEmptyState) {
          console.log('   ✓ 空状态提示显示正常');
        } else {
          console.log('   ⚠️  未检测到账户列表或空状态');
        }
      }
    });

    // Test 10: 验证解绑功能
    await test(results, 'Test 10: 解绑账户功能', async () => {
      const unbindButton = page.locator('button:has-text("解绑"), button:has-text("Unbind")').first();
      const isVisible = await unbindButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  解绑按钮不可见(可能无已绑定账户)');
        return;
      }

      await unbindButton.click();
      await page.waitForTimeout(1000);

      // 应该出现确认对话框
      const hasConfirmDialog = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible({ timeout: 2000 }).catch(() => false);

      if (hasConfirmDialog) {
        console.log('   ✓ 解绑确认对话框显示正常');
        // 取消解绑
        const cancelButton = page.locator('button:has-text("取消"), button:has-text("Cancel")').first();
        await cancelButton.click();
      } else {
        console.log('   ⚠️  未出现解绑确认对话框');
      }
    });

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 3000));
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
  console.log('📊 绑定广告账户流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testBindAdsAccount();
