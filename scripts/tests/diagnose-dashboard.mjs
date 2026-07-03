#!/usr/bin/env node

/**
 * Dashboard页面诊断工具
 *
 * 目的：
 * 1. 检查DOM结构
 * 2. 查找统计卡片
 * 3. 检查API请求
 * 4. 分析控制台错误
 */

import { chromium } from 'playwright';
import { setupAuthForTest } from './helpers/auth.mjs';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function diagnoseDashboard() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Dashboard页面诊断工具');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // 收集控制台日志
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  // 收集网络请求
  const networkRequests = [];
  page.on('request', request => {
    if (request.url().includes('api') || request.url().includes('supabase')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
      });
    }
  });

  // 收集网络响应
  const networkResponses = [];
  page.on('response', async response => {
    if (response.url().includes('api') || response.url().includes('supabase')) {
      try {
        const body = await response.text().catch(() => 'unable to read');
        networkResponses.push({
          url: response.url(),
          status: response.status(),
          body: body.length > 500 ? body.substring(0, 500) + '...' : body,
        });
      } catch (e) {
        // ignore
      }
    }
  });

  try {
    // 登录
    console.log('🔐 执行程序化登录...');
    await setupAuthForTest(page, 'user');

    // 等待页面完全加载
    console.log('⏳ 等待页面加载...');
    await page.waitForTimeout(3000);

    console.log('\n📄 1. 页面基本信息');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`URL: ${page.url()}`);
    console.log(`Title: ${await page.title()}`);

    // 获取完整HTML
    const html = await page.content();
    console.log(`HTML长度: ${html.length} bytes`);

    // 检查是否有React hydration错误
    console.log('\n🐛 2. 控制台日志');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const errors = consoleLogs.filter(log => log.type === 'error');
    const warnings = consoleLogs.filter(log => log.type === 'warning');

    if (errors.length > 0) {
      console.log(`❌ 错误日志 (${errors.length}条):`);
      errors.forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.text}`);
      });
    } else {
      console.log('✅ 无错误日志');
    }

    if (warnings.length > 0) {
      console.log(`\n⚠️  警告日志 (${warnings.length}条):`);
      warnings.slice(0, 5).forEach((log, i) => {
        console.log(`  ${i + 1}. ${log.text}`);
      });
    }

    // 检查网络请求
    console.log('\n🌐 3. 网络请求');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`总请求数: ${networkRequests.length}`);

    const apiRequests = networkRequests.filter(req =>
      req.url.includes('/api/') && !req.url.includes('auth')
    );

    console.log(`API请求: ${apiRequests.length}条`);
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    // 检查API响应
    console.log('\n📥 4. API响应');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const apiResponses = networkResponses.filter(res =>
      res.url.includes('/api/') && !res.url.includes('auth')
    );

    if (apiResponses.length === 0) {
      console.log('⚠️  没有检测到任何API响应！');
    } else {
      apiResponses.forEach(res => {
        console.log(`\nURL: ${res.url}`);
        console.log(`Status: ${res.status}`);
        console.log(`Body: ${res.body}`);
      });
    }

    // 检查DOM结构
    console.log('\n🏗️  5. DOM结构分析');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 查找可能的统计卡片容器
    const possibleSelectors = [
      '[data-testid*="stat"]',
      '[class*="stat"]',
      '[class*="card"]',
      '[class*="metric"]',
      '[class*="dashboard"]',
      'div[class*="grid"]',
      'main',
    ];

    for (const selector of possibleSelectors) {
      const elements = await page.locator(selector).all();
      if (elements.length > 0) {
        console.log(`\n找到 ${elements.length} 个匹配 "${selector}" 的元素`);

        // 打印前3个元素的详细信息
        for (let i = 0; i < Math.min(3, elements.length); i++) {
          const el = elements[i];
          const tagName = await el.evaluate(node => node.tagName);
          const className = await el.evaluate(node => node.className);
          const text = await el.textContent();

          console.log(`  元素 ${i + 1}:`);
          console.log(`    标签: ${tagName}`);
          console.log(`    Class: ${className}`);
          console.log(`    文本: ${text.substring(0, 100)}...`);
        }
      }
    }

    // 查找特定文本
    console.log('\n🔎 6. 文本内容搜索');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const searchTexts = [
      'Dashboard',
      'Offers',
      'Tasks',
      'Tokens',
      'Statistics',
      '统计',
      '总数',
    ];

    for (const text of searchTexts) {
      const found = await page.locator(`text=${text}`).count();
      console.log(`"${text}": ${found}次`);
    }

    // 获取main内容
    console.log('\n📋 7. Main内容结构');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const mainContent = await page.locator('main').innerHTML();
    console.log(`Main HTML长度: ${mainContent.length} bytes`);

    // 检查是否有加载状态
    const hasLoading = mainContent.includes('loading') || mainContent.includes('skeleton');
    console.log(`是否有加载状态: ${hasLoading ? '是' : '否'}`);

    // 检查是否有空状态
    const hasEmpty = mainContent.includes('empty') || mainContent.includes('no data') || mainContent.includes('暂无');
    console.log(`是否有空状态: ${hasEmpty ? '是' : '否'}`);

    // 保存完整HTML用于分析
    const fs = await import('fs');
    const reportPath = '/tmp/dashboard-diagnosis.html';
    await fs.promises.writeFile(reportPath, html);
    console.log(`\n💾 完整HTML已保存到: ${reportPath}`);

    // 保存截图
    const screenshotPath = '/tmp/dashboard-screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 截图已保存到: ${screenshotPath}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 诊断完成！请查看上述信息分析问题原因。');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 保持浏览器打开30秒供手动检查
    console.log('⏰ 浏览器将保持打开30秒供手动检查...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ 诊断过程中发生错误:', error);
  } finally {
    await browser.close();
  }
}

diagnoseDashboard().catch(console.error);
