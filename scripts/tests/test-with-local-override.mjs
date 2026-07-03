#!/usr/bin/env node

/**
 * Local E2E Testing with Domain Override
 * A simplified approach for local testing without complex DNS setup
 */

import { chromium, firefox, webkit } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

// Configuration
const LOCAL_CONFIG = {
  frontend: {
    host: 'localhost',
    port: 3000,
    protocol: 'http'
  },
  backend: {
    host: 'localhost',
    port: 8080,
    protocol: 'http'
  },
  targetDomain: 'www.urlchecker.dev',
  targetApiDomain: 'api.urlchecker.dev'
};

class LocalDomainTester {
  constructor(options = {}) {
    this.config = { ...LOCAL_CONFIG, ...options };
    this.browser = null;
    this.context = null;
    this.proxyServer = null;
  }

  async setup() {
    console.log('🔧 Setting up local testing environment...');

    // Start simple HTTP proxy for domain mapping
    await this.startProxy();

    // Setup browser with custom DNS
    await this.setupBrowser();
  }

  async startProxy() {
    console.log('🌐 Starting proxy server for domain mapping...');

    // Create a simple Node.js proxy server
    const proxyCode = `
const http = require('http');
const url = require('url');

const proxy = http.createServer((req, res) => {
  const targetHost = req.headers.host;
  let targetUrl;

  // Map target domains to local services
  if (targetHost === '${this.config.targetDomain}') {
    targetUrl = '${this.config.frontend.protocol}://${this.config.frontend.host}:${this.config.frontend.port}' + req.url;
  } else if (targetHost === '${this.config.targetApiDomain}') {
    targetUrl = '${this.config.backend.protocol}://${this.config.backend.host}:${this.config.backend.port}' + req.url;
  } else {
    // Direct proxy for other requests
    targetUrl = '${this.config.frontend.protocol}://${this.config.frontend.host}:${this.config.frontend.port}' + req.url;
  }

  const target = url.parse(targetUrl);

  const proxyReq = http.request({
    hostname: target.hostname,
    port: target.port,
    path: target.path,
    method: req.method,
    headers: req.headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502);
    res.end('Proxy Error');
  });

  req.pipe(proxyReq);
});

const PORT = 8081;
proxy.listen(PORT, () => {
  console.log(\`Proxy server running on port \${PORT}\`);
  console.log(\`- http://${this.config.targetDomain} -> http://${this.config.frontend.host}:${this.config.frontend.port}\`);
  console.log(\`- http://${this.config.targetApiDomain} -> http://${this.config.backend.host}:${this.config.backend.port}\`);
});
`;

    // Write proxy server to temporary file
    const proxyFile = '/tmp/local-proxy-server.js';
    await fs.writeFile(proxyFile, proxyCode);

    // Start proxy server
    this.proxyServer = spawn('node', [proxyFile], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for proxy to start
    await new Promise((resolve, reject) => {
      let output = '';
      this.proxyServer.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Proxy server running')) {
          resolve();
        }
      });

      this.proxyServer.stderr.on('data', (data) => {
        console.error('Proxy error:', data.toString());
        reject(new Error('Proxy server failed to start'));
      });

      setTimeout(() => {
        reject(new Error('Proxy server start timeout'));
      }, 10000);
    });

    console.log('✅ Proxy server started on port 8081');
  }

  async setupBrowser() {
    const browserType = chromium; // Use Chromium for better reliability

    this.browser = await browserType.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOWMO ? 100 : 0,
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--proxy-server=http://localhost:8081',
        '--ignore-certificate-errors'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      // Set user agent to mimic real browser
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // Override DNS resolution
    await this.context.route('**/*', async (route) => {
      const url = route.request().url();

      // Map target domains to local proxy
      if (url.includes(this.config.targetDomain) || url.includes(this.config.targetApiDomain)) {
        // Let proxy handle the mapping
        await route.continue();
      } else {
        // Direct connection for other requests
        await route.continue();
      }
    });

    console.log('✅ Browser setup completed');
  }

  async runTest(testName, testFunction) {
    const page = await this.context.newPage();

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Add page error handling
      page.on('pageerror', (error) => {
        console.error(`Page error in ${testName}:`, error);
      });

      page.on('requestfailed', (request) => {
        console.error(`Request failed in ${testName}:`, request.url());
      });

      // Run the test function
      await testFunction(page);

      console.log(`✅ Test passed: ${testName}`);
      return { success: true, testName };

    } catch (error) {
      console.error(`❌ Test failed: ${testName}`, error.message);

      // Take screenshot on failure
      const screenshotPath = `/tmp/test-failure-${testName}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      return { success: false, testName, error: error.message, screenshot: screenshotPath };

    } finally {
      await page.close();
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up testing environment...');

    if (this.context) {
      await this.context.close();
    }

    if (this.browser) {
      await this.browser.close();
    }

    if (this.proxyServer) {
      this.proxyServer.kill();
    }

    // Clean up temporary files
    try {
      await fs.unlink('/tmp/local-proxy-server.js');
    } catch (error) {
      // Ignore file not found errors
    }

    console.log('✅ Cleanup completed');
  }
}

// Test functions
async function testFrontendAccess(page) {
  const targetUrl = `http://${LOCAL_CONFIG.targetDomain}`;
  console.log(`🌐 Navigating to ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  // Wait for main page content
  await page.waitForSelector('body', { timeout: 10000 });

  // Check if page loaded successfully
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Look for key elements
  const mainElement = await page.$('main') || await page.$('#root');
  if (!mainElement) {
    throw new Error('Main page content not found');
  }
}

async function testAPIAccess(page) {
  const targetUrl = `http://${LOCAL_CONFIG.targetApiDomain}/health`;
  console.log(`🔗 Testing API access: ${targetUrl}`);

  const response = await page.goto(targetUrl, { waitUntil: 'networkidle' });

  if (!response || !response.ok()) {
    throw new Error(`API health check failed: ${response?.status()}`);
  }

  console.log('✅ API health check passed');
}

async function testAuthenticationFlow(page) {
  const targetUrl = `http://${LOCAL_CONFIG.targetDomain}/auth/sign-in`;
  console.log(`🔐 Testing authentication flow: ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  // Wait for login form
  await page.waitForSelector('form', { timeout: 10000 });

  // Fill test credentials
  await page.fill('input[type="email"], input[name="email"]', 'test@local.dev');
  await page.fill('input[type="password"], input[name="password"]', 'TestPassword123!');

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  console.log('✅ Authentication flow completed');
}

async function testSubscriptionFeatures(page) {
  const targetUrl = `http://${LOCAL_CONFIG.targetDomain}/settings/subscription`;
  console.log(`💳 Testing subscription features: ${targetUrl}`);

  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  // Wait for subscription page content
  await page.waitForSelector('[data-testid="subscription-info"], .subscription-info', { timeout: 10000 });

  // Check for key subscription elements
  const subscriptionInfo = await page.$('[data-testid="subscription-info"], .subscription-info');
  if (!subscriptionInfo) {
    throw new Error('Subscription information not found');
  }

  // Look for upgrade buttons or trial options
  const trialButton = await page.$('[data-testid="start-trial"], .trial-button');
  const upgradeButton = await page.$('[data-testid="upgrade-button"], .upgrade-button');

  console.log(`Trial button found: ${trialButton ? 'Yes' : 'No'}`);
  console.log(`Upgrade button found: ${upgradeButton ? 'Yes' : 'No'}`);

  console.log('✅ Subscription features test completed');
}

// Main execution
async function main() {
  const tester = new LocalDomainTester();

  try {
    await tester.setup();

    // Run test suite
    const tests = [
      { name: 'Frontend Access', fn: testFrontendAccess },
      { name: 'API Access', fn: testAPIAccess },
      { name: 'Authentication Flow', fn: testAuthenticationFlow },
      { name: 'Subscription Features', fn: testSubscriptionFeatures }
    ];

    const results = [];

    for (const test of tests) {
      const result = await tester.runTest(test.name, test.fn);
      results.push(result);

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate report
    const passedTests = results.filter(r => r.success).length;
    const totalTests = results.length;

    console.log('\n📊 Test Results Summary:');
    console.log('======================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${totalTests - passedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    // Show failed tests
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`- ${test.testName}: ${test.error}`);
        if (test.screenshot) {
          console.log(`  📸 Screenshot: ${test.screenshot}`);
        }
      });
    }

    // Save results
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'local',
      config: LOCAL_CONFIG,
      results: results,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        successRate: (passedTests / totalTests) * 100
      }
    };

    await fs.writeFile('/tmp/local-test-results.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Detailed report saved to: /tmp/local-test-results.json');

    // Exit with appropriate code
    if (passedTests === totalTests) {
      console.log('\n🎉 All tests passed! Local environment is ready for development.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please check the issues above.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);

  } finally {
    await tester.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received interrupt signal, cleaning up...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received termination signal, cleaning up...');
  process.exit(0);
});

main().catch(console.error);