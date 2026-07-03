#!/usr/bin/env node

/**
 * 为Demo Data测试创建临时的认证绕过方案
 * 1. 临时禁用Demo端点的认证
 * 2. 或创建测试专用的认证端点
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

class AuthBypassHandler {
  constructor() {
    this.baseUrl = 'https://www.urlchecker.dev';
    this.apiBaseUrl = 'https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app';
  }

  async createTestUserSession() {
    /**
     * 创建测试用户session的方法：
     * 1. 通过前端登录获取真实的session
     * 2. 提取并保存cookies
     * 3. 使用cookies进行API调用
     */
    console.log('🔐 Creating test user session via frontend...');

    const browser = await chromium.launch({ headless: false }); // 使用可视化模式便于调试
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // 访问登录页面
      await page.goto(`${this.baseUrl}/auth`);
      await page.waitForTimeout(3000);

      // 尝试找到并填写登录表单
      console.log('📝 Looking for login form...');

      const loginForm = await page.locator('form').first();
      if (await loginForm.isVisible()) {
        await loginForm.fill({
          email: 'test@urlchecker.dev',
          password: 'TestPassword123!'
        });

        // 提交表单
        await loginForm.locator('button[type="submit"]').first().click();
        console.log('🚀 Login form submitted...');

        // 等待登录完成
        await page.waitForTimeout(5000);

        // 获取所有cookies
        const cookies = await context.cookies();
        console.log('🍪 Cookies extracted:', cookies.length);

        // 保存cookies
        await fs.writeFile('/tmp/test-cookies.json', JSON.stringify(cookies, null, 2));

        // 尝试从localStorage获取token
        const localStorageData = await page.evaluate(() => {
          return {
            supabase_auth: localStorage.getItem('supabase.auth.token'),
            access_token: localStorage.getItem('access_token'),
            all_keys: Object.keys(localStorage)
          };
        });

        console.log('💾 LocalStorage data:', Object.keys(localStorageData));
        await fs.writeFile('/tmp/test-localstorage.json', JSON.stringify(localStorageData, null, 2));

        // 截图
        await page.screenshot({ path: '/tmp/login-result.png', fullPage: true });

        return { cookies, localStorageData };
      } else {
        console.log('❌ Login form not found');
        return null;
      }
    } catch (error) {
      console.log('❌ Error during login:', error.message);
      return null;
    } finally {
      await browser.close();
    }
  }

  async testDirectAPIWithCookies(cookies) {
    /**
     * 使用cookies直接测试API
     */
    console.log('🧪 Testing API with cookies...');

    try {
      // 转换cookies为cookie字符串
      const cookieString = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');

      const response = await fetch(`${this.apiBaseUrl}/api/v1/demo/status`, {
        headers: {
          'Cookie': cookieString,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 API Response Status:', response.status);
      const text = await response.text();
      console.log('📄 API Response Body:', text);

      return response.ok;
    } catch (error) {
      console.log('❌ API test failed:', error.message);
      return false;
    }
  }

  async requestTemporaryAuthEndpoint() {
    /**
     * 请求创建临时认证端点
     * 这个方法可以用来向开发者建议创建测试专用的端点
     */
    console.log('📝 Suggestion: Create temporary auth bypass for testing');
    console.log('');
    console.log('Add this to your offer service for testing:');
    console.log(`
// 在 services/offer/cmd/server/main.go 中添加
protectedRoutes.HandleFunc("/v1/demo/status/test", func(w http.ResponseWriter, r *http.Request) {
    // 临时测试端点，无需认证
    userID := "test-user-12345"

    hasReal, err := h.hasRealOffers(r.Context(), userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    demoCount, realCount, err := h.getOfferCounts(r.Context(), userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    response := DemoStatusResponse{
        Modules: map[string]DemoModuleStatus{
            "offers": {
                HasRealData: hasReal,
                DemoCount:   demoCount,
                RealCount:   realCount,
            },
        },
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(response)
})
    `);
  }

  async createDemoDataTestScript() {
    /**
     * 创建一个不依赖认证的Demo Data测试脚本
     * 通过直接操作数据库来测试Demo Data功能
     */
    console.log('📝 Creating database-level Demo Data test...');

    const testScript = `
// 直接测试Demo Data功能的SQL脚本
// 可以在Cloud Shell或直接连接数据库运行

-- 1. 检查Demo数据表结构
\\d offers

-- 2. 创建测试用户
INSERT INTO users (id, email, created_at)
VALUES ('test-user-12345', 'test@urlchecker.dev', NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. 检查现有Demo数据
SELECT COUNT(*) FROM offers WHERE user_id = 'test-user-12345' AND is_demo = TRUE;

-- 4. 手动创建Demo数据
INSERT INTO offers (
    id, user_id, name, original_url, status, evaluation_status,
    domain, impressions, clicks, ctr, total_revenue, roas,
    siterank_score, is_demo, demo_category, created_at, updated_at
) VALUES
    ('demo-offer-1', 'test-user-12345', 'Nike Summer Sale Campaign', 'https://demo.example.com/nike', 'scaling', 'evaluated',
     'demo.example.com', 1500000, 15000, 0.08, 250000, 4.2, 92, TRUE, 'success', NOW(), NOW()),
    ('demo-offer-2', 'test-user-12345', 'Amazon Prime Day Electronics', 'https://demo.example.com/amazon', 'scaling', 'evaluated',
     'demo.example.com', 1250000, 12500, 0.076, 180000, 3.8, 88, TRUE, 'success', NOW(), NOW());

-- 5. 验证Demo数据创建结果
SELECT * FROM offers WHERE user_id = 'test-user-12345' AND is_demo = TRUE;

-- 6. 清理测试数据 (可选)
-- DELETE FROM offers WHERE user_id = 'test-user-12345' AND is_demo = TRUE;
-- DELETE FROM users WHERE id = 'test-user-12345';
    `;

    await fs.writeFile('/tmp/demo-data-db-test.sql', testScript);
    console.log('💾 Database test script saved to /tmp/demo-data-db-test.sql');
  }
}

async function main() {
  const handler = new AuthBypassHandler();

  console.log('🎯 Demo Data Authentication Bypass Solutions');
  console.log('==========================================');

  // 方案1: 尝试通过前端登录获取真实session
  console.log('\n1️⃣ Attempting frontend login...');
  const sessionData = await handler.createTestUserSession();

  if (sessionData && sessionData.cookies) {
    console.log('✅ Frontend session created successfully');

    // 测试API调用
    const apiTestResult = await handler.testDirectAPIWithCookies(sessionData.cookies);
    if (apiTestResult) {
      console.log('✅ API test with cookies successful');
      return;
    }
  }

  // 方案2: 建议创建临时认证端点
  console.log('\n2️⃣ Requesting temporary auth endpoint...');
  await handler.requestTemporaryAuthEndpoint();

  // 方案3: 创建数据库级测试
  console.log('\n3️⃣ Creating database-level test...');
  await handler.createDemoDataTestScript();

  console.log('\n🎯 Summary of solutions:');
  console.log('1. ✅ Frontend login approach - Attempted');
  console.log('2. 🔧 Temporary auth endpoint - Code provided');
  console.log('3. 🔧 Database-level testing - Script created');
  console.log('');
  console.log('💡 Recommended next steps:');
  console.log('- Add temporary auth endpoint for testing');
  console.log('- Run database test script to verify Demo Data logic');
  console.log('- Use frontend session if successful');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AuthBypassHandler };