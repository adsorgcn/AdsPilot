#!/usr/bin/env node

/**
 * 通过真实的Supabase客户端SDK获取有效的认证session
 * 使用项目的真实Supabase配置
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

class RealSupabaseSession {
  constructor() {
    this.baseUrl = 'https://www.urlchecker.dev';
    this.token = null;
    this.user = null;
  }

  async createRealUserSession() {
    console.log('🔐 Creating real user session via Supabase...');

    const browser = await chromium.launch({
      headless: false, // 显示浏览器便于调试
      slowMo: 1000 // 减慢操作速度
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
      // 监听网络请求和响应
      const networkRequests = [];
      page.on('response', async (response) => {
        const url = response.url();
        const headers = response.headers();

        // 记录所有Supabase相关的请求
        if (url.includes('supabase') || url.includes('auth')) {
          networkRequests.push({
            url,
            status: response.status(),
            headers
          });

          // 检查是否有认证相关的token
          const authHeader = headers['authorization'] || headers['Authorization'];
          if (authHeader && authHeader.startsWith('Bearer ')) {
            this.token = authHeader.replace('Bearer ', '');
            console.log('🎯 Found token in network request!');
          }

          // 检查响应体中是否有token
          try {
            const body = await response.text();
            if (body.includes('access_token') || body.includes('session')) {
              console.log('📄 Found auth data in response body');
              // 尝试解析JSON
              try {
                const data = JSON.parse(body);
                if (data.access_token) {
                  this.token = data.access_token;
                  console.log('🎯 Found access_token in response!');
                }
                if (data.session?.access_token) {
                  this.token = data.session.access_token;
                  console.log('🎯 Found session.access_token in response!');
                }
              } catch (e) {
                console.log('⚠️ Failed to parse response JSON');
              }
            }
          } catch (e) {
            // 忽略响应解析错误
          }
        }
      });

      console.log('🌐 Navigating to auth page...');
      await page.goto(`${this.baseUrl}/auth`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // 等待页面加载
      await page.waitForTimeout(5000);

      // 截图当前状态
      await page.screenshot({ path: '/tmp/auth-page-initial.png', fullPage: true });

      console.log('📝 Looking for sign-in elements...');

      // 尝试找到并点击sign-in按钮或链接
      const signInSelectors = [
        'button:has-text("Sign In")',
        'button:has-text("Sign in")',
        'a:has-text("Sign In")',
        'a:has-text("Sign in")',
        'button:has-text("Login")',
        'a:has-text("Login")',
        '[data-testid="sign-in-button"]',
        '#sign-in-button',
        '.sign-in-button'
      ];

      let signInButton = null;
      for (const selector of signInSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            signInButton = element;
            console.log(`✅ Found sign-in element: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!signInButton) {
        console.log('⚠️ No sign-in button found, looking for email/password form...');

        // 尝试找到直接注册/登录表单
        const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
        const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"]').first();

        if (await emailInput.isVisible({ timeout: 3000 })) {
          console.log('✅ Found email input field');

          // 填写测试邮箱
          await emailInput.fill('demo-test@urlchecker.dev');
          await page.waitForTimeout(1000);

          if (await passwordInput.isVisible({ timeout: 2000 })) {
            console.log('✅ Found password input field');
            await passwordInput.fill('DemoPassword123!');
            await page.waitForTimeout(1000);

            // 查找提交按��
            const submitButton = page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Register"), button:has-text("Create")').first();
            if (await submitButton.isVisible()) {
              console.log('✅ Found submit button');
              await submitButton.click();
            } else {
              console.log('⚠️ No submit button found, trying Enter key');
              await page.keyboard.press('Enter');
            }
          } else {
            console.log('⚠️ No password input found');
          }
        } else {
          console.log('⚠️ No email input found');
        }
      } else {
        console.log('🚀 Clicking sign-in button...');
        await signInButton.click();
        await page.waitForTimeout(3000);

        // 再次查找表单
        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        if (await emailInput.isVisible({ timeout: 3000 })) {
          console.log('✅ Found email input after clicking sign-in');
          await emailInput.fill('demo-test@urlchecker.dev');
          await page.waitForTimeout(1000);

          const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
          if (await passwordInput.isVisible({ timeout: 2000 })) {
            await passwordInput.fill('DemoPassword123!');
            await page.waitForTimeout(1000);

            const submitButton = page.locator('button[type="submit"], button:has-text("Sign")').first();
            if (await submitButton.isVisible()) {
              await submitButton.click();
            } else {
              await page.keyboard.press('Enter');
            }
          }
        }
      }

      // 等待认证流程完成
      console.log('⏳ Waiting for authentication to complete...');
      await page.waitForTimeout(10000);

      // 截图结果
      await page.screenshot({ path: '/tmp/auth-result.png', fullPage: true });

      // 检查是否成功登录（URL变化或页面内容）
      const currentUrl = page.url();
      console.log(`📄 Current URL after auth attempt: ${currentUrl}`);

      if (currentUrl.includes('/dashboard') || currentUrl.includes('/app') || !currentUrl.includes('/auth')) {
        console.log('✅ Authentication appears successful!');
      }

      // 尝试从localStorage获取token
      console.log('💾 Checking localStorage for tokens...');
      const localStorageData = await page.evaluate(() => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('token') || value?.includes('eyJ'))) {
            data[key] = value;
          }
        }
        return data;
      });

      console.log('📱 LocalStorage keys found:', Object.keys(localStorageData));

      // 查找token
      for (const [key, value] of Object.entries(localStorageData)) {
        if (typeof value === 'string') {
          if (value.includes('access_token')) {
            try {
              const parsed = JSON.parse(value);
              if (parsed.access_token) {
                this.token = parsed.access_token;
                console.log(`🎯 Found access_token in localStorage (${key})`);
                break;
              }
            } catch (e) {
              // 继续检查是否是直接的token
              if (value.startsWith('eyJ')) {
                // 可能是直接的JWT token
                try {
                  const parts = value.split('.');
                  if (parts.length === 3) {
                    this.token = value;
                    console.log(`🎯 Found JWT token in localStorage (${key})`);
                    break;
                  }
                } catch (jwtError) {
                  // 不是有效的JWT格式
                }
              }
            }
          }
        }
      }

      // 检查cookies
      if (!this.token) {
        console.log('🍪 Checking cookies for tokens...');
        const cookies = await context.cookies();
        for (const cookie of cookies) {
          if (cookie.value && cookie.value.startsWith('eyJ') && cookie.value.includes('.')) {
            const parts = cookie.value.split('.');
            if (parts.length === 3) {
              this.token = cookie.value;
              console.log(`🎯 Found JWT token in cookie (${cookie.name})`);
              break;
            }
          }
        }
      }

      console.log(`🔍 Final token status: ${this.token ? 'FOUND' : 'NOT FOUND'}`);
      if (this.token) {
        console.log(`🎯 Token (first 50 chars): ${this.token.substring(0, 50)}...`);
      }

      // 记录所有网络请求供调试
      console.log(`📊 Total network requests captured: ${networkRequests.length}`);
      networkRequests.forEach((req, index) => {
        console.log(`${index + 1}. ${req.url} - Status: ${req.status}`);
      });

      // 保存调试信息
      await fs.writeFile('/tmp/auth-debug-info.json', JSON.stringify({
        localStorageData,
        networkRequests,
        currentUrl,
        tokenFound: !!this.token,
        tokenPreview: this.token ? this.token.substring(0, 100) : null
      }, null, 2));

      return this.token;

    } catch (error) {
      console.error('❌ Error during authentication:', error.message);
      return null;
    } finally {
      await browser.close();
    }
  }

  async validateToken(token) {
    if (!token) {
      console.log('❌ No token to validate');
      return false;
    }

    console.log('🔍 Validating token with Demo API...');

    try {
      const response = await fetch('https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app/api/v1/demo/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Validation response status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token validation successful!');
        console.log('📄 Demo API Response:', JSON.stringify(data, null, 2));
        return true;
      } else {
        const error = await response.text();
        console.log('❌ Token validation failed:', error);
        return false;
      }
    } catch (error) {
      console.log('❌ Validation error:', error.message);
      return false;
    }
  }

  async saveToken(token) {
    if (!token) return;

    const tokenData = {
      token,
      obtainedAt: new Date().toISOString(),
      method: 'real-supabase-session',
      source: 'browser-session'
    };

    await fs.writeFile('/tmp/real-supabase-token.json', JSON.stringify(tokenData, null, 2));
    await fs.writeFile('/tmp/demo-test-token.txt', token);

    console.log('💾 Real token saved successfully');
  }
}

async function main() {
  const session = new RealSupabaseSession();

  try {
    console.log('🚀 Real Supabase Session Generator');
    console.log('===================================');

    // 获取真实session
    const token = await session.createRealUserSession();

    if (token) {
      console.log('\n✅ Session created successfully!');

      // 验证token
      const isValid = await session.validateToken(token);

      if (isValid) {
        console.log('\n🎉 SUCCESS: Real Supabase token works!');

        // 保存token
        await session.saveToken(token);

        console.log('\n=== READY FOR DEMO DATA TESTING ===');
        console.log('Set environment variable:');
        console.log(`export TEST_AUTH_TOKEN="${token}"`);
        console.log('');
        console.log('The token is also saved to:');
        console.log('- /tmp/demo-test-token.txt');
        console.log('- /tmp/real-supabase-token.json');
        console.log('===================================');

        process.exit(0);
      } else {
        console.log('\n❌ Token validation failed');
        console.log('💡 The session was created but the token may not be valid for API access');
        process.exit(1);
      }
    } else {
      console.log('\n❌ Failed to create session');
      console.log('💡 Check the screenshots saved to /tmp/ for debugging');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Session creation failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RealSupabaseSession };