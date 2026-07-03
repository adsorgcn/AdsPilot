#!/usr/bin/env node

/**
 * 批量清理console语句的脚本
 * 将生产环境不需要的console.log调用替换为条件调用
 */

const fs = require('fs');
const path = require('path');

// 需要处理的文件列表
const filesToProcess = [
  'src/components/monitoring/WebVitals.tsx',
  'src/components/monitoring/RealTimePerformanceDashboard.tsx',
  'src/lib/utils/logger.ts',
  'src/lib/api/clients/MainApiClient.ts',
  'src/core/api/APIOptimizer.tsx',
  'src/lib/api/monitoring/ApiMetrics.ts',
];

// 为每个文件处理console语句
filesToProcess.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // 替换console.error - 保留错误日志
  content = content.replace(/console\.error\(/g, 'if (process.env.NODE_ENV !== \'production\') console.error(');

  // 替换console.log - 开发环境才记录
  content = content.replace(/console\.log\(/g, 'if (process.env.NODE_ENV !== \'production\') console.log(');

  // 替换console.warn - 开发环境才记录
  content = content.replace(/console\.warn\(/g, 'if (process.env.NODE_ENV !== \'production\') console.warn(');

  // 替换console.info - 开发环境才记录
  content = content.replace(/console\.info\(/g, 'if (process.env.NODE_ENV !== \'production\') console.info(');

  // 替换console.debug - 开发环境才记录
  content = content.replace(/console\.debug\(/g, 'if (process.env.NODE_ENV !== \'production\') console.debug(');

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Processed: ${filePath}`);
});

console.log('Console warning cleanup completed!');