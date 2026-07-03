#!/usr/bin/env node

/**
 * API级别的Offer评估测试
 *
 * 直接通过API进行测试，验证：
 * 1. Offer创建
 * 2. 基础评估（1 token）
 * 3. AI评估（3 tokens）
 * 4. Token消耗验证
 * 5. 评估结果验证
 */

import fetch from 'node-fetch';

// 测试环境配置
const BASE_URL = process.env.PREVIEW_BASE || 'https://www.urlchecker.dev';
const API_URL = `${BASE_URL}/api`;

// 测试数据
const TEST_OFFER = {
  landingPageUrl: 'https://pboost.me/ZDO2Bdek',
  country: 'US',
  category: 'Gaming',
  brandName: 'PBoost',
  title: 'PBoost Test Offer - US Market'
};

// 创建测试Session
async function createTestSession() {
  console.log('\n🔐 创建测试Session...');

  const response = await fetch(`${API_URL}/test/create-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test-user@autoads.dev',
      role: 'user'
    })
  });

  if (!response.ok) {
    throw new Error(`创建Session失败: ${response.status}`);
  }

  const data = await response.json();
  console.log(`   ✓ User ID: ${data.user_id}`);
  console.log(`   ✓ Access Token: ${data.access_token.substring(0, 20)}...`);

  return {
    userId: data.user_id,
    accessToken: data.access_token
  };
}

// 获取Token余额
async function getTokenBalance(accessToken) {
  const response = await fetch(`${API_URL}/v1/tokens/balance`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    console.log(`   ⚠️ 获取Token余额失败: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.balance || data.totalBalance || data.availableBalance;
}

// 创建Offer
async function createOffer(accessToken) {
  console.log('\n📝 创建测试Offer...');
  console.log(`   URL: ${TEST_OFFER.landingPageUrl}`);

  const response = await fetch(`${API_URL}/v1/offers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(TEST_OFFER)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`创建Offer失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`   ✓ Offer已创建: ${data.id || data.offerId || data.offer_id}`);

  return data.id || data.offerId || data.offer_id;
}

// 触发基础评估
async function triggerBasicEvaluation(accessToken, offerId) {
  console.log('\n⚙️ 触发基础评估（1 token）...');

  const response = await fetch(`${API_URL}/v1/offers/${offerId}/evaluate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enableAI: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`触发评估失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`   ✓ 评估已触发`);

  return data;
}

// 触发AI评估
async function triggerAIEvaluation(accessToken, offerId) {
  console.log('\n🤖 触发AI评估（3 tokens）...');

  const response = await fetch(`${API_URL}/v1/offers/${offerId}/evaluate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      enableAI: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`触发AI评估失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`   ✓ AI评估已触发`);

  return data;
}

// 获取评估结果
async function getEvaluationResult(accessToken, offerId, retries = 10) {
  console.log('\n🔍 查询评估结果...');

  for (let i = 0; i < retries; i++) {
    const response = await fetch(`${API_URL}/v1/offers/${offerId}/evaluations/latest`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`   → 尝试 ${i + 1}/${retries}: ${response.status}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }

    const data = await response.json();

    if (data.status === 'completed' || data.status === 'success') {
      console.log(`   ✓ 评估完成`);
      return data;
    } else if (data.status === 'failed') {
      throw new Error(`评估失败: ${data.error || 'Unknown error'}`);
    }

    console.log(`   → 尝试 ${i + 1}/${retries}: 状态 ${data.status || 'pending'}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('评估超时');
}

// 主测试流程
async function runTests() {
  console.log('🎯 API级别Offer评估测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`环境: ${BASE_URL}\n`);

  const results = { passed: 0, failed: 0 };

  try {
    // 1. 创建测试Session
    const { userId, accessToken } = await createTestSession();

    // 2. 获取初始Token余额
    const initialBalance = await getTokenBalance(accessToken);
    if (initialBalance !== null) {
      console.log(`\n💰 初始Token余额: ${initialBalance}`);
    }

    // 3. 创建Offer
    const offerId = await createOffer(accessToken);
    results.passed++;

    // 4. 触发基础评估
    try {
      await triggerBasicEvaluation(accessToken, offerId);

      // 等待评估完成
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 查询评估结果
      const basicResult = await getEvaluationResult(accessToken, offerId);
      console.log(`   ✓ 基础评估数据:`, {
        globalRank: basicResult.similarwebData?.globalRank || 'N/A',
        monthlyVisits: basicResult.similarwebData?.monthlyVisits || 'N/A'
      });

      results.passed++;
    } catch (error) {
      console.error(`   ❌ 基础评估失败: ${error.message}`);
      results.failed++;
    }

    // 5. 检查Token消耗
    const afterBasicBalance = await getTokenBalance(accessToken);
    if (afterBasicBalance !== null && initialBalance !== null) {
      const consumed = initialBalance - afterBasicBalance;
      console.log(`\n💰 基础评估后Token余额: ${afterBasicBalance} (消耗: ${consumed})`);

      if (consumed === 1) {
        console.log(`   ✓ Token消耗正确: 1 token`);
        results.passed++;
      } else {
        console.log(`   ⚠️ Token消耗异常: 期望1, 实际${consumed}`);
        results.failed++;
      }
    }

    // 6. 触发AI评估（可选，如果用户有权限）
    try {
      await triggerAIEvaluation(accessToken, offerId);

      // 等待AI评估完成
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 查询AI评估结果
      const aiResult = await getEvaluationResult(accessToken, offerId);
      console.log(`   ✓ AI评估完成`);
      console.log(`   ✓ AI评分:`, aiResult.aiScore || 'N/A');

      results.passed++;
    } catch (error) {
      console.error(`   ❌ AI评估失败: ${error.message}`);
      results.failed++;
    }

    // 7. 最终Token余额
    const finalBalance = await getTokenBalance(accessToken);
    if (finalBalance !== null && afterBasicBalance !== null) {
      const consumed = afterBasicBalance - finalBalance;
      console.log(`\n💰 最终Token余额: ${finalBalance} (AI评估消耗: ${consumed})`);

      if (consumed === 3) {
        console.log(`   ✓ AI评估Token消耗正确: 3 tokens`);
        results.passed++;
      } else {
        console.log(`   ⚠️ AI评估Token消耗异常: 期望3, 实际${consumed}`);
      }
    }

  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    results.failed++;
  }

  // 打印测试汇总
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 测试汇总');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`📈 通过率: ${Math.round(results.passed / (results.passed + results.failed) * 100)}%`);
  console.log('');

  return results.failed === 0;
}

// 执行测试
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试执行错误:', error);
  process.exit(1);
});
