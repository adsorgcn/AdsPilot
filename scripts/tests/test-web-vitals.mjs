#!/usr/bin/env node

import { chromium } from 'playwright';

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

// Web Vitals阈值 (Google标准)
const THRESHOLDS = {
  LCP: 2500,  // Largest Contentful Paint: < 2.5s (good)
  FID: 100,   // First Input Delay: < 100ms (good)
  CLS: 0.1,   // Cumulative Layout Shift: < 0.1 (good)
  FCP: 1800,  // First Contentful Paint: < 1.8s (good)
  TTFB: 800,  // Time to First Byte: < 800ms (good)
};

async function testWebVitals() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🚀 开始Web Vitals性能测试');
  console.log(`📍 测试环境: ${BASE_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    passed: 0,
    failed: 0,
    metrics: {}
  };

  try {
    // 注入 web-vitals 测量脚本
    await page.addInitScript(() => {
      window.webVitalsData = {};

      // 捕获 LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        window.webVitalsData.LCP = Math.round(lastEntry.renderTime || lastEntry.loadTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });

      // 捕获 FCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            window.webVitalsData.FCP = Math.round(entry.startTime);
          }
        });
      }).observe({ type: 'paint', buffered: true });

      // 捕获 CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        window.webVitalsData.CLS = clsValue;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    // 访问首页
    await page.goto(`${BASE_URL}/en`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // 获取 TTFB
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      return {
        TTFB: Math.round(nav.responseStart - nav.requestStart),
        domInteractive: Math.round(nav.domInteractive - nav.fetchStart),
        domComplete: Math.round(nav.domComplete - nav.fetchStart),
        loadComplete: Math.round(nav.loadEventEnd - nav.fetchStart)
      };
    });

    results.metrics.TTFB = timing.TTFB;

    // 等待 LCP 稳定 (通常在页面加载后2-3秒)
    await page.waitForTimeout(3000);

    // 获取 Web Vitals 数据
    const vitals = await page.evaluate(() => window.webVitalsData);

    results.metrics = {
      ...results.metrics,
      ...vitals,
      ...timing
    };

    // 测试 LCP
    testMetric(results, 'LCP', vitals.LCP, THRESHOLDS.LCP, 'ms');

    // 测试 FCP
    testMetric(results, 'FCP', vitals.FCP, THRESHOLDS.FCP, 'ms');

    // 测试 CLS
    testMetric(results, 'CLS', vitals.CLS, THRESHOLDS.CLS, '');

    // 测试 TTFB
    testMetric(results, 'TTFB', timing.TTFB, THRESHOLDS.TTFB, 'ms');

    // 额外的性能指标
    console.log('\n📊 额外性能指标:');
    console.log(`   DOM Interactive: ${timing.domInteractive}ms`);
    console.log(`   DOM Complete: ${timing.domComplete}ms`);
    console.log(`   Load Complete: ${timing.loadComplete}ms`);

  } catch (error) {
    console.error(`\n❌ 测试执行失败: ${error.message}`);
    results.failed++;
  } finally {
    await browser.close();
  }

  // 输出汇总
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 性能测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);

  const total = results.passed + results.failed;
  const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
  console.log(`📈 通过率: ${passRate}%`);

  // 性能等级评估
  const grade = getPerformanceGrade(results.metrics);
  console.log(`\n🏆 综合性能评级: ${grade.emoji} ${grade.label}`);
  console.log(`   ${grade.description}`);

  if (results.failed > 0) {
    process.exit(1);
  }
}

function testMetric(results, name, value, threshold, unit) {
  const status = value <= threshold ? '✅' : '❌';
  const percentage = Math.round((value / threshold) * 100);

  console.log(`\n${status} ${name}: ${value}${unit}`);
  console.log(`   阈值: ${threshold}${unit}`);
  console.log(`   性能: ${percentage}% ${percentage <= 100 ? '(优秀)' : '(需优化)'}`);

  if (value <= threshold) {
    results.passed++;
  } else {
    results.failed++;
    console.log(`   ⚠️  建议优化以达到Google推荐标准`);
  }
}

function getPerformanceGrade(metrics) {
  const { LCP, FCP, CLS, TTFB } = metrics;

  // 计算综合得分 (0-100)
  let score = 100;

  if (LCP > 2500) score -= 25;
  else if (LCP > 1800) score -= 10;

  if (FCP > 1800) score -= 15;
  else if (FCP > 1000) score -= 5;

  if (CLS > 0.1) score -= 20;
  else if (CLS > 0.05) score -= 10;

  if (TTFB > 800) score -= 20;
  else if (TTFB > 500) score -= 10;

  if (score >= 90) return { emoji: '🏆', label: 'A (优秀)', description: '性能卓越，符合所有Google标准' };
  if (score >= 75) return { emoji: '✅', label: 'B (良好)', description: '性能良好，部分指标可优化' };
  if (score >= 60) return { emoji: '⚠️', label: 'C (一般)', description: '性能一般，建议优化' };
  return { emoji: '❌', label: 'D (较差)', description: '性能较差，需要立即优化' };
}

testWebVitals().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
