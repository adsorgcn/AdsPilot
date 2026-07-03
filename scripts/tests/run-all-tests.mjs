#!/usr/bin/env node

/**
 * E2E测试套件运行器
 *
 * 运行所有E2E测试并生成完整报告
 *
 * 使用方法：
 * PREVIEW_BASE=https://www.urlchecker.dev node scripts/tests/run-all-tests.mjs
 *
 * 环境变量：
 * - PREVIEW_BASE: 测试环境URL（默认: https://www.urlchecker.dev）
 * - HEADLESS: 是否无头模式（默认: true）
 * - PARALLEL: 是否并行运行（默认: false，顺序执行更稳定）
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const HEADLESS = process.env.HEADLESS !== 'false';
const PARALLEL = process.env.PARALLEL === 'true';

// 测试套件定义
const TEST_SUITES = [
  {
    category: '认证与登录',
    tests: [
      { name: '程序化登录', file: 'test-programmatic-login.mjs', critical: true },
    ]
  },
  {
    category: '核心功能',
    tests: [
      { name: 'Dashboard概览', file: 'test-dashboard-overview.mjs', critical: true },
      { name: '订阅管理', file: 'test-subscription-management.mjs', critical: true },
      { name: 'Token管理', file: 'test-token-management.mjs', critical: true },
    ]
  },
  {
    category: '广告中心',
    tests: [
      { name: '广告中心操作', file: 'test-ads-center-operations.mjs', critical: true },
      { name: '任务管理', file: 'test-task-management.mjs', critical: true },
      { name: '批量操作', file: 'test-bulk-operations.mjs', critical: false },
      { name: 'Offer筛选', file: 'test-offer-filtering.mjs', critical: false },
      { name: '创建Offer', file: 'test-create-offer.mjs', critical: false },
      { name: 'AI评估', file: 'test-ai-evaluation.mjs', critical: false },
      { name: '绑定广告账户', file: 'test-bind-ads-account.mjs', critical: false },
    ]
  },
  {
    category: '性能与用户体验',
    tests: [
      { name: 'Web Vitals性能指标', file: 'test-web-vitals.mjs', critical: false },
    ]
  },
];

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  startTime: new Date(),
  endTime: null,
  suites: [],
};

// 运行单个测试
async function runTest(testFile) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, testFile);

    // 检查文件是否存在
    if (!fs.existsSync(testPath)) {
      resolve({
        status: 'skipped',
        reason: 'File not found',
        duration: 0,
      });
      return;
    }

    const startTime = Date.now();
    const env = {
      ...process.env,
      PREVIEW_BASE: BASE_URL,
      HEADLESS: HEADLESS.toString(),
    };

    const child = spawn('node', [testPath], {
      env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const duration = Date.now() - startTime;

      // 解析测试输出获取详细结果
      const passedMatch = stdout.match(/✅ 通过: (\d+)/);
      const failedMatch = stdout.match(/❌ 失败: (\d+)/);

      resolve({
        status: code === 0 ? 'passed' : 'failed',
        exitCode: code,
        duration,
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        stdout: stdout.slice(-1000), // 保留最后1000字符
        stderr: stderr.slice(-500),
      });
    });

    child.on('error', (error) => {
      resolve({
        status: 'failed',
        duration: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

// 运行测试套件
async function runTestSuite(suite) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 ${suite.category}`);
  console.log('='.repeat(60));

  const suiteResult = {
    category: suite.category,
    tests: [],
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const test of suite.tests) {
    results.total++;

    const criticalBadge = test.critical ? '🔴' : '⚪️';
    process.stdout.write(`\n${criticalBadge} ${test.name}... `);

    const result = await runTest(test.file);

    const statusSymbol = result.status === 'passed' ? '✅' :
                         result.status === 'failed' ? '❌' :
                         '⏭️';

    console.log(`${statusSymbol} (${(result.duration / 1000).toFixed(1)}s)`);

    if (result.passed || result.failed) {
      console.log(`   详情: ${result.passed || 0} passed, ${result.failed || 0} failed`);
    }

    if (result.status === 'failed' && result.stderr) {
      console.log(`   错误: ${result.stderr.split('\n')[0]}`);
    }

    const testResult = {
      name: test.name,
      file: test.file,
      critical: test.critical,
      ...result,
    };

    suiteResult.tests.push(testResult);

    if (result.status === 'passed') {
      results.passed++;
      suiteResult.passed++;
    } else if (result.status === 'failed') {
      results.failed++;
      suiteResult.failed++;
    } else {
      results.skipped++;
      suiteResult.skipped++;
    }
  }

  results.suites.push(suiteResult);
  return suiteResult;
}

// 生成测试报告
function generateReport() {
  results.endTime = new Date();
  const duration = (results.endTime - results.startTime) / 1000;

  console.log('\n\n');
  console.log('━'.repeat(70));
  console.log('📊 E2E测试完整报告');
  console.log('━'.repeat(70));
  console.log(`\n🕐 测试时间: ${results.startTime.toLocaleString('zh-CN')}`);
  console.log(`⏱️  总耗时: ${duration.toFixed(1)}秒`);
  console.log(`🌐 测试环境: ${BASE_URL}`);
  console.log(`🖥️  运行模式: ${HEADLESS ? '无头模式' : '浏览器可见'}`);

  console.log('\n📈 总体统计:');
  console.log(`   总计: ${results.total}`);
  console.log(`   ✅ 通过: ${results.passed} (${((results.passed / results.total) * 100).toFixed(1)}%)`);
  console.log(`   ❌ 失败: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);
  console.log(`   ⏭️  跳过: ${results.skipped}`);

  // 按分类展示
  console.log('\n📦 分类详情:');
  for (const suite of results.suites) {
    console.log(`\n   ${suite.category}:`);
    console.log(`      通过: ${suite.passed}/${suite.tests.length}`);

    // 列出失败的测试
    const failedTests = suite.tests.filter(t => t.status === 'failed');
    if (failedTests.length > 0) {
      console.log('      失败:');
      for (const test of failedTests) {
        const criticalBadge = test.critical ? '🔴 [关键]' : '⚪️';
        console.log(`         ${criticalBadge} ${test.name}`);
      }
    }
  }

  // 关键测试状态
  const criticalTests = results.suites
    .flatMap(s => s.tests)
    .filter(t => t.critical);

  const criticalPassed = criticalTests.filter(t => t.status === 'passed').length;
  const criticalFailed = criticalTests.filter(t => t.status === 'failed').length;

  console.log('\n🔴 关键测试状态:');
  console.log(`   通过: ${criticalPassed}/${criticalTests.length}`);
  if (criticalFailed > 0) {
    console.log(`   ⚠️  ${criticalFailed}个关键测试失败！`);
  }

  // 生成JSON报告
  const reportPath = join(__dirname, '../../test-reports');
  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }

  const timestamp = results.startTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonReportFile = join(reportPath, `e2e-report-${timestamp}.json`);

  fs.writeFileSync(jsonReportFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 详细报告已保存: ${jsonReportFile}`);

  // 生成Markdown报告
  const mdReport = generateMarkdownReport();
  const mdReportFile = join(reportPath, `e2e-report-${timestamp}.md`);
  fs.writeFileSync(mdReportFile, mdReport);
  console.log(`📄 Markdown报告: ${mdReportFile}`);

  console.log('\n━'.repeat(70));

  // 如果有关键测试失败，退出码为1
  if (criticalFailed > 0) {
    console.log('\n⚠️  关键测试失败，构建应该被标记为失败');
    process.exit(1);
  } else if (results.failed > 0) {
    console.log('\n⚠️  部分测试失败，但没有关键测试失败');
    process.exit(0); // 非关键测试失败不影响构建
  } else {
    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  }
}

// 生成Markdown报告
function generateMarkdownReport() {
  const duration = (results.endTime - results.startTime) / 1000;
  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  let md = `# E2E测试报告\n\n`;
  md += `**生成时间**: ${results.startTime.toLocaleString('zh-CN')}\n\n`;
  md += `**测试环境**: ${BASE_URL}\n\n`;
  md += `**总耗时**: ${duration.toFixed(1)}秒\n\n`;

  md += `## 📊 总体统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总测试数 | ${results.total} |\n`;
  md += `| ✅ 通过 | ${results.passed} (${passRate}%) |\n`;
  md += `| ❌ 失败 | ${results.failed} |\n`;
  md += `| ⏭️ 跳过 | ${results.skipped} |\n\n`;

  md += `## 📦 分类测试结果\n\n`;

  for (const suite of results.suites) {
    md += `### ${suite.category}\n\n`;
    md += `| 测试名称 | 状态 | 耗时 | 关键 |\n`;
    md += `|----------|------|------|------|\n`;

    for (const test of suite.tests) {
      const status = test.status === 'passed' ? '✅ 通过' :
                     test.status === 'failed' ? '❌ 失败' :
                     '⏭️ 跳过';
      const critical = test.critical ? '🔴' : '⚪️';
      const duration = (test.duration / 1000).toFixed(1);

      md += `| ${test.name} | ${status} | ${duration}s | ${critical} |\n`;
    }
    md += `\n`;
  }

  // 失败详情
  const failedTests = results.suites
    .flatMap(s => s.tests)
    .filter(t => t.status === 'failed');

  if (failedTests.length > 0) {
    md += `## ❌ 失败详情\n\n`;
    for (const test of failedTests) {
      md += `### ${test.name}\n\n`;
      md += `**文件**: \`${test.file}\`\n\n`;
      if (test.stderr) {
        md += `**错误信息**:\n\`\`\`\n${test.stderr}\n\`\`\`\n\n`;
      }
    }
  }

  return md;
}

// 主函数
async function main() {
  console.log('🚀 开始运行E2E测试套件\n');
  console.log(`📍 测试环境: ${BASE_URL}`);
  console.log(`🖥️  运行模式: ${HEADLESS ? '无头模式' : '浏览器可见'}`);
  console.log(`⚡️ 执行模式: ${PARALLEL ? '并行' : '顺序'}`);

  try {
    for (const suite of TEST_SUITES) {
      await runTestSuite(suite);
    }

    generateReport();
  } catch (error) {
    console.error('\n❌ 测试运行失败:', error);
    process.exit(1);
  }
}

main();
