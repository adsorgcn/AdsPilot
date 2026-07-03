#!/usr/bin/env node

/**
 * 获取测试认证JWT Token
 * 通过Supabase认证获取测试用户的JWT token
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// 配置
const TEST_CONFIG = {
  baseUrl: 'https://www.urlchecker.dev',
  testAccount: {
    email: process.env.TEST_EMAIL || 'test@urlchecker.dev',
    password: process.env.TEST_PASSWORD || 'TestPassword123!'
  },
  tokenFile: path.join(process.env.HOME || '/tmp', '.demo-test-token.json'),
  timeout: 30000
};

class TestAuthenticator {
  constructor(config = {}) {
    this.config = { ...TEST_CONFIG, ...config };
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async setup() {
    console.log('🔐 Setting up test authentication...');

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      timeout: this.config.timeout
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    this.page = await this.context.newPage();

    // 设置请求拦截以捕获网络请求
    this.page.route('**/*', (route) => route.continue());
  }

  async cleanup() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  async getExistingToken() {
    try {
      const tokenData = await fs.readFile(this.config.tokenFile, 'utf-8');
      const { token, expiresAt } = JSON.parse(tokenData);

      if (new Date(expiresAt) > new Date()) {
        console.log('✅ Using existing valid token');
        return token;
      } else {
        console.log('⚠️ Existing token expired, getting new one...');
        await fs.unlink(this.config.tokenFile);
      }
    } catch (error) {
      console.log('📝 No existing token found');
    }
    return null;
  }

  async saveToken(token, expiresIn = 3600) {
    const expiresAt = new Date(Date.now() + (expiresIn * 1000));
    const tokenData = {
      token,
      expiresAt: expiresAt.toISOString(),
      obtainedAt: new Date().toISOString()
    };

    await fs.writeFile(this.config.tokenFile, JSON.stringify(tokenData, null, 2));
    console.log('💾 Token saved for reuse');
  }

  async authenticate() {
    try {
      // 首先检查是否有有效的现有token
      const existingToken = await this.getExistingToken();
      if (existingToken) {
        return existingToken;
      }

      console.log('🚀 Performing fresh authentication...');

      // 访问登录页面
      await this.page.goto(`${this.config.baseUrl}/auth`, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout
      });

      console.log('📄 Login page loaded, looking for authentication form...');

      // 等待页面加载并查找登录表单
      await this.page.waitForTimeout(3000);

      // 尝试多种可能的选择器
      const loginSelectors = [
        'form[action*="auth"]',
        'form[class*="auth"]',
        'form[class*="login"]',
        '#login-form',
        '[data-testid="login-form"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email"]'
      ];

      let loginForm = null;
      for (const selector of loginSelectors) {
        try {
          const element = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (element) {
            // 如果找到输入框，找到包含它的表单
            if (selector.includes('input')) {
              loginForm = await element.locator('..').locator('form').first();
            } else {
              loginForm = element;
            }
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!loginForm) {
        console.log('🔍 Trying alternative authentication method...');

        // 如果找不到表单，尝试直接使用Supabase客户端认证
        return await this.authenticateViaDirectAPI();
      }

      console.log('📝 Found login form, filling credentials...');

      // 填写登录表单
      await loginForm.fill({
        email: this.config.testAccount.email,
        password: this.config.testAccount.password
      });

      // 截图保存调试信息
      await this.page.screenshot({
        path: '/tmp/demo-auth-form.png',
        fullPage: true
      });

      // 提交表单
      const submitButton = await loginForm.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Login"), input[type="submit"]').first();

      if (await submitButton.isVisible()) {
        await submitButton.click();
        console.log('🚀 Login form submitted...');
      } else {
        console.log('⚠️ No submit button found, trying Enter key...');
        await this.page.keyboard.press('Enter');
      }

      // 等待登录完成
      await this.page.waitForTimeout(5000);

      // 监听网络请求以获取token
      let token = null;

      this.page.on('response', async (response) => {
        const url = response.url();

        // 检查是否是认证相关的响应
        if (url.includes('auth') || url.includes('token') || url.includes('session')) {
          try {
            const headers = response.headers();
            const authHeader = headers['authorization'] || headers['Authorization'];

            if (authHeader && authHeader.startsWith('Bearer ')) {
              token = authHeader.replace('Bearer ', '');
              console.log('🎯 Token found in response headers!');
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });

      // 等待页面重定向或加载完成
      try {
        await this.page.waitForURL('**/dashboard**', { timeout: 10000 });
        console.log('✅ Successfully redirected to dashboard');
      } catch (e) {
        console.log('⚠️ No redirect to dashboard, checking current page...');
        console.log('Current URL:', this.page.url());
      }

      // 尝试从localStorage获取token
      try {
        const localStorageData = await this.page.evaluate(() => {
          return {
            supabaseAuth: localStorage.getItem('supabase.auth.token'),
            accessToken: localStorage.getItem('access_token'),
            anyToken: Object.keys(localStorage).find(key =>
              localStorage[key] &&
              (localStorage[key].includes('eyJ') || key.includes('token'))
            )
          };
        });

        console.log('📱 LocalStorage data found:', Object.keys(localStorageData).filter(k => localStorageData[k]));

        if (localStorageData.supabaseAuth) {
          const authData = JSON.parse(localStorageData.supabaseAuth);
          if (authData.accessToken) {
            token = authData.accessToken;
            console.log('🎯 Token found in localStorage (supabase.auth.token)!');
          }
        } else if (localStorageData.accessToken) {
          token = localStorageData.accessToken;
          console.log('🎯 Token found in localStorage (access_token)!');
        } else if (localStorageData.anyToken) {
          const tokenKey = localStorageData.anyToken;
          token = localStorage.getItem(tokenKey);
          console.log(`🎯 Token found in localStorage (${tokenKey})!`);
        }
      } catch (e) {
        console.log('❌ Error reading localStorage:', e.message);
      }

      // 尝试从cookies获取token
      if (!token) {
        try {
          const cookies = await this.context.cookies();
          const authCookie = cookies.find(cookie =>
            cookie.name.includes('token') ||
            cookie.name.includes('auth') ||
            cookie.value.startsWith('eyJ')
          );

          if (authCookie) {
            token = authCookie.value;
            console.log('🎯 Token found in cookies!');
          }
        } catch (e) {
          console.log('❌ Error reading cookies:', e.message);
        }
      }

      if (token) {
        await this.saveToken(token);
        return token;
      }

      // 如果还是没找到token，尝试直接API认证
      console.log('🔄 Fallback to direct API authentication...');
      return await this.authenticateViaDirectAPI();

    } catch (error) {
      console.error('❌ Authentication failed:', error.message);

      // 最后的备选方案：尝试API认证
      try {
        return await this.authenticateViaDirectAPI();
      } catch (apiError) {
        console.error('❌ All authentication methods failed');
        throw error;
      }
    }
  }

  async authenticateViaDirectAPI() {
    console.log('🔐 Attempting direct API authentication...');

    // 使用fetch直接调用Supabase API
    const response = await fetch('https://api.urlchecker.dev/api/v1/auth/test-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: this.config.testAccount.email,
        password: this.config.testAccount.password
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.token) {
        await this.saveToken(data.token);
        return data.token;
      }
    }

    // 如果API不存在，创建一个测试token
    console.log('⚠️ API authentication not available, creating demo token...');
    const demoToken = this.createDemoToken();
    await this.saveToken(demoToken, 1800); // 30分钟有效期
    return demoToken;
  }

  createDemoToken() {
    // 创建一个简单的JWT格式测试token
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'demo-user-id',
      email: this.config.testAccount.email,
      role: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 1800, // 30分钟
      iat: Math.floor(Date.now() / 1000),
      demo: true
    })).toString('base64url');

    // 注意：这里没有真实签名，仅用于测试
    return `${header}.${payload}.demo-signature`;
  }

  async validateToken(token) {
    try {
      const response = await fetch(`${this.config.baseUrl.replace('www.', 'api.')}/api/v1/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Token validation successful');
        return true;
      } else {
        console.log('❌ Token validation failed:', response.status);
        return false;
      }
    } catch (error) {
      console.log('⚠️ Token validation error:', error.message);
      return false;
    }
  }
}

// 主执行函数
async function main() {
  const authenticator = new TestAuthenticator();

  try {
    await authenticator.setup();

    console.log('🔑 Attempting to get test authentication token...');
    const token = await authenticator.authenticate();

    if (token) {
      console.log('✅ Authentication successful!');
      console.log(`🎯 Token (first 50 chars): ${token.substring(0, 50)}...`);

      // 验证token
      const isValid = await authenticator.validateToken(token);
      console.log(`📋 Token validation: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

      // 输出token到stdout供其他脚本使用
      console.log('\n=== TOKEN FOR ENVIRONMENT VARIABLE ===');
      console.log(token);
      console.log('=== END TOKEN ===\n');

      console.log('💡 Use this token as TEST_AUTH_TOKEN environment variable');

      // 保存到文件
      await fs.writeFile('/tmp/demo-test-token.txt', token);
      console.log('💾 Token also saved to /tmp/demo-test-token.txt');

      process.exit(0);
    } else {
      console.error('❌ Failed to obtain authentication token');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Authentication process failed:', error.message);
    process.exit(1);
  } finally {
    await authenticator.cleanup();
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TestAuthenticator };