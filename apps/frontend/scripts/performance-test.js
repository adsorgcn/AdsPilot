#!/usr/bin/env node

/**
 * 性能测试脚本
 * 用于测量和验证前端性能优化效果
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.join(__dirname, '../performance-reports');

async function runPerformanceTest() {
  console.log('🚀 开始性能测试...');
  console.log(`📍 测试URL: ${SITE_URL}`);

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    // 模拟慢速网络进行测试
    offline: false,
  });

  const page = await context.newPage();

  // 监听网络请求
  const resources = [];
  page.on('response', (response) => {
    resources.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      size: response.headers()['content-length'] || 0,
    });
  });

  try {
    // 监控Core Web Vitals
    const vitals = await measureCoreWebVitals(page);

    // 测量首屏加载时间
    const loadMetrics = await measurePageLoad(page);

    // 分析资源加载
    const resourceAnalysis = analyzeResources(resources);

    // 生成报告
    const report = {
      timestamp: new Date().toISOString(),
      url: SITE_URL,
      vitals,
      loadMetrics,
      resourceAnalysis,
      recommendations: generateRecommendations(vitals, loadMetrics),
    };

    // 保存报告
    const reportPath = path.join(OUTPUT_DIR, `performance-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // 输出结果
    printResults(report);

    console.log(`\n📊 详细报告已保存到: ${reportPath}`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await browser.close();
  }
}

async function measureCoreWebVitals(page) {
  console.log('\n📈 测量Core Web Vitals...');

  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const vitals = {};

      // LCP (Largest Contentful Paint)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        vitals.LCP = Math.round(lastEntry.startTime);
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID (First Input Delay)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          vitals.FID = Math.round(entry.processingStart - entry.startTime);
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS (Cumulative Layout Shift)
      let clsValue = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        vitals.CLS = Math.round(clsValue * 1000) / 1000;
      }).observe({ entryTypes: ['layout-shift'] });

      // FCP (First Contentful Paint)
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        vitals.FCP = Math.round(fcpEntry.startTime);
      }

      // TTFB (Time to First Byte)
      const navigationEntry = performance.getEntriesByType('navigation')[0];
      if (navigationEntry) {
        vitals.TTFB = Math.round(navigationEntry.responseStart);
      }

      // 等待一段时间收集所有指标
      setTimeout(() => resolve(vitals), 3000);
    });
  });
}

async function measurePageLoad(page) {
  console.log('⏱️  测量页面加载时间...');

  const startTime = Date.now();

  // 等待页面完全加载
  await page.goto(SITE_URL, { waitUntil: 'networkidle' });

  const endTime = Date.now();
  const loadTime = endTime - startTime;

  // 获取Navigation Timing API数据
  const navigationTiming = await page.evaluate(() => {
    const timing = performance.timing;
    return {
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnect: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseEnd - timing.requestStart,
      domLoad: timing.domContentLoadedEventEnd - timing.navigationStart,
      windowLoad: timing.loadEventEnd - timing.navigationStart,
      totalLoadTime: timing.loadEventEnd - timing.navigationStart,
    };
  });

  return {
    totalTime: loadTime,
    ...navigationTiming,
  };
}

function analyzeResources(resources) {
  console.log('🔍 分析资源加载...');

  const analysis = {
    totalRequests: resources.length,
    totalSize: resources.reduce((sum, r) => sum + parseInt(r.size || 0), 0),
    imageRequests: resources.filter(r => r.url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i)).length,
    jsRequests: resources.filter(r => r.url.match(/\.js(\?.*)?$/i)).length,
    cssRequests: resources.filter(r => r.url.match(/\.css(\?.*)?$/i)).length,
    failedRequests: resources.filter(r => r.status >= 400).length,
  };

  return analysis;
}

function generateRecommendations(vitals, loadMetrics) {
  const recommendations = [];

  // LCP 推荐
  if (vitals.LCP > 2500) {
    recommendations.push({
      metric: 'LCP',
      issue: 'Largest Contentful Paint 过慢',
      suggestion: '优化图片加载、使用CDN、减少服务器响应时间',
      priority: 'high',
    });
  }

  // FID 推荐
  if (vitals.FID > 100) {
    recommendations.push({
      metric: 'FID',
      issue: 'First Input Delay 过长',
      suggestion: '减少JavaScript执行时间、分割代码、使用Web Workers',
      priority: 'high',
    });
  }

  // CLS 推荐
  if (vitals.CLS > 0.1) {
    recommendations.push({
      metric: 'CLS',
      issue: 'Cumulative Layout Shift 过高',
      suggestion: '为图片和广告设置尺寸、避免动态插入内容',
      priority: 'medium',
    });
  }

  // 总加载时间推荐
  if (loadMetrics.totalTime > 3000) {
    recommendations.push({
      metric: 'Load Time',
      issue: '页面加载时间过长',
      suggestion: '启用gzip压缩、优化资源大小、使用HTTP/2',
      priority: 'high',
    });
  }

  return recommendations;
}

function printResults(report) {
  console.log('\n🎯 性能测试结果');
  console.log('='.repeat(50));

  // Core Web Vitals
  console.log('\n📊 Core Web Vitals:');
  console.log(`  LCP (Largest Contentful Paint): ${report.vitals.LCP}ms ${getRating(report.vitals.LCP, 2500, 4000)}`);
  console.log(`  FID (First Input Delay): ${report.vitals.FID}ms ${getRating(report.vitals.FID, 100, 300)}`);
  console.log(`  CLS (Cumulative Layout Shift): ${report.vitals.CLS} ${getRating(report.vitals.CLS, 0.1, 0.25)}`);
  console.log(`  FCP (First Contentful Paint): ${report.vitals.FCP}ms ${getRating(report.vitals.FCP, 1800, 3000)}`);
  console.log(`  TTFB (Time to First Byte): ${report.vitals.TTFB}ms ${getRating(report.vitals.TTFB, 800, 1800)}`);

  // 加载时间
  console.log('\n⏱️  加载时间:');
  console.log(`  总加载时间: ${report.loadMetrics.totalTime}ms`);
  console.log(`  DNS查询: ${report.loadMetrics.dnsLookup}ms`);
  console.log(`  TCP连接: ${report.loadMetrics.tcpConnect}ms`);
  console.log(`  服务器响应: ${report.loadMetrics.serverResponse}ms`);
  console.log(`  DOM加载: ${report.loadMetrics.domLoad}ms`);

  // 资源分析
  console.log('\n📦 资源分析:');
  console.log(`  总请求数: ${report.resourceAnalysis.totalRequests}`);
  console.log(`  总大小: ${(report.resourceAnalysis.totalSize / 1024).toFixed(2)}KB`);
  console.log(`  图片请求数: ${report.resourceAnalysis.imageRequests}`);
  console.log(`  JavaScript请求数: ${report.resourceAnalysis.jsRequests}`);
  console.log(`  CSS请求数: ${report.resourceAnalysis.cssRequests}`);
  console.log(`  失败请求数: ${report.resourceAnalysis.failedRequests}`);

  // 建议
  if (report.recommendations.length > 0) {
    console.log('\n💡 优化建议:');
    report.recommendations.forEach((rec, index) => {
      const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
      console.log(`  ${index + 1}. ${priority} [${rec.metric}] ${rec.issue}`);
      console.log(`     建议: ${rec.suggestion}`);
    });
  } else {
    console.log('\n✅ 性能表现良好，无需优化建议！');
  }
}

function getRating(value, good, poor) {
  if (value <= good) return '(✅ 良好)';
  if (value <= poor) return '(⚠️  需改进)';
  return '(❌ 较差)';
}

// 运行测试
if (require.main === module) {
  runPerformanceTest().catch(console.error);
}

module.exports = { runPerformanceTest };