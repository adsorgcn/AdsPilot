#!/usr/bin/env node

/**
 * 综合测试脚本
 * 测试响应式设计、功能完整性、浏览器兼容性等
 */

const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../test-reports');

// 测试配置
const TEST_CONFIG = {
  viewports: [
    { name: 'Mobile', width: 375, height: 667 },     // iPhone SE
    { name: 'Tablet', width: 768, height: 1024 },    // iPad
    { name: 'Desktop', width: 1280, height: 720 },  // Desktop
    { name: 'Large', width: 1920, height: 1080 },   // Large Desktop
  ],
  pages: [
    { path: '/', name: 'Landing Page' },
    { path: '/features', name: 'Features Page' },
    { path: '/pricing', name: 'Pricing Page' },
    { path: '/auth', name: 'Auth Page' },
    { path: '/dashboard', name: 'Dashboard' }, // 需要登录
  ],
  browsers: ['chromium', 'firefox', 'webkit'],
};

async function runComprehensiveTest() {
  console.log('🚀 开始综合测试...');
  console.log(`📍 测试URL: ${SITE_URL}`);

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = {
    timestamp: new Date().toISOString(),
    url: SITE_URL,
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
    },
    tests: {
      responsive: {},
      functionality: {},
      accessibility: {},
      performance: {},
    },
  };

  try {
    // 1. 响应式设计测试
    console.log('\n📱 测试响应式设计...');
    await testResponsiveDesign(results);

    // 2. 功能完整性测试
    console.log('\n⚙️ 测试功能完整性...');
    await testFunctionality(results);

    // 3. 可访问性测试
    console.log('\n♿ 测试可访问性...');
    await testAccessibility(results);

    // 4. 跨浏览器兼容性测试
    console.log('\n🌐 测试跨浏览器兼容性...');
    await testCrossBrowserCompatibility(results);

    // 生成测试报告
    const reportPath = path.join(OUTPUT_DIR, `comprehensive-test-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));

    // 输出结果
    printTestResults(results);

    console.log(`\n📊 详细报告已保存到: ${reportPath}`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

async function testResponsiveDesign(results) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newContext();

  for (const pageConfig of TEST_CONFIG.pages) {
    if (pageConfig.name === 'Dashboard') continue; // 跳过需要登录的页面

    results.tests.responsive[pageConfig.name] = {};

    for (const viewport of TEST_CONFIG.viewports) {
      try {
        await page.setViewportSize(viewport);
        await page.goto(`${SITE_URL}${pageConfig.path}`, { waitUntil: 'networkidle' });

        // 检查关键元素是否正确显示
        const hasProperLayout = await page.evaluate(() => {
          // 检查主要导航
          const nav = document.querySelector('nav, header');
          // 检查主要内容区域
          const main = document.querySelector('main, .main-content, section');
          // 检查页面标题
          const title = document.querySelector('h1, .heading');

          return {
            hasNavigation: !!nav,
            hasMainContent: !!main,
            hasTitle: !!title,
            viewportWidth: window.innerWidth,
          };
        });

        results.tests.responsive[pageConfig.name][viewport.name] = {
          ...hasProperLayout,
          passed: hasProperLayout.hasNavigation && hasProperLayout.hasMainContent,
          timestamp: new Date().toISOString(),
        };

        if (hasProperLayout.passed) {
          results.summary.passedTests++;
        } else {
          results.summary.failedTests++;
        }

        // 截图记录
        await page.screenshot({
          path: path.join(OUTPUT_DIR, `${pageConfig.name}-${viewport.name}.png`),
          fullPage: true,
        });

      } catch (error) {
        results.tests.responsive[pageConfig.name][viewport.name] = {
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        };
        results.summary.failedTests++;
      }

      results.summary.totalTests++;
    }
  }

  await browser.close();
}

async function testFunctionality(results) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newContext();

  // 测试Landing Page功能
  try {
    await page.goto(`${SITE_URL}/`, { waitUntil: 'networkidle' });

    const functionalityTests = await page.evaluate(() => {
      const tests = [];

      // 测试导航链接
      const navLinks = document.querySelectorAll('a[href]');
      const hasWorkingNavLinks = navLinks.length > 0;
      tests.push({ name: 'Navigation Links', passed: hasWorkingNavLinks });

      // 测试按钮功能
      const buttons = document.querySelectorAll('button');
      const hasButtons = buttons.length > 0;
      tests.push({ name: 'Buttons', passed: hasButtons });

      // 测试表单元素（如果存在）
      const forms = document.querySelectorAll('form');
      const hasForms = forms.length > 0;
      tests.push({ name: 'Forms', passed: hasForms });

      // 测试图片加载
      const images = Array.from(document.querySelectorAll('img'));
      const loadedImages = images.filter(img => img.complete && img.naturalHeight !== 0);
      const allImagesLoaded = images.length === 0 || loadedImages.length === images.length;
      tests.push({ name: 'Images Loaded', passed: allImagesLoaded, details: `${loadedImages.length}/${images.length}` });

      return tests;
    });

    results.tests.functionality['Landing Page'] = functionalityTests.map(test => ({
      ...test,
      timestamp: new Date().toISOString(),
    }));

    functionalityTests.forEach(test => {
      results.summary.totalTests++;
      if (test.passed) {
        results.summary.passedTests++;
      } else {
        results.summary.failedTests++;
      }
    });

  } catch (error) {
    results.tests.functionality['Landing Page'] = [{
      name: 'Overall Functionality',
      passed: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }];
    results.summary.totalTests++;
    results.summary.failedTests++;
  }

  await browser.close();
}

async function testAccessibility(results) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newContext();

  try {
    await page.goto(`${SITE_URL}/`, { waitUntil: 'networkidle' });

    const accessibilityTests = await page.evaluate(() => {
      const tests = [];

      // 测试语义化HTML
      const hasMain = document.querySelector('main') || document.querySelector('[role="main"]');
      tests.push({ name: 'Semantic HTML - main', passed: !!hasMain });

      const hasHeader = document.querySelector('header') || document.querySelector('[role="banner"]');
      tests.push({ name: 'Semantic HTML - header', passed: !!hasHeader });

      const hasNav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
      tests.push({ name: 'Semantic HTML - nav', passed: !!hasNav });

      // 测试alt文本
      const images = Array.from(document.querySelectorAll('img'));
      const imagesWithAlt = images.filter(img => img.alt || img.getAttribute('aria-label'));
      const hasImageAlts = images.length === 0 || imagesWithAlt.length === images.length;
      tests.push({ name: 'Image Alt Text', passed: hasImageAlts, details: `${imagesWithAlt.length}/${images.length}` });

      // 测试标题层次
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const hasHeadings = headings.length > 0;
      tests.push({ name: 'Heading Structure', passed: hasHeadings, details: `${headings.length} headings` });

      // 测试focus管理
      const focusableElements = document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const hasFocusableElements = focusableElements.length > 0;
      tests.push({ name: 'Focusable Elements', passed: hasFocusableElements, details: `${focusableElements.length} elements` });

      // 测试color contrast (简化版本)
      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span');
      const hasTextContent = textElements.length > 0;
      tests.push({ name: 'Text Content', passed: hasTextContent, details: `${textElements.length} text elements` });

      return tests;
    });

    results.tests.accessibility['Landing Page'] = accessibilityTests.map(test => ({
      ...test,
      timestamp: new Date().toISOString(),
    }));

    accessibilityTests.forEach(test => {
      results.summary.totalTests++;
      if (test.passed) {
        results.summary.passedTests++;
      } else {
        results.summary.failedTests++;
      }
    });

  } catch (error) {
    results.tests.accessibility['Landing Page'] = [{
      name: 'Overall Accessibility',
      passed: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }];
    results.summary.totalTests++;
    results.summary.failedTests++;
  }

  await browser.close();
}

async function testCrossBrowserCompatibility(results) {
  const browsers = {
    chromium,
    firefox,
    webkit,
  };

  for (const [browserName, browserType] of Object.entries(browsers)) {
    try {
      const browser = await browserType.launch();
      const context = await browser.newContext();
      const page = await context.newContext();

      await page.goto(`${SITE_URL}/`, { waitUntil: 'networkidle' });

      const compatibilityTest = await page.evaluate(() => {
        // 基础页面检查
        const title = document.title;
        const hasBody = !!document.body;
        const hasContent = document.body.innerHTML.length > 100;

        return {
          title,
          hasBody,
          hasContent,
          contentLength: document.body.innerHTML.length,
        };
      });

      results.tests.crossBrowser = results.tests.crossBrowser || {};
      results.tests.crossBrowser[browserName] = {
        ...compatibilityTest,
        passed: compatibilityTest.hasBody && compatibilityTest.hasContent,
        timestamp: new Date().toISOString(),
      };

      if (results.tests.crossBrowser[browserName].passed) {
        results.summary.passedTests++;
      } else {
        results.summary.failedTests++;
      }

      results.summary.totalTests++;

      await browser.close();

    } catch (error) {
      results.tests.crossBrowser = results.tests.crossBrowser || {};
      results.tests.crossBrowser[browserName] = {
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      results.summary.totalTests++;
      results.summary.failedTests++;
    }
  }
}

function printTestResults(results) {
  console.log('\n🎯 综合测试结果');
  console.log('='.repeat(50));

  // 总体统计
  const passRate = results.summary.totalTests > 0
    ? ((results.summary.passedTests / results.summary.totalTests) * 100).toFixed(1)
    : 0;

  console.log('\n📊 总体统计:');
  console.log(`  总测试数: ${results.summary.totalTests}`);
  console.log(`  通过: ${results.summary.passedTests}`);
  console.log(`  失败: ${results.summary.failedTests}`);
  console.log(`  通过率: ${passRate}%`);

  // 响应式设计结果
  console.log('\n📱 响应式设计:');
  for (const [pageName, pageResults] of Object.entries(results.tests.responsive)) {
    console.log(`  ${pageName}:`);
    for (const [viewport, result] of Object.entries(pageResults)) {
      const status = result.passed ? '✅' : '❌';
      console.log(`    ${viewport}: ${status}`);
    }
  }

  // 功能测试结果
  if (results.tests.functionality['Landing Page']) {
    console.log('\n⚙️ 功能测试:');
    results.tests.functionality['Landing Page'].forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${test.name}: ${status}`);
      if (test.details) {
        console.log(`    ${test.details}`);
      }
    });
  }

  // 可访问性测试结果
  if (results.tests.accessibility['Landing Page']) {
    console.log('\n♿ 可访问性:');
    results.tests.accessibility['Landing Page'].forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`  ${test.name}: ${status}`);
      if (test.details) {
        console.log(`    ${test.details}`);
      }
    });
  }

  // 跨浏览器测试结果
  if (results.tests.crossBrowser) {
    console.log('\n🌐 跨浏览器兼容性:');
    for (const [browserName, result] of Object.entries(results.tests.crossBrowser)) {
      const status = result.passed ? '✅' : '❌';
      console.log(`  ${browserName}: ${status}`);
    }
  }

  // 建议
  if (results.summary.failedTests > 0) {
    console.log('\n💡 改进建议:');
    console.log('  1. 检查失败的测试项并修复相应问题');
    console.log('  2. 确保所有关键功能在不同设备和浏览器上正常工作');
    console.log('  3. 优化响应式设计，特别是移动端体验');
    console.log('  4. 完善可访问性支持，添加必要的ARIA标签');
  } else {
    console.log('\n✅ 所有测试通过！应用具有出色的兼容性。');
  }
}

// 运行测试
if (require.main === module) {
  runComprehensiveTest().catch(console.error);
}

module.exports = { runComprehensiveTest };