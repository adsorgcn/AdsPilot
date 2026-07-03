#!/usr/bin/env node

import { chromium } from '@playwright/test';

// 测试环境: www.urlchecker.dev (预发) | www.autoads.dev (生产)
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const TEST_EMAIL = 'test-user@autoads.dev';
// 使用API Gateway而非直接访问后端服务
const GATEWAY_URL = process.env.GATEWAY_URL || 'https://gm-gw-885pd7lz.an.gateway.dev';

async function getRealJWT() {
  console.log('\n🔍 获取真实JWT Token并测试API Gateway');
  console.log(`📍 Frontend: ${BASE_URL}`);
  console.log(`📍 API Gateway: ${GATEWAY_URL}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: 获取magic link
    console.log('Step 1: 请求magic link...');
    const magicLinkResponse = await fetch(`${BASE_URL}/api/test/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, role: 'user' }),
    });

    const magicData = await magicLinkResponse.json();
    console.log(`✅ Magic link已获取`);
    console.log(`   Action link: ${magicData.action_link?.substring(0, 100)}...\n`);

    // Step 2: 使用Playwright访问magic link完成认证
    console.log('Step 2: 使用magic link完成认证...');
    await page.goto(magicData.action_link, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // 等待重定向到dashboard
    await page.waitForURL('**/dashboard**', { timeout: 20000 });
    console.log('✅ 已重定向到dashboard');

    // 等待session完全建立
    await page.waitForTimeout(2000);
    console.log('   等待session建立...\n');

    // Step 3: 从cookies获取真实JWT
    console.log('Step 3: 提取JWT Token...');

    // 从cookies获取supabase auth tokens
    const cookies = await context.cookies();
    console.log(`   Found ${cookies.length} cookies`);

    const authCookies = cookies.filter(c =>
      c.name.includes('auth-token') || c.name.includes('sb-')
    );

    console.log(`   Auth cookies: ${authCookies.map(c => c.name).join(', ')}`);

    // 尝试从supabase auth cookie获取
    const authCookie = authCookies.find(c => c.name.includes('auth-token'));

    let jwt = null;
    if (authCookie) {
      try {
        // Supabase cookie是base64编码的JSON
        let cookieValue = authCookie.value;

        // 如果是base64-前缀，移除前缀
        if (cookieValue.startsWith('base64-')) {
          cookieValue = cookieValue.substring(7);
        }

        // Base64解码
        const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
        const authData = JSON.parse(decoded);

        jwt = authData.access_token || authData[0]?.access_token;
        console.log(`✅ 从cookie获取JWT (${jwt?.length || 0}字符)`);
      } catch (e) {
        console.log(`   Cookie解析失败: ${e.message}`);
      }
    }

    // 如果cookie中没有，尝试从localStorage
    if (!jwt) {
      console.log('   尝试从localStorage获取...');
      const storageData = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const authKey = keys.find(k => k.includes('auth-token') || k.includes('sb-'));
        if (!authKey) return null;
        return localStorage.getItem(authKey);
      });

      if (storageData) {
        try {
          const authData = JSON.parse(storageData);
          jwt = authData.access_token || authData[0]?.access_token;
          console.log(`✅ 从localStorage获取JWT (${jwt?.length || 0}字符)`);
        } catch (e) {
          console.log(`   LocalStorage解析失败: ${e.message}`);
        }
      }
    }

    if (!jwt) {
      throw new Error('未能获取JWT - 既没有在cookie也没有在localStorage中找到');
    }

    console.log(`   格式: ${jwt.split('.').length === 3 ? 'JWT (Header.Payload.Signature)' : 'Unknown'}\n`);

    // Step 4: 使用真实JWT测试API Gateway端点
    console.log('Step 4: 测试API Gateway端点...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const endpoints = [
      { name: 'Console - Tasks统计', url: `${GATEWAY_URL}/api/v1/console/tasks/stats` },
      { name: 'Console - Tasks列表', url: `${GATEWAY_URL}/api/v1/console/tasks?page=1&limit=5` },
      { name: 'Billing - Token余额', url: `${GATEWAY_URL}/api/v1/billing/tokens/balance` },
      { name: 'Notifications - 最近通知', url: `${GATEWAY_URL}/api/v1/notifications/recent` },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        const statusIcon = response.ok ? '✅' : '❌';
        console.log(`${statusIcon} ${endpoint.name}`);
        console.log(`   Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`   Response:`, JSON.stringify(data, null, 2).substring(0, 300));
        } else {
          const errorText = await response.text();
          console.log(`   Error:`, errorText);
        }
      } catch (error) {
        console.log(`❌ ${endpoint.name}`);
        console.log(`   Error: ${error.message}`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 测试完成\n');

  } catch (error) {
    console.error('\n❌ 失败:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

getRealJWT();
