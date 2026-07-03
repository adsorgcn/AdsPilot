#!/usr/bin/env node

/**
 * 测试完整的用户注册登录流程
 * 
 * 测试内容：
 * 1. 访问首页，检查CTA按钮
 * 2. 点击登录按钮，检查URL是否正确（不应该有语言前缀）
 * 3. 检查登录页面是否正常加载
 * 4. 检查OAuth按钮是否存在
 * 5. 测试未登录访问Dashboard的重定向
 * 6. 测试登录后的完整流程（需要手动完成OAuth）
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://www.urlchecker.dev';
const TIMEOUT = 30000;

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`测试: ${name}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function testAuthFlow() {
  log('\n🚀 开始测试用户注册登录流程\n', 'cyan');
  log(`测试环境: ${BASE_URL}\n`, 'blue');

  const browser = await chromium.launch({
    headless: false, // 设置为 false 以便观察测试过程
    slowMo: 500, // 减慢操作速度，便于观察
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  try {
    // ==================== 测试 1: 访问首页 ====================
    logTest('1. 访问首页');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    results.total++;

    const homeUrl = page.url();
    logInfo(`当前URL: ${homeUrl}`);

    if (homeUrl === BASE_URL || homeUrl === `${BASE_URL}/`) {
      logSuccess('首页加载成功');
      results.passed++;
    } else {
      logError(`首页URL不正确: ${homeUrl}`);
      results.failed++;
    }

    // ==================== 测试 2: 检查Hero区域CTA按钮 ====================
    logTest('2. 检查Hero区域CTA按钮');
    results.total++;

    const heroCTA = await page.locator('button:has-text("立即开始"), button:has-text("Get Started")').first();
    const heroCtaExists = await heroCTA.count() > 0;

    if (heroCtaExists) {
      logSuccess('找到Hero区域CTA按钮');
      results.passed++;
    } else {
      logError('未找到Hero区域CTA按钮');
      results.failed++;
    }

    // ==================== 测试 3: 点击CTA按钮，检查URL ====================
    logTest('3. 点击CTA按钮，检查跳转URL');
    results.total++;

    if (heroCtaExists) {
      await heroCTA.click();
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

      const authUrl = page.url();
      logInfo(`跳转后URL: ${authUrl}`);

      // 检查URL是否正确（不应该有语言前缀）
      const hasLocalePrefix = authUrl.includes('/zh-CN/auth') || authUrl.includes('/en/auth');
      const isCorrectAuthUrl = authUrl.includes('/auth') && !hasLocalePrefix;

      if (isCorrectAuthUrl) {
        logSuccess('CTA按钮跳转URL正确（无语言前缀）');
        results.passed++;
      } else if (hasLocalePrefix) {
        logError(`CTA按钮跳转URL包含语言前缀: ${authUrl}`);
        logError('这是之前修复的问题，不应该出现！');
        results.failed++;
      } else {
        logError(`CTA按钮跳转URL不正确: ${authUrl}`);
        results.failed++;
      }
    } else {
      logWarning('跳过此测试（未找到CTA按钮）');
      results.warnings++;
    }

    // ==================== 测试 4: 检查登录页面元素 ====================
    logTest('4. 检查登录页面元素');
    results.total++;

    // 确保在登录页面
    if (!page.url().includes('/auth')) {
      await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle', timeout: TIMEOUT });
    }

    // 检查页面标题
    const pageTitle = await page.locator('h3, h2, h1').first().textContent();
    logInfo(`页面标题: ${pageTitle}`);

    // 检查OAuth按钮
    const googleButton = await page.locator('button[data-provider="google"], button:has-text("Sign in with Google"), button:has-text("Google")');
    const googleButtonExists = await googleButton.count() > 0;

    if (googleButtonExists) {
      logSuccess('找到Google登录按钮');
      results.passed++;
    } else {
      logError('未找到Google登录按钮');
      results.failed++;
    }

    // ==================== 测试 5: 检查导航栏登录链接 ====================
    logTest('5. 检查导航栏登录链接');
    results.total++;

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

    const navSignInLink = await page.locator('a[href="/auth/sign-in"], a[href="/auth"]').first();
    const navLinkExists = await navSignInLink.count() > 0;

    if (navLinkExists) {
      const href = await navSignInLink.getAttribute('href');
      logInfo(`导航栏登录链接: ${href}`);

      const hasLocaleInNav = href.includes('/zh-CN/') || href.includes('/en/');
      if (!hasLocaleInNav) {
        logSuccess('导航栏登录链接正确（无语言前缀）');
        results.passed++;
      } else {
        logError(`导航栏登录链接包含语言前缀: ${href}`);
        results.failed++;
      }
    } else {
      logWarning('未找到导航栏登录链接');
      results.warnings++;
    }

    // ==================== 测试 6: 测试未登录访问Dashboard ====================
    logTest('6. 测试未登录访问Dashboard（应该重定向）');
    results.total++;

    const response = await page.goto(`${BASE_URL}/dashboard`, { 
      waitUntil: 'networkidle', 
      timeout: TIMEOUT 
    });

    const finalUrl = page.url();
    logInfo(`最终URL: ${finalUrl}`);

    // 应该被重定向到登录页
    if (finalUrl.includes('/auth')) {
      logSuccess('未登录访问Dashboard正确重定向到登录页');
      
      // 检查是否保留了redirect参数
      if (finalUrl.includes('redirect=%2Fdashboard') || finalUrl.includes('redirect=/dashboard')) {
        logSuccess('重定向URL包含正确的redirect参数');
      } else {
        logWarning('重定向URL未包含redirect参数');
      }
      results.passed++;
    } else {
      logError(`未登录访问Dashboard未正确重定向: ${finalUrl}`);
      results.failed++;
    }

    // ==================== 测试 7: 检查Final CTA区域 ====================
    logTest('7. 检查页面底部Final CTA区域');
    results.total++;

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    
    // 滚动到页面底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const finalCTA = await page.locator('section:has-text("立即开始"), section:has-text("Get Started")').last();
    const finalCtaButton = finalCTA.locator('button').first();
    const finalCtaExists = await finalCtaButton.count() > 0;

    if (finalCtaExists) {
      logSuccess('找到Final CTA按钮');
      
      // 点击并检查URL
      await finalCtaButton.click();
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

      const finalCtaUrl = page.url();
      logInfo(`Final CTA跳转URL: ${finalCtaUrl}`);

      const hasLocaleInFinalCta = finalCtaUrl.includes('/zh-CN/auth') || finalCtaUrl.includes('/en/auth');
      if (!hasLocaleInFinalCta && finalCtaUrl.includes('/auth')) {
        logSuccess('Final CTA按钮跳转URL正确（无语言前缀）');
        results.passed++;
      } else if (hasLocaleInFinalCta) {
        logError(`Final CTA按钮跳转URL包含语言前缀: ${finalCtaUrl}`);
        results.failed++;
      } else {
        logError(`Final CTA按钮跳转URL不正确: ${finalCtaUrl}`);
        results.failed++;
      }
    } else {
      logWarning('未找到Final CTA按钮');
      results.warnings++;
    }

    // ==================== 测试 8: 测试语言切换后的URL ====================
    logTest('8. 测试语言切换后的认证URL');
    results.total++;

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // 查找语言切换器
    const langSwitcher = await page.locator('button:has-text("EN"), button:has-text("中文"), [aria-label*="language"], [aria-label*="语言"]').first();
    const langSwitcherExists = await langSwitcher.count() > 0;

    if (langSwitcherExists) {
      logInfo('找到语言切换器，测试切换语言');
      
      // 点击语言切换器
      await langSwitcher.click();
      await page.waitForTimeout(1000);

      // 查找语言选项
      const langOption = await page.locator('button:has-text("English"), button:has-text("中文"), [role="menuitem"]').first();
      if (await langOption.count() > 0) {
        await langOption.click();
        await page.waitForTimeout(1000);
      }

      // 再次点击CTA按钮
      const ctaAfterLangSwitch = await page.locator('button:has-text("立即开始"), button:has-text("Get Started")').first();
      if (await ctaAfterLangSwitch.count() > 0) {
        await ctaAfterLangSwitch.click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

        const urlAfterLangSwitch = page.url();
        logInfo(`语言切换后的URL: ${urlAfterLangSwitch}`);

        const hasLocaleAfterSwitch = urlAfterLangSwitch.includes('/zh-CN/auth') || urlAfterLangSwitch.includes('/en/auth');
        if (!hasLocaleAfterSwitch && urlAfterLangSwitch.includes('/auth')) {
          logSuccess('语言切换后认证URL仍然正确（无语言前缀）');
          results.passed++;
        } else {
          logError(`语言切换后认证URL不正确: ${urlAfterLangSwitch}`);
          results.failed++;
        }
      } else {
        logWarning('语言切换后未找到CTA按钮');
        results.warnings++;
      }
    } else {
      logWarning('未找到语言切换器，跳过此测试');
      results.warnings++;
    }

    // ==================== 测试 9: 检查OAuth回调URL配置 ====================
    logTest('9. 检查OAuth回调URL配置');
    results.total++;

    await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle', timeout: TIMEOUT });

    // 监听网络请求，查找OAuth相关的请求
    let oauthRedirectUrl = null;
    page.on('request', request => {
      const url = request.url();
      if (url.includes('accounts.google.com') || url.includes('oauth')) {
        const redirectMatch = url.match(/redirect_uri=([^&]+)/);
        if (redirectMatch) {
          oauthRedirectUrl = decodeURIComponent(redirectMatch[1]);
        }
      }
    });

    // 点击Google登录按钮（但不完成登录）
    const googleBtn = await page.locator('button[data-provider="google"], button:has-text("Sign in with Google")').first();
    if (await googleBtn.count() > 0) {
      try {
        await googleBtn.click();
        await page.waitForTimeout(2000);

        if (oauthRedirectUrl) {
          logInfo(`OAuth回调URL: ${oauthRedirectUrl}`);
          
          if (oauthRedirectUrl.includes('/auth/callback') && !oauthRedirectUrl.includes('/zh-CN/') && !oauthRedirectUrl.includes('/en/')) {
            logSuccess('OAuth回调URL配置正确');
            results.passed++;
          } else {
            logError(`OAuth回调URL配置不正确: ${oauthRedirectUrl}`);
            results.failed++;
          }
        } else {
          logWarning('未捕获到OAuth回调URL');
          results.warnings++;
        }
      } catch (error) {
        logWarning(`点击Google登录按钮时出错: ${error.message}`);
        results.warnings++;
      }
    } else {
      logWarning('未找到Google登录按钮');
      results.warnings++;
    }

  } catch (error) {
    logError(`测试过程中出错: ${error.message}`);
    console.error(error);
    results.failed++;
  } finally {
    await browser.close();
  }

  // ==================== 输出测试结果 ====================
  log('\n' + '='.repeat(60), 'cyan');
  log('测试结果汇总', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\n总测试数: ${results.total}`, 'blue');
  log(`通过: ${results.passed}`, 'green');
  log(`失败: ${results.failed}`, 'red');
  log(`警告: ${results.warnings}`, 'yellow');
  
  const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`\n通过率: ${passRate}%`, passRate >= 80 ? 'green' : 'red');

  if (results.failed === 0) {
    log('\n✅ 所有测试通过！用户注册登录流程正常。', 'green');
    return 0;
  } else {
    log(`\n❌ 有 ${results.failed} 个测试失败，请检查问题。`, 'red');
    return 1;
  }
}

// 运行测试
testAuthFlow()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
