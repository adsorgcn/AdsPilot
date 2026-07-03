#!/usr/bin/env node

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function debugDashboard() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🔍 Dashboard调试测试\n');

  // 收集所有console消息
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    consoleMessages.push({ type, text: msg.text() });
  });

  // 收集所有network请求
  const networkRequests = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/rest/') || url.includes('supabase')) {
      const status = response.status();
      let body = null;
      try {
        if (status !== 204 && response.headers()['content-type']?.includes('json')) {
          body = await response.json();
        }
      } catch (e) {
        // 忽略解析错误
      }
      networkRequests.push({ url, status, body });
    }
  });

  try {
    console.log('🔐 步骤1: 设置认证...');
    await setupAuthForTest(page, 'user');
    console.log('   ✅ 认证完成\n');

    console.log('🌐 步骤2: 访问Dashboard页面...');
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('   ✅ 页面加载完成\n');

    console.log('📄 步骤3: 检查页面HTML结构...');
    const html = await page.content();
    console.log(`   页面HTML长度: ${html.length} bytes`);

    const hasTestIds = html.includes('data-testid');
    console.log(`   包含data-testid: ${hasTestIds ? '✅' : '❌'}`);

    if (hasTestIds) {
      const testIdMatches = html.match(/data-testid="[^"]+"/g);
      if (testIdMatches) {
        console.log(`   找到 ${testIdMatches.length} 个data-testid属性`);
        console.log(`   前5个: ${testIdMatches.slice(0, 5).join(', ')}`);
      }
    }
    console.log('');

    console.log('🎯 步骤4: 检查关键元素是否存在...');
    const testIds = [
      'dashboard-stats-grid',
      'stat-card-total-offers',
      'stat-card-pending-offers',
      'stat-card-ready-offers',
      'stat-card-tokens',
      'quick-actions-card',
      'quick-action-manage-offers'
    ];

    for (const testId of testIds) {
      const exists = await page.locator(`[data-testid="${testId}"]`).count();
      const visible = await page.locator(`[data-testid="${testId}"]`).isVisible().catch(() => false);
      console.log(`   [${testId}]: ${exists > 0 ? '✅ 存在' : '❌ 不存在'}${exists > 0 ? (visible ? ' (可见)' : ' (不可见)') : ''}`);

      if (exists > 0 && !visible) {
        // 检查为什么不可见
        const element = page.locator(`[data-testid="${testId}"]`).first();
        const boundingBox = await element.boundingBox().catch(() => null);
        const isHidden = await element.isHidden().catch(() => true);
        console.log(`      - boundingBox: ${boundingBox ? JSON.stringify(boundingBox) : 'null'}`);
        console.log(`      - isHidden: ${isHidden}`);
      }
    }
    console.log('');

    console.log('📡 步骤5: 分析Network请求...');
    console.log(`   共捕获 ${networkRequests.length} 个API请求\n`);

    networkRequests.forEach((req, idx) => {
      console.log(`   ${idx + 1}. [${req.status}] ${req.url}`);
      if (req.status >= 400) {
        console.log(`      ❌ 错误响应: ${JSON.stringify(req.body)}`);
      } else if (req.body && Array.isArray(req.body)) {
        console.log(`      ✅ 返回 ${req.body.length} 条记录`);
      } else if (req.body) {
        console.log(`      ✅ 响应: ${JSON.stringify(req.body).substring(0, 100)}...`);
      }
    });
    console.log('');

    console.log('🐛 步骤6: 分析Console日志...');
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    console.log(`   错误: ${errors.length} 个`);
    errors.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. [ERROR] ${msg.text}`);
    });

    console.log(`   警告: ${warnings.length} 个`);
    warnings.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. [WARNING] ${msg.text}`);
    });
    console.log('');

    console.log('📸 步骤7: 截图保存...');
    await page.screenshot({ path: '/tmp/dashboard-debug.png', fullPage: true });
    console.log('   ✅ 截图已保存到 /tmp/dashboard-debug.png\n');

    console.log('🔍 步骤8: 检查StatCard组件渲染...');
    const statCardHtml = await page.locator('[data-testid="stat-card-total-offers"]').innerHTML().catch(() => null);
    if (statCardHtml) {
      console.log(`   StatCard HTML: ${statCardHtml.substring(0, 200)}...`);
    } else {
      console.log('   ❌ StatCard未找到或未渲染');

      // 检查是否有loading状态
      const hasLoading = await page.locator('text=/loading|加载中/i').isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`   Loading状态: ${hasLoading ? '✅ 显示' : '❌ 未显示'}`);

      // 检查是否有错误提示
      const hasError = await page.locator('text=/error|错误/i').isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`   错误提示: ${hasError ? '✅ 显示' : '❌ 未显示'}`);
    }
    console.log('');

    console.log('⏸️  浏览器保持打开30秒以便手动检查...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ 调试失败:', error);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

debugDashboard();
