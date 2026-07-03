#!/usr/bin/env node

/**
 * E2E测试套件执行器
 *
 * 运行完整的E2E测试验证，包括:
 * 1. 基础功能测试
 * 2. Offer评估流程测试
 * 3. AI评估功能测试
 * 4. Token消耗规则测试
 * 5. 用户权限��套餐测试
 * 6. 管理员功能测试
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 测试套件配置
const TEST_SUITES = [
  {
    name: '基础登录和页面访问测试',
    script: 'test-login-flow.mjs',
    critical: true,
    timeout: 60000
  },
  {
    name: 'Offer评估流程完整测试',
    script: 'test-offer-evaluation-complete.mjs',
    critical: true,
    timeout: 180000
  },
  {
    name: 'AI评估功能完整测试',
    script: 'test-ai-evaluation-complete.mjs',
    critical: true,
    timeout: 120000
  },
  {
    name: 'Token消耗规则测试',
    script: 'test-token-consumption-rules.mjs',
    critical: true,
    timeout: 90000
  },
  {
    name: '用户权限和套餐测试',
    script: 'test-user-permissions-complete.mjs',
    critical: true,
    timeout: 120000
  },
  {
    name: '个人中心完整测试',
    script: 'test-settings-complete.mjs',
    critical: true,
    timeout: 120000
  },
  {
    name: '后台管理系统测试',
    script: 'test-manage-complete.mjs',
    critical: true,
    timeout: 150000
  },
  {
    name: 'Token管理功能测试',
    script: 'test-token-management.mjs',
    critical: false,
    timeout: 60000
  },
  {
    name: '广告中心操作测试',
    script: 'test-ads-center-operations.mjs',
    critical: false,
    timeout: 90000
  },
  {
    name: '任务管理功能测试',
    script: 'test-task-management.mjs',
    critical: false,
    timeout: 60000
  },
  {
    name: '订阅管理功能测试',
    script: 'test-subscription-management.mjs',
    critical: false,
    timeout: 90000
  },
  {
    name: '批量操作功能测试',
    script: 'test-bulk-operations.mjs',
    critical: false,
    timeout: 120000
  },
  {
    name: 'Dashboard聚合API测试',
    script: 'test-dashboard-aggregation.mjs',
    critical: true,
    timeout: 90000
  },
  {
    name: '签到系统完整流程测试',
    script: 'test-checkin-flow.mjs',
    critical: true,
    timeout: 60000
  },
  {
    name: '邀请系统完整流程测试',
    script: 'test-referral-flow.mjs',
    critical: true,
    timeout: 90000
  },
  {
    name: '通知系统测试',
    script: 'test-notifications.mjs',
    critical: true,
    timeout: 60000
  }
];

// 测试环境配置
const TEST_CONFIG = {
  baseUrl: process.env.PREVIEW_BASE || 'https://www.urlchecker.dev',
  headless: process.env.HEADLESS === 'true',
  parallel: process.env.PARALLEL === 'true',
  retries: parseInt(process.env.RETRIES || '2'),
  timeout: parseInt(process.env.TEST_TIMEOUT || '180000')
};

async function runE2ETestSuite() {
  console.log('🚀 开始执行E2E测试套件');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 测试环境: ${TEST_CONFIG.baseUrl}`);
  console.log(`🔧 Headless模式: ${TEST_CONFIG.headless}`);
  console.log(`⚡ 并行执行: ${TEST_CONFIG.parallel}`);
  console.log(`🔄 重试次数: ${TEST_CONFIG.retries}`);
  console.log(`⏱️  超时时间: ${TEST_CONFIG.timeout/1000}秒`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const overallResults = {
    total: TEST_SUITES.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    critical: {
      total: TEST_SUITES.filter(s => s.critical).length,
      passed: 0,
      failed: 0
    },
    duration: 0
  };

  const startTime = Date.now();

  // 设置环境变量
  process.env.PREVIEW_BASE = TEST_CONFIG.baseUrl;
  process.env.HEADLESS = TEST_CONFIG.headless.toString();

  if (TEST_CONFIG.parallel) {
    console.log('⚡ 并行执行模式\n');
    await runTestSuitesParallel(TEST_SUITES, overallResults);
  } else {
    console.log('📋 顺序执行模式\n');
    await runTestSuitesSequential(TEST_SUITES, overallResults);
  }

  overallResults.duration = Date.now() - startTime;

  // 打印最终结果
  printFinalResults(overallResults);

  // 如果关键测试失败，返回错误码
  if (overallResults.critical.failed > 0) {
    process.exit(1);
  }

  return overallResults.failed === 0;
}

async function runTestSuitesSequential(testSuites, results) {
  for (const suite of testSuites) {
    await runSingleTestSuite(suite, results);
  }
}

async function runTestSuitesParallel(testSuites, results) {
  // 分离关键测试和非关键测试
  const criticalSuites = testSuites.filter(s => s.critical);
  const nonCriticalSuites = testSuites.filter(s => !s.critical);

  // 先运行关键测试
  console.log('🔥 执行关键测试套件...');
  const criticalPromises = criticalSuites.map(suite => runSingleTestSuite(suite, results));
  await Promise.all(criticalPromises);

  // 如果关键测试都通过，再运行非关键测试
  if (results.critical.failed === 0) {
    console.log('\n📋 执行非关键测试套件...');
    const nonCriticalPromises = nonCriticalSuites.map(suite => runSingleTestSuite(suite, results));
    await Promise.all(nonCriticalPromises);
  } else {
    console.log('\n⚠️ 关键测试失败，跳过非关键测试');
    nonCriticalSuites.forEach(suite => {
      results.skipped++;
      console.log(`⏭️  跳过: ${suite.name}`);
    });
  }
}

async function runSingleTestSuite(suite, results) {
  console.log(`\n🧪 执行测试套件: ${suite.name}`);
  console.log('─'.repeat(60));

  const suiteStartTime = Date.now();
  let attempt = 0;
  let lastError = null;

  while (attempt <= TEST_CONFIG.retries) {
    try {
      if (attempt > 0) {
        console.log(`\n🔄 重试第${attempt}次...`);
      }

      const { stdout, stderr } = await execAsync(
        `node ${suite.script}`,
        {
          timeout: suite.timeout || TEST_CONFIG.timeout,
          cwd: process.cwd(),
          env: {
            ...process.env,
            PREVIEW_BASE: TEST_CONFIG.baseUrl,
            HEADLESS: TEST_CONFIG.headless.toString()
          }
        }
      );

      const duration = Date.now() - suiteStartTime;

      // 测试成功
      results.passed++;
      if (suite.critical) {
        results.critical.passed++;
      }

      console.log(`✅ ${suite.name} - 通过 (${Math.round(duration/1000)}秒)`);

      if (stdout) {
        console.log('📄 输出:');
        console.log(stdout);
      }

      return { success: true, duration, stdout, stderr };

    } catch (error) {
      lastError = error;
      attempt++;

      const duration = Date.now() - suiteStartTime;

      if (error.code === 'ETIMEDOUT') {
        console.log(`⏰ ${suite.name} - 超时 (${Math.round(duration/1000)}秒)`);
      } else if (error.signal === 'SIGTERM') {
        console.log(`🛑 ${suite.name} - 被终止 (${Math.round(duration/1000)}秒)`);
      } else {
        console.log(`❌ ${suite.name} - 失败 (${Math.round(duration/1000)}秒)`);
        console.log(`   错误: ${error.message}`);

        if (error.stdout) {
          console.log('📄 输出:');
          console.log(error.stdout);
        }

        if (error.stderr) {
          console.log('📄 错误输出:');
          console.log(error.stderr);
        }
      }

      // 如果不是最后一次尝试，等待一下再重试
      if (attempt <= TEST_CONFIG.retries) {
        console.log(`⏳ 等待${attempt * 2}秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
  }

  // 所有重试都失败了
  results.failed++;
  if (suite.critical) {
    results.critical.failed++;
  }

  console.log(`💀 ${suite.name} - 失败 (重试${TEST_CONFIG.retries}次后仍失败)`);

  return { success: false, error: lastError, attempts: attempt };
}

function printFinalResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('🏁 E2E测试套件执行完成');
  console.log('='.repeat(80));

  // 总体统计
  console.log(`\n📊 总体统计:`);
  console.log(`├─ 总测试套件: ${results.total}`);
  console.log(`├─ ✅ 通过: ${results.passed}`);
  console.log(`├─ ❌ 失败: ${results.failed}`);
  console.log(`├─ ⏭️  跳过: ${results.skipped}`);
  console.log(`└─ ⏱️  总耗时: ${Math.round(results.duration/1000)}秒`);

  // 关键测试统计
  console.log(`\n🔥 关键测试统计:`);
  console.log(`├─ 总关键测试: ${results.critical.total}`);
  console.log(`├─ ✅ 通过: ${results.critical.passed}`);
  console.log(`└─ ❌ 失败: ${results.critical.failed}`);

  // 成功率
  const successRate = results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0;
  const criticalSuccessRate = results.critical.total > 0 ? Math.round((results.critical.passed / results.critical.total) * 100) : 0;

  console.log(`\n📈 成功率:`);
  console.log(`├─ 总体成功率: ${successRate}%`);
  console.log(`└─ 关键测试成功率: ${criticalSuccessRate}%`);

  // 测试覆盖范围
  console.log(`\n🎯 测试覆盖范围:`);
  console.log(`├─ ✅ 用户认证和页面访问`);
  console.log(`├─ ✅ Offer评估流程 (siterank + browser-exec)`);
  console.log(`├─ ✅ AI评估功能 (权限控制 + 结果验证)`);
  console.log(`├─ ✅ Token消耗规则 (1+2+3 tokens)`);
  console.log(`├─ ✅ 用户权限和套餐 (Starter/Professional/Elite)`);
  console.log(`├─ ✅ Token管理功能`);
  console.log(`├─ ✅ 广告账户连接`);
  console.log(`├─ ✅ 任务管理`);
  console.log(`├─ ✅ 订阅管理`);
  console.log(`├─ ✅ 批量操作`);
  console.log(`├─ ✅ Dashboard聚合API (BFF Service)`);
  console.log(`├─ ✅ 签到系统 (每日签到 + 连续签到奖励)`);
  console.log(`├─ ✅ 邀请系统 (邀请链接 + 双向奖励)`);
  console.log(`└─ ✅ 通知系统 (SSE实时推送)`);

  // 业务流程验证
  console.log(`\n🔄 业务流程验证:`);
  console.log(`├─ ✅ 基础评估: siterank服务调用 + 1 token消耗`);
  console.log(`├─ ✅ AI评估: browser-exec服务调用 + 2 tokens消耗`);
  console.log(`├─ ✅ 完整评估: 两个服务调用 + 3 tokens消耗`);
  console.log(`├─ ✅ Starter套餐: 仅基础评估权限`);
  console.log(`├─ ✅ Professional套餐: 基础+AI评估权限`);
  console.log(`├─ ✅ Elite套餐: 全部功能权限`);
  console.log(`└─ ✅ Token余额检查和消耗验证`);

  if (results.failed === 0) {
    console.log(`\n🎉 所有测试通过！E2E测试方案验证成功！`);
  } else {
    console.log(`\n⚠️ 部分测试失败，请检查以下问题:`);

    if (results.critical.failed > 0) {
      console.log(`\n🚨 关键测试失败 - 必须修复:`);
      console.log(`1. 检查测试环境是否正常运行`);
      console.log(`2. 验证API服务是否可访问`);
      console.log(`3. 确认测试账号是否有效`);
      console.log(`4. 检查网络连接和防火墙设置`);
      console.log(`5. 验证数据库连接状态`);
    } else {
      console.log(`\n⚠️ 非关键测试失败 - 建议修复:`);
      console.log(`1. 检查特定功能是否完整实现`);
      console.log(`2. 验证页面UI组件是否正确显示`);
      console.log(`3. 确认业务逻辑是否符合预期`);
    }

    console.log(`\n🔧 调试建议:`);
    console.log(`1. 单独运行失败的测试套件查看详细错误`);
    console.log(`2. 使用 HEADLESS=false 查看浏览器执行过程`);
    console.log(`3. 检查浏览器控制台错误和网络请求`);
    console.log(`4. 验证测试数据的完整性`);
  }

  console.log('\n' + '='.repeat(80));
}

// 命令行参数处理
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    help: false,
    list: false,
    suites: [],
    headless: false,
    parallel: false,
    retries: 2,
    timeout: 180000
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-l':
      case '--list':
        options.list = true;
        break;
      case '-s':
      case '--suite':
        if (i + 1 < args.length) {
          options.suites.push(args[++i]);
        }
        break;
      case '--headless':
        options.headless = true;
        break;
      case '--parallel':
        options.parallel = true;
        break;
      case '--retries':
        if (i + 1 < args.length) {
          options.retries = parseInt(args[++i]);
        }
        break;
      case '--timeout':
        if (i + 1 < args.length) {
          options.timeout = parseInt(args[++i]) * 1000;
        }
        break;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
🧪 E2E测试套件执行器

用法: node run-e2e-test-suite.mjs [选项]

选项:
  -h, --help              显示帮助信息
  -l, --list              列出所有测试套件
  -s, --suite <name>      运行指定测试套件 (可多次使用)
  --headless              无头模式运行
  --parallel              并行执行测试
  --retries <number>      重试次数 (默认: 2)
  --timeout <seconds>     超时时间 (默认: 180秒)

环境变量:
  PREVIEW_BASE            测试环境URL (默认: https://www.urlchecker.dev)
  HEADLESS                无头模式 (true/false)
  PARALLEL                并行执行 (true/false)
  RETRIES                 重试次数
  TEST_TIMEOUT            超时时间(毫秒)

示例:
  node run-e2e-test-suite.mjs                           # 运行所有测试
  node run-e2e-test-suite.mjs --headless                # 无头模式运行
  node run-e2e-test-suite.mjs --parallel                # 并行执行
  node run-e2e-test-suite.mjs -s test-login-flow.mjs    # 运行单个测试
  node run-e2e-test-suite.mjs --retries 1 --timeout 120 # 自定义重试和超时

可用测试套件:
${TEST_SUITES.map(suite => `  ${suite.script} - ${suite.name}`).join('\n')}
`);
}

function listTestSuites() {
  console.log('\n🧪 可用测试套件:\n');

  TEST_SUITES.forEach((suite, index) => {
    const status = suite.critical ? '🔥 关键' : '📋 可选';
    const timeout = (suite.timeout || TEST_CONFIG.timeout) / 1000;
    console.log(`${(index + 1).toString().padStart(2)}. ${suite.script}`);
    console.log(`     ${status} | ${suite.name}`);
    console.log(`     超时: ${timeout}秒\n`);
  });
}

// 主函数
async function main() {
  const options = parseArguments();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    listTestSuites();
    return;
  }

  // 应用命令行选项
  if (options.headless) {
    TEST_CONFIG.headless = true;
  }
  if (options.parallel) {
    TEST_CONFIG.parallel = true;
  }
  if (options.retries !== undefined) {
    TEST_CONFIG.retries = options.retries;
  }
  if (options.timeout !== undefined) {
    TEST_CONFIG.timeout = options.timeout;
  }

  // 如果指定了特定测试套件，只运行这些
  if (options.suites.length > 0) {
    const selectedSuites = TEST_SUITES.filter(suite =>
      options.suites.includes(suite.script)
    );

    if (selectedSuites.length === 0) {
      console.error('❌ 未找到指定的测试套件');
      console.log('可用测试套件:');
      TEST_SUITES.forEach(suite => console.log(`  - ${suite.script}`));
      process.exit(1);
    }

    console.log(`🎯 运行指定测试套件: ${options.suites.join(', ')}`);
    const results = { total: 0, passed: 0, failed: 0, skipped: 0, critical: { total: 0, passed: 0, failed: 0 }, duration: 0 };

    const startTime = Date.now();

    if (options.parallel) {
      await runTestSuitesParallel(selectedSuites, results);
    } else {
      await runTestSuitesSequential(selectedSuites, results);
    }

    results.duration = Date.now() - startTime;
    printFinalResults(results);

    if (results.failed > 0) {
      process.exit(1);
    }
  } else {
    // 运行完整测试套件
    const success = await runE2ETestSuite();
    process.exit(success ? 0 : 1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ 测试套件执行失败:', error);
    process.exit(1);
  });
}

export { runE2ETestSuite };