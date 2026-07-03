#!/usr/bin/env node

/**
 * Generate Test Summary for GitHub Actions
 * Parses test results and creates formatted summary
 */

import fs from 'fs';
import path from 'path';

const RESULTS_FILE = process.argv[2];

if (!RESULTS_FILE) {
  console.error('Usage: node generate-test-summary.js <results-file>');
  process.exit(1);
}

function parseTestResults(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = JSON.parse(content);

    return {
      total: results.total || 0,
      passed: results.passed || 0,
      failed: results.failed || 0,
      skipped: results.skipped || 0,
      duration: results.duration || 0,
      suites: results.suites || [],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error parsing test results:', error.message);
    return {
      total: 0,
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: 0,
      suites: [],
      error: error.message
    };
  }
}

function generateSummary(results) {
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  const status = results.failed === 0 ? '✅ PASSED' : '❌ FAILED';

  return `
## 🧪 E2E Test Results ${status}

### 📊 Overall Summary
- **Total Tests**: ${results.total}
- **Passed**: ${results.passed} ✅
- **Failed**: ${results.failed} ❌
- **Skipped**: ${results.skipped} ⏭️
- **Success Rate**: ${successRate}%
- **Duration**: ${(results.duration / 1000).toFixed(2)}s

### 🎯 Test Suite Details

${results.suites.map(suite => `
#### ${suite.name}
- Status: ${suite.status === 'passed' ? '✅ PASSED' : '❌ FAILED'}
- Duration: ${(suite.duration / 1000).toFixed(2)}s
- Tests: ${suite.tests || 0}

${suite.failures && suite.failures.length > 0 ? `
**Failures:**
${suite.failures.map(failure => `
- \`${failure.test}\`: ${failure.message}
`).join('')}
` : ''}
`).join('')}

### 📈 Performance Metrics
- Average Test Duration: ${results.total > 0 ? (results.duration / results.total).toFixed(2) : 0}ms
- Fastest Test: ${results.fastestTest || 'N/A'}
- Slowest Test: ${results.slowestTest || 'N/A'}

### 🚨 Action Items
${results.failed > 0 ? `
- **🔧 Fix ${results.failed} failed test(s)**
- **📋 Review test logs for failure details**
- **🧪 Re-run failed tests locally**
` : `
- ✅ All tests passed! Ready for deployment.
- 📊 Review performance metrics
- 🎯 Consider adding more edge case tests
`}

### 📊 Coverage Report
- **Feature Coverage**: ${results.coverage || 'N/A'}
- **API Coverage**: ${results.apiCoverage || 'N/A'}
- **UI Coverage**: ${results.uiCoverage || 'N/A'}

---
*Generated at: ${results.timestamp}*
`;
}

function main() {
  const results = parseTestResults(RESULTS_FILE);
  const summary = generateSummary(results);

  console.log(summary);

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

main();