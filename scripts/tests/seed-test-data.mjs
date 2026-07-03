#!/usr/bin/env node

/**
 * 测试用户种子数据生成脚本
 *
 * 功能：为测试用户创建完整的种子数据，包括：
 * - 100个Offers (不同状态、国家、分类)
 * - 50个Tasks (不同类型、状态)
 * - Token余额设置
 * - 5个广告账户连接
 *
 * 使用方法：
 * NEXT_PUBLIC_SUPABASE_URL=xxx \
 * SUPABASE_SERVICE_KEY=xxx \
 * node scripts/tests/seed-test-data.mjs
 *
 * 或使用环境变量文件：
 * node scripts/tests/seed-test-data.mjs --load-env
 */

import { createClient } from '@supabase/supabase-js';

// 测试用户配置
// Note: 只使用已存在于 Supabase Auth 的用户
const TEST_USERS = [
  {
    id: '37fd3629-a06a-47c8-b33a-31944afaa14c',
    email: 'test-user@autoads.dev',
    role: 'user',
  },
];

// Supabase客户端初始化
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 缺少环境变量:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// 生成随机数据的辅助函数
function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 清理用户的旧数据
async function cleanupUserData(userId) {
  console.log(`🧹 清理用户 ${userId} 的旧数据...`);

  // 按依赖顺序删除
  const tables = [
    'offers',
    'tasks',
    'ads_connections',
    'token_transactions',
    'token_wallets',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', userId);

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.warn(`   ⚠️ 清理 ${table} 失败: ${error.message}`);
      }
    } catch (err) {
      // 表可能不存在，忽略错误
    }
  }

  console.log('   ✅ 旧数据清理完成');
}

// 创建Offers
async function createOffers(userId, count = 100) {
  console.log(`\n📝 创建 ${count} 个Offers...`);

  const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'IN', 'CN'];
  const categories = [
    'Gaming',
    'Finance',
    'E-commerce',
    'Education',
    'Health',
    'Travel',
    'Entertainment',
    'Technology',
    'Food',
    'Fashion',
  ];
  const statuses = [
    'pending_evaluation',
    'evaluating',
    'ready_to_deploy',
    'deployed',
    'archived',
    'evaluation_failed',
  ];

  const offers = Array.from({ length: count }, (_, i) => {
    const now = Date.now();
    const createdAt = new Date(now - i * 3600000); // 每个相差1小时
    const status = randomItem(statuses);
    const hasEvaluation = ['ready_to_deploy', 'deployed', 'evaluation_failed'].includes(status);
    const category = randomItem(categories);
    const country = randomItem(countries);

    // 使用实际数据库schema: title, brand_name, landing_page_url, status, ai_score, ai_score_updated_at, metadata, created_at, updated_at
    return {
      user_id: userId,
      title: `Test Offer ${String(i + 1).padStart(3, '0')} - ${category}`,
      brand_name: `Brand ${String(i + 1).padStart(3, '0')}`,
      landing_page_url: `https://example-offer-${i + 1}.com/landing`,
      status,
      ai_score: hasEvaluation ? randomInt(60, 95) : null,
      ai_score_updated_at: hasEvaluation ? createdAt.toISOString() : null,
      metadata: JSON.stringify({
        country: country,
        category: category,
        description: `Test offer for ${category} in ${country}`,
        health_score: hasEvaluation ? randomInt(70, 100) : null,
      }),
      created_at: createdAt.toISOString(),
      updated_at: createdAt.toISOString(),
    };
  });

  // 分批插入 (每批20条)
  const batchSize = 20;
  for (let i = 0; i < offers.length; i += batchSize) {
    const batch = offers.slice(i, i + batchSize);
    const { error } = await supabase.from('offers').insert(batch);

    if (error) {
      console.error(`   ❌ 插入Offers批次 ${Math.floor(i / batchSize) + 1} 失败:`, error.message);
      throw error;
    }

    process.stdout.write(`   进度: ${Math.min(i + batchSize, offers.length)}/${offers.length}\r`);
  }

  console.log(`\n   ✅ 已创建 ${count} 个Offers`);
}

// 创建Tasks
async function createTasks(userId, count = 50) {
  console.log(`\n📋 创建 ${count} 个Tasks...`);

  const taskTypes = ['evaluation', 'export', 'import', 'analysis', 'optimization'];
  const taskStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];

  const tasks = Array.from({ length: count }, (_, i) => {
    const now = Date.now();
    const createdAt = new Date(now - i * 7200000); // 每个相差2小时
    const status = randomItem(taskStatuses);
    const type = randomItem(taskTypes);
    const offersCount = randomInt(5, 50);

    // 使用实际数据库schema: type, status, payload, result, error_message, started_at, finished_at, created_at
    return {
      user_id: userId,
      type,
      status,
      payload: JSON.stringify({
        name: `Test Task ${String(i + 1).padStart(2, '0')} - ${type}`,
        offers_count: offersCount,
        progress: status === 'completed' ? 100 :
                  status === 'running' ? randomInt(10, 90) : 0,
      }),
      result: status === 'completed' ? JSON.stringify({
        success: true,
        processed: offersCount,
        failed: 0,
      }) : null,
      error_message: status === 'failed' ? 'Test error: Simulated failure for testing' : null,
      created_at: createdAt.toISOString(),
      started_at: ['running', 'completed', 'failed'].includes(status) ?
        new Date(createdAt.getTime() + 60000).toISOString() : null,
      finished_at: ['completed', 'failed'].includes(status) ?
        new Date(createdAt.getTime() + randomInt(300000, 3600000)).toISOString() : null,
    };
  });

  const { error } = await supabase.from('tasks').insert(tasks);

  if (error) {
    console.error(`   ❌ 插入Tasks失败:`, error.message);
    throw error;
  }

  console.log(`   ✅ 已创建 ${count} 个Tasks`);
}

// 设置Token余额
async function setupTokens(userId, initialBalance = 10000) {
  console.log(`\n🪙 设置Token余额...`);

  // 使用实际数据库schema: token_wallets (user_id, balance, updated_at)
  const { error: tokenError } = await supabase
    .from('token_wallets')
    .upsert({
      user_id: userId,
      balance: initialBalance,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (tokenError) {
    console.error(`   ❌ 设置Token余额失败:`, tokenError.message);
    throw tokenError;
  }

  // 使用实际数据库schema: token_transactions (id, user_id, amount, balance_after, reason, metadata, created_at)
  let currentBalance = initialBalance;
  const transactions = Array.from({ length: 10 }, (_, i) => {
    const isCredit = i % 2 === 0;
    const amount = isCredit ? randomInt(100, 500) : -randomInt(10, 50);
    currentBalance = currentBalance - amount;

    return {
      user_id: userId,
      amount: amount,
      balance_after: currentBalance,
      reason: isCredit ? 'credit' : 'debit',
      metadata: JSON.stringify({
        description: isCredit ? '充值' : 'AI评估消耗',
        type: isCredit ? 'credit' : 'debit',
      }),
      created_at: new Date(Date.now() - (10 - i) * 86400000).toISOString(),
    };
  });

  const { error: txError } = await supabase
    .from('token_transactions')
    .insert(transactions);

  if (txError) {
    console.warn(`   ⚠️ 创建交易记录失败:`, txError.message);
  }

  console.log(`   ✅ Token余额: ${initialBalance}`);
  console.log(`   ✅ 交易记录: ${transactions.length} 条`);
}

// 创建广告账户连接
async function createAdsConnections(userId, count = 5) {
  console.log(`\n🔗 创建 ${count} 个广告账户连接...`);

  const providers = ['google_ads', 'facebook_ads', 'tiktok_ads'];
  const statuses = ['active', 'paused', 'disconnected'];

  // 使用实际数据库schema: provider, account_id, account_name, refresh_token, access_token, token_scope (text[]), status, synced_at, created_at
  const connections = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    provider: randomItem(providers),
    account_id: `test-account-${String(i + 1).padStart(3, '0')}`,
    account_name: `Test Ads Account ${i + 1}`,
    status: randomItem(statuses),
    refresh_token: 'test_refresh_' + Math.random().toString(36),
    access_token: 'test_token_' + Math.random().toString(36),
    token_scope: ['ads.read', 'ads.write'],  // Array type
    synced_at: new Date(Date.now() - i * 86400000).toISOString(),
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
  }));

  const { error } = await supabase
    .from('ads_connections')
    .insert(connections);

  if (error) {
    console.error(`   ❌ 创建广告账户连接失败:`, error.message);
    throw error;
  }

  console.log(`   ✅ 已创建 ${count} 个广告账户连接`);
}

// 为单个用户生成种子数据
async function seedUser(user) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌱 开始为用户生成种子数据`);
  console.log(`   Email: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Role: ${user.role}`);
  console.log('='.repeat(60));

  try {
    await cleanupUserData(user.id);
    await createOffers(user.id, 100);
    await createTasks(user.id, 50);
    await setupTokens(user.id, 10000);
    await createAdsConnections(user.id, 5);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ 用户 ${user.email} 的种子数据创建完成！`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`\n❌ 用户 ${user.email} 的种子数据创建失败:`, error);
    throw error;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始生成测试用户种子数据\n');
  console.log('📍 Supabase URL:', supabaseUrl);
  console.log('👥 测试用户数量:', TEST_USERS.length);
  console.log('');

  try {
    // 为所有测试用户生成数据
    for (const user of TEST_USERS) {
      await seedUser(user);
    }

    console.log('\n\n🎉 所有种子数据创建完成！');
    console.log('\n📊 数据统计:');
    console.log(`   - 用户数: ${TEST_USERS.length}`);
    console.log(`   - Offers/用户: 100`);
    console.log(`   - Tasks/用户: 50`);
    console.log(`   - Token余额/用户: 10000`);
    console.log(`   - 广告账户/用户: 5`);
    console.log(`   - 交易记录/用户: 10`);

    console.log('\n✅ 现在可以运行E2E测试了！');
    console.log('   node scripts/tests/run-all-tests.mjs');
  } catch (error) {
    console.error('\n❌ 种子数据创建失败:', error);
    process.exit(1);
  }
}

main();
