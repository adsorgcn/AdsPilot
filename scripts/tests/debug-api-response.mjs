#!/usr/bin/env node

/**
 * 调试API响应 - 使用程序化登录获取Token并测试API
 */

const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';

async function debugAPIResponses() {
  console.log('\n🔍 调试API响应工具');
  console.log(`📍 测试环境: ${BASE_URL}\n`);

  try {
    // Step 1: 创建测试Session
    console.log('Step 1: 获取测试Token...');
    const sessionResponse = await fetch(`${BASE_URL}/api/test/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-user@autoads.dev',
        role: 'user',
      }),
    });

    if (!sessionResponse.ok) {
      throw new Error(`创建Session失败: ${sessionResponse.status}`);
    }

    const sessionData = await sessionResponse.json();
    const token = sessionData.access_token;

    if (!token) {
      throw new Error('未获取到access_token');
    }

    console.log(`✅ Token已获取 (长度: ${token.length})`);
    console.log(`   User ID: ${sessionData.user_id}`);
    console.log(`   Email: ${sessionData.email}\n`);

    // Step 2: 测试Billing API
    console.log('Step 2: 测试Billing API...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const billingEndpoints = [
      { name: '订阅信息', url: '/api/v1/billing/subscriptions/me' },
      { name: 'Token余额', url: '/api/v1/billing/tokens/balance' },
      { name: 'Token交易', url: '/api/v1/billing/tokens/transactions' },
      { name: 'Token使用', url: '/api/v1/billing/tokens/usage' },
    ];

    for (const endpoint of billingEndpoints) {
      console.log(`🔎 ${endpoint.name}: ${endpoint.url}`);
      try {
        const response = await fetch(`${BASE_URL}${endpoint.url}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`   状态: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`   响应: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        } else {
          const text = await response.text();
          console.log(`   错误: ${text.substring(0, 200)}`);
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
      }
      console.log('');
    }

    // Step 3: 测试AdsCenter API
    console.log('Step 3: 测试AdsCenter API...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const adsCenterEndpoints = [
      { name: '广告账户', url: '/api/v1/adscenter/accounts' },
    ];

    for (const endpoint of adsCenterEndpoints) {
      console.log(`🔎 ${endpoint.name}: ${endpoint.url}`);
      try {
        const response = await fetch(`${BASE_URL}${endpoint.url}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`   状态: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`   响应: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        } else {
          const text = await response.text();
          console.log(`   错误: ${text.substring(0, 200)}`);
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
      }
      console.log('');
    }

    // Step 4: 测试Console API
    console.log('Step 4: 测试Console API...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const consoleEndpoints = [
      { name: '任务列表', url: '/api/v1/console/tasks' },
      { name: '任务统计', url: '/api/v1/console/tasks/stats' },
    ];

    for (const endpoint of consoleEndpoints) {
      console.log(`🔎 ${endpoint.name}: ${endpoint.url}`);
      try {
        const response = await fetch(`${BASE_URL}${endpoint.url}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        console.log(`   状态: ${response.status} ${response.statusText}`);

        if (response.ok) {
          const data = await response.json();
          console.log(`   响应: ${JSON.stringify(data, null, 2).substring(0, 200)}...`);
        } else {
          const text = await response.text();
          console.log(`   错误: ${text.substring(0, 200)}`);
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
      }
      console.log('');
    }

    console.log('✅ API调试完成\n');
  } catch (error) {
    console.error(`\n❌ 调试失败: ${error.message}\n`);
    process.exit(1);
  }
}

debugAPIResponses();
