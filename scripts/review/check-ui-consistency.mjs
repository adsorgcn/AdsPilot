#!/usr/bin/env node

/**
 * UI一致性检查脚本
 *
 * 自动扫描前端页面，检测UI不一致问题:
 * - 非标准的文字大小
 * - 不一致的间距
 * - 未使用设计系统的组件
 * - 内联样式
 *
 * 使用方法:
 * node scripts/review/check-ui-consistency.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import globPkg from 'glob';
const { glob } = globPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

// 配置
const CONFIG = {
  // 允许的Tailwind文字大小类
  allowedTextSizes: [
    'text-xs', 'text-sm', 'text-base', 'text-lg',
    'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
    'text-5xl', 'text-6xl', 'text-7xl', 'text-8xl', 'text-9xl'
  ],

  // 允许的间距类
  allowedSpacing: [
    'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-6',
    'gap-8', 'gap-10', 'gap-12', 'gap-16', 'gap-20', 'gap-24',
    'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-6', 'p-8',
    'm-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-6', 'm-8'
  ],

  // 必须使用设计系统组件的场景
  designSystemComponents: [
    'Button', 'Input', 'Card', 'Badge', 'Alert'
  ],

  // 扫描的文件模式
  scanPatterns: [
    'apps/frontend/src/app/**/page.tsx',
    'apps/frontend/src/app/**/layout.tsx',
    'apps/frontend/src/components/**/*.tsx'
  ]
};

// 问题类型
const IssueType = {
  NON_STANDARD_TEXT_SIZE: 'non-standard-text-size',
  NON_STANDARD_SPACING: 'non-standard-spacing',
  INLINE_STYLE: 'inline-style',
  MAGIC_NUMBER: 'magic-number',
  MISSING_DATA_TESTID: 'missing-data-testid',
  INCONSISTENT_BUTTON: 'inconsistent-button',
  MISSING_LAYOUT: 'missing-layout',
  NO_CONTAINER_PADDING: 'no-container-padding',
  INCONSISTENT_WRAPPER: 'inconsistent-wrapper'
};

// 严重级别
const Severity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

// 收集的问题
const issues = [];

/**
 * 添加问题
 */
function addIssue(file, line, type, severity, description, suggestion) {
  issues.push({
    file: path.relative(rootDir, file),
    line,
    type,
    severity,
    description,
    suggestion
  });
}

/**
 * 检查文字大小
 */
function checkTextSizes(content, file) {
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 检测 style={{ fontSize: ... }}
    if (line.match(/fontSize\s*:\s*['"`]\d+/)) {
      addIssue(
        file,
        index + 1,
        IssueType.INLINE_STYLE,
        Severity.MEDIUM,
        '使用内联样式设置字体大小',
        '使用Tailwind的text-*类'
      );
    }

    // 检测自定义text-[14px]类
    const customSizeMatch = line.match(/text-\[(\d+)px\]/);
    if (customSizeMatch) {
      addIssue(
        file,
        index + 1,
        IssueType.NON_STANDARD_TEXT_SIZE,
        Severity.LOW,
        `使用自定义文字大小: text-[${customSizeMatch[1]}px]`,
        '使用标准的Tailwind text-*类'
      );
    }
  });
}

/**
 * 检查间距
 */
function checkSpacing(content, file) {
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 检测 style={{ padding: ..., margin: ... }}
    if (line.match(/(padding|margin)\s*:\s*['"`]\d+/)) {
      addIssue(
        file,
        index + 1,
        IssueType.INLINE_STYLE,
        Severity.MEDIUM,
        '使用内联样式设置间距',
        '使用Tailwind的p-*/m-*类'
      );
    }

    // 检测魔法数字: gap-[17px], p-[23px]等
    const magicNumberMatch = line.match(/(gap|p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr)-\[(\d+)px\]/);
    if (magicNumberMatch) {
      const value = parseInt(magicNumberMatch[2]);
      // 只报告非4的倍数
      if (value % 4 !== 0) {
        addIssue(
          file,
          index + 1,
          IssueType.MAGIC_NUMBER,
          Severity.LOW,
          `使用非标准间距值: ${magicNumberMatch[0]} (${value}px不是4的倍数)`,
          '使用标准的spacing scale (4px, 8px, 12px, 16px...)'
        );
      }
    }
  });
}

/**
 * 检查按钮一致性
 */
function checkButtons(content, file) {
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    // 检测原生button标签（应该使用Button组件）
    if (line.match(/<button[^>]*className=/) && !line.includes('Button')) {
      addIssue(
        file,
        index + 1,
        IssueType.INCONSISTENT_BUTTON,
        Severity.MEDIUM,
        '使用原生<button>标签而非Button组件',
        '导入并使用~/core/ui/Button组件'
      );
    }

    // 检测按钮没有variant属性
    if (line.includes('Button') && !line.match(/variant=/)) {
      addIssue(
        file,
        index + 1,
        IssueType.INCONSISTENT_BUTTON,
        Severity.LOW,
        'Button组件未指定variant属性',
        '明确指定variant (default, primary, outline, ghost, destructive)'
      );
    }
  });
}

/**
 * 检查data-testid
 */
function checkTestIds(content, file) {
  const lines = content.split('\n');

  // 只检查页面组件（page.tsx）
  if (!file.endsWith('page.tsx')) return;

  let hasDataTestId = false;
  lines.forEach((line) => {
    if (line.includes('data-testid=')) {
      hasDataTestId = true;
    }
  });

  if (!hasDataTestId) {
    addIssue(
      file,
      1,
      IssueType.MISSING_DATA_TESTID,
      Severity.LOW,
      '页面缺少data-testid属性，可能影响E2E测试',
      '为关键元素添加data-testid属性'
    );
  }
}

/**
 * 检查页面布局一致性
 */
function checkPageLayout(content, file) {
  // 只检查页面组件（page.tsx，但排除layout.tsx）
  if (!file.endsWith('page.tsx')) return;

  const lines = content.split('\n');

  // 检查是否有container和padding
  let hasContainer = false;
  let hasPadding = false;
  let hasMaxWidth = false;

  lines.forEach((line, index) => {
    // 检查container类
    if (line.match(/className.*container/)) {
      hasContainer = true;
    }

    // 检查padding类 (px-*, py-*, p-*)
    if (line.match(/className.*(px-|py-|p-)[0-9]+/)) {
      hasPadding = true;
    }

    // 检查max-width类
    if (line.match(/className.*max-w-/)) {
      hasMaxWidth = true;
    }

    // 检测顶级return中直接使用className但没有padding的情况
    if (line.match(/^\s*return\s*\(/)) {
      // 查找接下来的几行
      for (let i = index; i < Math.min(index + 10, lines.length); i++) {
        const checkLine = lines[i];
        // 如果找到className但没有padding相关类，可能有问题
        if (checkLine.includes('className=') &&
            !checkLine.match(/(px-|py-|p-)[0-9]+/) &&
            !checkLine.includes('container')) {
          addIssue(
            file,
            i + 1,
            IssueType.NO_CONTAINER_PADDING,
            Severity.MEDIUM,
            '页面内容可能没有适当的padding，内容会贴边显示',
            '添加 container mx-auto px-4 py-8 等类确保内容与边缘有适当间距'
          );
          break;
        }
      }
    }
  });

  // 检查特殊路由：/settings, /userinfo等需要确保有layout
  const isSettingsOrUserinfo = file.includes('/settings/') || file.includes('/userinfo/');
  if (isSettingsOrUserinfo) {
    // 检查对应目录是否有layout.tsx
    const dir = path.dirname(file);
    const layoutPath = path.join(dir, 'layout.tsx');

    if (!fs.existsSync(layoutPath)) {
      // 检查父目录
      const parentLayoutPath = path.join(path.dirname(dir), 'layout.tsx');
      if (!fs.existsSync(parentLayoutPath)) {
        addIssue(
          file,
          1,
          IssueType.MISSING_LAYOUT,
          Severity.HIGH,
          '认证页面缺少layout，可能缺少Header/Navbar',
          '创建layout.tsx使用AuthenticatedPageLayout或将页面移到合适的路由组'
        );
      }
    }
  }

  // 警告：页面内容既没有container也没有max-width
  if (!hasContainer && !hasMaxWidth) {
    addIssue(
      file,
      1,
      IssueType.INCONSISTENT_WRAPPER,
      Severity.MEDIUM,
      '页面内容缺少容器限制（container或max-w-*），在大屏幕上可能显示过宽',
      '添加 container mx-auto max-w-7xl 等类限制内容宽度'
    );
  }
}

/**
 * 扫描单个文件
 */
function scanFile(file) {
  try {
    const content = fs.readFileSync(file, 'utf-8');

    checkTextSizes(content, file);
    checkSpacing(content, file);
    checkButtons(content, file);
    checkTestIds(content, file);
    checkPageLayout(content, file);

  } catch (error) {
    console.error(`Error scanning ${file}:`, error.message);
  }
}

/**
 * 生成报告
 */
function generateReport() {
  console.log('\n🔍 UI一致性检查报告\n');
  console.log('━'.repeat(80));

  // 按严重程度分组
  const highIssues = issues.filter(i => i.severity === Severity.HIGH);
  const mediumIssues = issues.filter(i => i.severity === Severity.MEDIUM);
  const lowIssues = issues.filter(i => i.severity === Severity.LOW);

  console.log(`\n📊 总计: ${issues.length} 个问题`);
  console.log(`   🔴 High: ${highIssues.length}`);
  console.log(`   🟡 Medium: ${mediumIssues.length}`);
  console.log(`   🟢 Low: ${lowIssues.length}\n`);

  // 按类型分组统计
  const byType = {};
  issues.forEach(issue => {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
  });

  console.log('📈 问题类型分布:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count}`);
  });

  // 显示详细问题
  if (highIssues.length > 0) {
    console.log('\n🔴 High严重性问题:\n');
    highIssues.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`   ❌ ${issue.description}`);
      console.log(`   💡 ${issue.suggestion}\n`);
    });
  }

  if (mediumIssues.length > 0 && mediumIssues.length <= 20) {
    console.log('\n🟡 Medium严重性问题:\n');
    mediumIssues.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`   ⚠️  ${issue.description}`);
      console.log(`   💡 ${issue.suggestion}\n`);
    });
  } else if (mediumIssues.length > 20) {
    console.log(`\n🟡 Medium严重性问题: ${mediumIssues.length}个 (太多，仅显示前5个)\n`);
    mediumIssues.slice(0, 5).forEach(issue => {
      console.log(`   ${issue.file}:${issue.line}`);
      console.log(`   ⚠️  ${issue.description}\n`);
    });
  }

  // 生成JSON报告
  const reportPath = path.join(rootDir, 'test-reports', `ui-review-${new Date().toISOString().split('T')[0]}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: issues.length,
      high: highIssues.length,
      medium: mediumIssues.length,
      low: lowIssues.length,
      byType
    },
    issues
  }, null, 2));

  console.log(`\n💾 详细报告已保存: ${reportPath}`);
  console.log('━'.repeat(80) + '\n');

  // 返回退出码
  return highIssues.length > 0 ? 1 : 0;
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始UI一致性检查...\n');

  // 收集所有文件
  const files = [];
  for (const pattern of CONFIG.scanPatterns) {
    const fullPattern = path.join(rootDir, pattern);
    const matches = glob.sync(fullPattern);
    files.push(...matches);
  }

  console.log(`📁 扫描 ${files.length} 个文件...\n`);

  // 扫描所有文件
  let scanned = 0;
  for (const file of files) {
    scanFile(file);
    scanned++;

    // 显示进度
    if (scanned % 10 === 0) {
      process.stdout.write(`\r   已扫描: ${scanned}/${files.length}`);
    }
  }

  process.stdout.write(`\r   已扫描: ${scanned}/${files.length}\n`);

  // 生成报告
  const exitCode = generateReport();
  process.exit(exitCode);
}

// 执行
main().catch(error => {
  console.error('❌ 检查失败:', error);
  process.exit(1);
});
