/**
 * 前端架构合规性验证脚本
 *
 * 检查前端代码是否符合Google-Monetize架构要求：
 * 1. 无直接Supabase数据库访问
 * 2. 认证回调使用API而非直接查询
 * 3. 用户数据通过API Gateway访问
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import * as process from 'process';

interface Violation {
  file: string;
  line: number;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  fix?: string;
}

interface ComplianceReport {
  totalFiles: number;
  violations: Violation[];
  compliance: number;
  summary: {
    directDatabaseAccess: number;
    directSupabaseQueries: number;
    missingApiUsage: number;
    architecturalCompliance: number;
  };
}

const FRONTEND_DIR = './apps/frontend/src';
const VIOLATION_PATTERNS = [
  {
    // 直接Supabase查询
    pattern: /\.from\s*\(\s*['"`][^'"`]*['"`]\s*\)/g,
    severity: 'high' as const,
    issue: 'Direct Supabase database query',
    fix: 'Replace with API Gateway call'
  },
  {
    // client.from查询
    pattern: /client\s*\.from\s*\(/g,
    severity: 'high' as const,
    issue: 'Direct database access via client.from',
    fix: 'Replace with API Gateway call'
  },
  {
    // 直接表操作
    pattern: /\.insert\s*\(|\.update\s*\(|\.delete\s*\(|\.select\s*\(/g,
    severity: 'medium' as const,
    issue: 'Direct table operations',
    fix: 'Replace with API Gateway call'
  },
  {
    // 使用mutations.ts
    pattern: /from\s*['"'].*mutations['"']/g,
    severity: 'high' as const,
    issue: 'Import from mutations file (direct database access)',
    fix: 'Replace with API client usage'
  }
];

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];

  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      VIOLATION_PATTERNS.forEach(({ pattern, severity, issue, fix }) => {
        if (pattern.test(line)) {
          violations.push({
            file: relative(process.cwd(), filePath),
            line: lineIndex + 1,
            issue,
            severity,
            fix
          });
        }
      });
    });
  } catch (error) {
    // 忽略读取错误
  }

  return violations;
}

function scanDirectory(dir: string, extensions: string[] = ['.ts', '.tsx']): ComplianceReport {
  const report: ComplianceReport = {
    totalFiles: 0,
    violations: [],
    compliance: 100,
    summary: {
      directDatabaseAccess: 0,
      directSupabaseQueries: 0,
      missingApiUsage: 0,
      architecturalCompliance: 100
    }
  };

  function scanRecursive(currentDir: string) {
    const items = readdirSync(currentDir);

    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // 跳过node_modules和其他不需要的目录
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
          scanRecursive(fullPath);
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        report.totalFiles++;
        const violations = scanFile(fullPath);
        report.violations.push(...violations);
      }
    }
  }

  scanRecursive(dir);

  // 计算合规性
  const highSeverityCount = report.violations.filter(v => v.severity === 'high').length;
  const mediumSeverityCount = report.violations.filter(v => v.severity === 'medium').length;

  // 高严重性违规扣20%，中严重性扣10%
  const deduction = (highSeverityCount * 20) + (mediumSeverityCount * 10);
  report.compliance = Math.max(0, 100 - deduction);

  // 统计具体问题类型
  report.summary.directDatabaseAccess = report.violations.filter(v =>
    v.issue.includes('database access') || v.issue.includes('table operations')
  ).length;
  report.summary.directSupabaseQueries = report.violations.filter(v =>
    v.issue.includes('Supabase database query') || v.issue.includes('client.from')
  ).length;
  report.summary.missingApiUsage = report.violations.filter(v =>
    v.issue.includes('mutations file')
  ).length;
  report.summary.architecturalCompliance = report.compliance;

  return report;
}

function generateReport(report: ComplianceReport): void {
  console.log('\n📊 前端架构合规性验证报告');
  console.log('=' .repeat(50));
  console.log(`📁 扫描文件数: ${report.totalFiles}`);
  console.log(`⚠️  发现违规: ${report.violations.length}`);
  console.log(`✅ 合规性评分: ${report.compliance}%\n`);

  if (report.violations.length > 0) {
    console.log('🔍 违规详情:');
    console.log('-' .repeat(50));

    // 按严重性分组
    const highSeverity = report.violations.filter(v => v.severity === 'high');
    const mediumSeverity = report.violations.filter(v => v.severity === 'medium');
    const lowSeverity = report.violations.filter(v => v.severity === 'low');

    if (highSeverity.length > 0) {
      console.log('\n🔴 高严重性违规:');
      highSeverity.forEach(v => {
        console.log(`  ${v.file}:${v.line} - ${v.issue}`);
        if (v.fix) console.log(`    💡 建议: ${v.fix}`);
      });
    }

    if (mediumSeverity.length > 0) {
      console.log('\n🟡 中严重性违规:');
      mediumSeverity.forEach(v => {
        console.log(`  ${v.file}:${v.line} - ${v.issue}`);
        if (v.fix) console.log(`    💡 建议: ${v.fix}`);
      });
    }

    if (lowSeverity.length > 0) {
      console.log('\n🟢 低严重性违规:');
      lowSeverity.forEach(v => {
        console.log(`  ${v.file}:${v.line} - ${v.issue}`);
        if (v.fix) console.log(`    💡 建议: ${v.fix}`);
      });
    }
  }

  console.log('\n📈 统计摘要:');
  console.log(`  直接数据库访问: ${report.summary.directDatabaseAccess}`);
  console.log(`  直接Supabase查询: ${report.summary.directSupabaseQueries}`);
  console.log(`  缺失API使用: ${report.summary.missingApiUsage}`);
  console.log(`  架构合规性: ${report.summary.architecturalCompliance}%`);

  // 生成JSON报告
  const jsonReport = {
    timestamp: new Date().toISOString(),
    ...report,
    status: report.compliance >= 90 ? 'PASS' : 'FAIL',
    recommendations: generateRecommendations(report)
  };

  try {
    require('fs').writeFileSync(
      './frontend-compliance-report.json',
      JSON.stringify(jsonReport, null, 2)
    );
    console.log('\n📄 详细报告已保存到: frontend-compliance-report.json');
  } catch (error) {
    console.log('\n⚠️  无法保存JSON报告');
  }

  // 最终结果
  if (report.compliance >= 90) {
    console.log('\n✅ 前端架构合规性验证通过！');
    process.exit(0);
  } else {
    console.log('\n❌ 前端架构合规性验证失败，需要修复违规代码');
    process.exit(1);
  }
}

function generateRecommendations(report: ComplianceReport): string[] {
  const recommendations: string[] = [];

  if (report.summary.directSupabaseQueries > 0) {
    recommendations.push('移除所有直接Supabase查询，改为通过API Gateway访问');
  }

  if (report.summary.missingApiUsage > 0) {
    recommendations.push('删除mutations.ts文件，使用API客户端替代');
  }

  if (report.summary.directDatabaseAccess > 0) {
    recommendations.push('实现完整的API Gateway集成，确保所有数据访问通过API');
  }

  if (report.compliance < 100) {
    recommendations.push('运行代码审查，确保符合Google-Monetize架构要求');
  }

  return recommendations;
}

// 主函数
function main() {
  console.log('🔍 开始前端架构合规性验证...\n');

  const report = scanDirectory(FRONTEND_DIR);
  generateReport(report);
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { scanDirectory, generateReport, ComplianceReport, Violation };