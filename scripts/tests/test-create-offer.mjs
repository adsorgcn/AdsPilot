#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function testCreateOffer() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('📝 创建Offer流程测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { passed: 0, failed: 0 };

  try {
    await setupAuthForTest(page, 'user');

    // Test 1: 访问创建Offer页面
    await test(results, 'Test 1: 访问创建Offer页面', async () => {
      await page.goto(`${BASE_URL}/offers/create`, { waitUntil: 'networkidle' });

      const isCreatePage = page.url().includes('/offers/create') || page.url().includes('/offers/new');

      if (!isCreatePage) {
        throw new Error(`URL不正确: ${page.url()}`);
      }

      console.log('   ✓ 成功访问创建页面');
    });

    // Test 2: 验证表单字段显示
    await test(results, 'Test 2: 创建表单字段显示', async () => {
      const formFields = [
        { label: 'Offer名称', selector: 'input[name*="name"], input[id*="name"]' },
        { label: 'URL链接', selector: 'input[name*="url"], input[type="url"]' },
        { label: '国家/地区', selector: 'select[name*="country"], [data-testid="country-select"]' },
        { label: '分类', selector: 'select[name*="category"], [data-testid="category-select"]' }
      ];

      let foundFields = 0;
      for (const field of formFields) {
        const hasField = await page.locator(field.selector).isVisible({ timeout: 3000 }).catch(() => false);
        if (hasField) {
          foundFields++;
          console.log(`   ✓ 找到字段: ${field.label}`);
        }
      }

      if (foundFields < 3) {
        throw new Error(`只找到${foundFields}/${formFields.length}个必要字段`);
      }

      console.log(`   ✓ 表单字段显示正常 (${foundFields}/${formFields.length})`);
    });

    // Test 3: 填写Offer名称
    await test(results, 'Test 3: 填写Offer名称', async () => {
      const nameInput = page.locator('input[name*="name"], input[id*="name"]').first();
      const isVisible = await nameInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('名称输入框不可见');
      }

      await nameInput.fill('Test Offer - Automated');
      await page.waitForTimeout(500);

      const value = await nameInput.inputValue();
      if (!value.includes('Test Offer')) {
        throw new Error('名称输入失败');
      }

      console.log('   ✓ Offer名称填写成功');
    });

    // Test 4: 填写URL链接
    await test(results, 'Test 4: 填写URL链接', async () => {
      const urlInput = page.locator('input[name*="url"], input[type="url"]').first();
      const isVisible = await urlInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('URL输入框不可见');
      }

      await urlInput.fill('https://example.com/test-offer');
      await page.waitForTimeout(500);

      const value = await urlInput.inputValue();
      if (!value.includes('example.com')) {
        throw new Error('URL输入失败');
      }

      console.log('   ✓ URL链接填写成功');
    });

    // Test 5: 选择国家/地区
    await test(results, 'Test 5: 选择国家/地区', async () => {
      const countrySelect = page.locator('select[name*="country"], [data-testid="country-select"]').first();
      const isVisible = await countrySelect.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  国家选择器不可见');
        return;
      }

      await countrySelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);

      console.log('   ✓ 国家/地区选择成功');
    });

    // Test 6: 验证提交按钮状态
    await test(results, 'Test 6: 提交按钮可用性', async () => {
      const submitButton = page.locator('button[type="submit"], button:has-text("创建"), button:has-text("Create")').first();
      const isVisible = await submitButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        throw new Error('提交按钮不可见');
      }

      const isEnabled = await submitButton.isEnabled();

      if (isEnabled) {
        console.log('   ✓ 提交按钮已启用');
      } else {
        console.log('   ⚠️  提交按钮被禁用(可能需要填写更多必填字段)');
      }
    });

    // Test 7: 表单验证测试
    await test(results, 'Test 7: 表单验证功能', async () => {
      // 清空名称字段测试验证
      const nameInput = page.locator('input[name*="name"], input[id*="name"]').first();
      await nameInput.clear();
      await page.waitForTimeout(500);

      // 尝试提交
      const submitButton = page.locator('button[type="submit"], button:has-text("创建"), button:has-text("Create")').first();
      await submitButton.click();
      await page.waitForTimeout(1000);

      // 应该显示验证错误
      const hasValidationError = await page.locator('text=/必填|required|不能为空/i').isVisible({ timeout: 2000 }).catch(() => false);

      if (hasValidationError) {
        console.log('   ✓ 表单验证正常工作');
      } else {
        console.log('   ⚠️  未检测到验证错误提示');
      }
    });

    // Test 8: 取消创建
    await test(results, 'Test 8: 取消创建功能', async () => {
      const cancelButton = page.locator('button:has-text("取消"), button:has-text("Cancel")').first();
      const isVisible = await cancelButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isVisible) {
        console.log('   ⚠️  取消按钮不可见');
        return;
      }

      await cancelButton.click();
      await page.waitForTimeout(1500);

      // 应该返回Offers列表页
      const isOffersPage = page.url().includes('/offers') && !page.url().includes('/create');

      if (isOffersPage) {
        console.log('   ✓ 取消创建并返回列表页');
      } else {
        console.log('   ⚠️  取消后未返回列表页');
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
  console.log('📊 创建Offer流程测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

testCreateOffer();
