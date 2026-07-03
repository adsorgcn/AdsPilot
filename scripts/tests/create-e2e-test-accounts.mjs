#!/usr/bin/env node

/**
 * 创建E2E测试账号
 * 用于修复页面混淆问题后的E2E测试验证
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ 请设置 SUPABASE_SERVICE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createE2ETestAccounts() {
  console.log('🚀 开始创建E2E测试账号...\n');

  const accounts = [
    {
      email: 'test-user-e2e@autoads.dev',
      role: 'user',
      displayName: 'E2E Test User',
      tokens: 10000,
      offers: 50,
      tasks: 25,
      adsAccounts: 3,
      subscription: 'pro'
    },
    {
      email: 'test-admin-e2e@autoads.dev',
      role: 'admin',
      displayName: 'E2E Test Admin',
      tokens: 50000,
      offers: 100,
      tasks: 50,
      adsAccounts: 10,
      subscription: 'elite'
    }
  ];

  for (const account of accounts) {
    try {
      console.log(`📧 创建测试账号: ${account.email}`);

      // 1. 先检查用户是否存在于 auth.users 表
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(account.email);

      let userId;
      if (authError || !authUser.user) {
        // 如果用户不存在，需要手动注册（在实际环境中需要用户通过邮箱验证）
        console.log(`   ⚠️  用户不存在，将使用模拟ID创建数据: ${account.email}`);
        userId = `user_${account.email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
      } else {
        userId = authUser.user.id;
        console.log(`   ✓ 用户ID: ${userId}`);

        // 2. 更新用户的 app_metadata.role
        if (account.role === 'admin') {
          await supabase.auth.admin.updateUserById(userId, {
            app_metadata: {
              role: 'super-admin',
              subscription_tier: account.subscription
            }
          });
        }
      }

      // 3. 创建Token余额 (使用 billing 服务的表)
      const { error: tokenError } = await supabase
        .from('UserToken')
        .upsert({
          UserID: userId,
          Balance: account.tokens,
          EarnedTotal: account.tokens,
          UpdatedAt: new Date().toISOString(),
          CreatedAt: new Date().toISOString()
        }, { onConflict: 'UserID' });

      if (tokenError) {
        console.error(`❌ Token创建失败: ${tokenError.message}`);
      } else {
        console.log(`   ✓ Token余额: ${account.tokens}`);
      }

      // 3. 创建Offer数据
      const offers = [];
      for (let i = 1; i <= account.offers; i++) {
        offers.push({
          user_id: userId,
          name: `E2E Test Offer ${i}`,
          url: `https://example-${i}.com/offer-${i}`,
          country: ['US', 'UK', 'CA', 'AU', 'DE'][i % 5],
          category: ['Gaming', 'E-commerce', 'Finance', 'Health', 'Education'][i % 5],
          status: ['pending', 'ready', 'active', 'completed'][i % 4],
          budget_min: 100 * i,
          budget_max: 1000 * i,
          created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
        });
      }

      if (offers.length > 0) {
        const { error: offersError } = await supabase
          .from('offers')
          .upsert(offers);

        if (offersError) {
          console.error(`❌ Offers创建失败: ${offersError.message}`);
        } else {
          console.log(`   ✓ Offers: ${offers.length}个`);
        }
      }

      // 4. 创建Task数据
      const tasks = [];
      for (let i = 1; i <= account.tasks; i++) {
        tasks.push({
          user_id: userId,
          name: `E2E Test Task ${i}`,
          type: ['evaluation', 'bulk_open', 'analysis'][i % 3],
          status: ['pending', 'running', 'completed', 'failed'][i % 4],
          offers_count: Math.floor(account.offers / account.tasks),
          created_at: new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString()
        });
      }

      if (tasks.length > 0) {
        const { error: tasksError } = await supabase
          .from('tasks')
          .upsert(tasks);

        if (tasksError) {
          console.error(`❌ Tasks创建失败: ${tasksError.message}`);
        } else {
          console.log(`   ✓ Tasks: ${tasks.length}个`);
        }
      }

      // 5. 创建广告账户数据
      const adsAccounts = [];
      for (let i = 1; i <= account.adsAccounts; i++) {
        adsAccounts.push({
          user_id: userId,
          platform: ['Google Ads', 'Facebook Ads', 'TikTok Ads'][i % 3],
          account_id: `acc_${i}_${Date.now()}`,
          account_name: `E2E Test Account ${i}`,
          status: 'connected',
          currency: 'USD',
          timezone: 'America/New_York',
          created_at: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      }

      if (adsAccounts.length > 0) {
        const { error: adsError } = await supabase
          .from('user_ads_connections')
          .upsert(adsAccounts);

        if (adsError) {
          console.error(`❌ 广告账户创建失败: ${adsError.message}`);
        } else {
          console.log(`   ✓ 广告账户: ${adsAccounts.length}个`);
        }
      }

      console.log(`✅ 测试账号创建完成: ${account.email}\n`);

    } catch (error) {
      console.error(`❌ 创建账号失败: ${error.message}\n`);
    }
  }

  console.log('🎉 所有E2E测试账号创建完成！');
  console.log('\n📋 账号信息:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('普通用户: test-user-e2e@autoads.dev');
  console.log('管理员: test-admin-e2e@autoads.dev');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

async function verifyAccounts() {
  console.log('\n🔍 验证账号创建结果...\n');

  const accounts = ['test-user-e2e@autoads.dev', 'test-admin-e2e@autoads.dev'];

  for (const email of accounts) {
    console.log(`📧 验证账号: ${email}`);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, subscription_tier')
      .eq('email', email)
      .single();

    if (error) {
      console.error(`❌ 查询失败: ${error.message}`);
      continue;
    }

    const { data: tokens } = await supabase
      .from('user_tokens')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    const { count: offersCount } = await supabase
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: adsCount } = await supabase
      .from('user_ads_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    console.log(`   ✓ 用户ID: ${user.id}`);
    console.log(`   ✓ 角色: ${user.role}`);
    console.log(`   ✓ 订阅: ${user.subscription_tier}`);
    console.log(`   ✓ Token余额: ${tokens?.balance || 0}`);
    console.log(`   ✓ Offers: ${offersCount || 0}个`);
    console.log(`   ✓ Tasks: ${tasksCount || 0}个`);
    console.log(`   ✓ 广告账户: ${adsCount || 0}个`);
    console.log('');
  }
}

async function main() {
  try {
    await createE2ETestAccounts();
    await verifyAccounts();

    console.log('🚀 E2E测试账号创建完成！');
    console.log('💡 现在可以使用这些账号进行E2E测试:');
    console.log('   - 普通用户测试: test-user-e2e@autoads.dev');
    console.log('   - 管理员测试: test-admin-e2e@autoads.dev');

  } catch (error) {
    console.error('❌ 创建失败:', error.message);
    process.exit(1);
  }
}

main();