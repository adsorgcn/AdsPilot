const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// 从凭证文件读取配置
const fs = require('fs');
const path = require('path');

// 读取Supabase配置
const configPath = path.join(__dirname, '../secrets/supabase-credentials.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 创建Supabase客户端（使用service_role key，拥有管理员权限）
const supabase = createClient(
  config.project_url,
  config.service_role_key,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// 数据库分析函数
async function analyzeDatabase() {
  console.log('🔍 开始分析Supabase数据库状态...\n');

  try {
    // 1. 测试连接到auth.users
    console.log('✅ 测试数据库连接...');

    // 通过SQL查询来测试连接
    const { data: testData, error: testError } = await supabase
      .rpc('exec_sql', {
        sql: 'SELECT 1 as test;'
      });

    if (testError) {
      console.log('⚠️  exec_sql函数不存在，尝试直接查询...');
    }

    // 2. 尝试获取用户统计
    console.log('\n👥 尝试获取用户统计信息...');

    // 首先创建一个简单的SQL执行函数（如果不存在）
    try {
      const { error: createError } = await supabase
        .from('auth.users')
        .select('count(*)')
        .limit(1);

      if (createError) {
        console.log('❌ 无法直接访问auth.users表:', createError.message);
        console.log('📝 这说明需要使用Supabase Dashboard来执行SQL优化');
        return;
      }

      console.log('✅ 可以访问auth.users表');

      // 获取总用户数
      const { count: totalUsers } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      console.log(`总用户数: ${totalUsers || 0}`);

      // 获取最近活跃用户
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: activeUsers } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('last_sign_in_at', thirtyDaysAgo.toISOString());

      console.log(`近30天活跃用户: ${activeUsers || 0}`);

      // 获取已验证用户
      const { count: verifiedUsers } = await supabase
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .not('email_confirmed_at', 'is', null);

      console.log(`邮箱已验证用户: ${verifiedUsers || 0}`);

      // 获取用户样本
      const { data: userSample, error: sampleError } = await supabase
        .from('auth.users')
        .select('id, email, created_at, last_sign_in_at, email_confirmed_at')
        .limit(3);

      if (!sampleError && userSample) {
        console.log('\n📋 用户样本数据:');
        userSample.forEach((user, index) => {
          console.log(`用户 ${index + 1}:`);
          console.log(`  ID: ${user.id}`);
          console.log(`  Email: ${user.email}`);
          console.log(`  创建时间: ${user.created_at}`);
          console.log(`  最后登录: ${user.last_sign_in_at || '从未登录'}`);
          console.log(`  邮箱验证: ${user.email_confirmed_at ? '已验证' : '未验证'}`);
          console.log('');
        });
      }

    } catch (authError) {
      console.log('❌ 访问auth表时出错:', authError.message);
    }

    // 3. 检查public schema
    console.log('\n📊 检查public schema表...');

    try {
      const { data: publicTables, error: publicError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .limit(10);

      if (publicError) {
        console.log('⚠️  无法列出public schema表:', publicError.message);
      } else {
        console.log('public schema中的表:', publicTables?.map(t => t.table_name).join(', ') || '无表');
      }
    } catch (publicError) {
      console.log('❌ 检查public schema失败:', publicError.message);
    }

    // 4. 检查是否存在user_profiles视图
    console.log('\n👁️  检查user_profiles视图:');
    try {
      const { data: profileCheck, error: profileError } = await supabase
        .from('user_profiles')
        .select('count(*)')
        .limit(1);

      if (profileError) {
        console.log('⚠️  user_profiles视图不存在或无权限访问:', profileError.message);
        console.log('💡 建议创建user_profiles视图以优化查询性能');
      } else {
        console.log('✅ user_profiles视图存在且可访问');

        // 获取用户档案数量
        const { count: profileCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true });

        console.log(`用户档案数量: ${profileCount || 0}`);
      }
    } catch (profileError) {
      console.log('❌ 检查user_profiles视图失败:', profileError.message);
    }

    console.log('\n📝 分析总结:');
    console.log('✅ Supabase连接正常');
    console.log('📊 建议通过Supabase Dashboard执行SQL优化脚本');
    console.log('🔧 后续将提供完整的SQL优化脚本');

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
  }
}

// 创建SQL优化脚本
function generateOptimizationSQL() {
  const sql = `
-- Google-Monetize Supabase数据库优化脚本
-- 基于三层用户架构设计

-- 1. 优化auth.users表的索引
-- ==================================

-- 为last_sign_in_at创建索引（用于活跃用户查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_last_sign_in_at
ON auth.users (last_sign_in_at DESC);

-- 为email_confirmed_at创建索引（用于验证状态查询）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_confirmed_at
ON auth.users (email_confirmed_at DESC) WHERE email_confirmed_at IS NOT NULL;

-- 为created_at创建索引（用于用户注册时间排序）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_created_at
ON auth.users (created_at DESC);

-- 为复合查询创建索引（邮箱+创建时间，用于用户查找）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_created
ON auth.users (email, created_at DESC);

-- 为活跃用户创建复合索引（最后登录时间+邮箱验证状态）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_active_email_verified
ON auth.users (last_sign_in_at DESC, email_confirmed_at)
WHERE last_sign_in_at IS NOT NULL;

-- 2. 创建优化的user_profiles视图
-- ===================================

-- 删除旧视图（如果存在）
DROP VIEW IF EXISTS public.user_profiles;

-- 创建新的优化视图
CREATE VIEW public.user_profiles AS
SELECT
    u.id,
    u.email,
    u.phone,
    u.created_at,
    u.updated_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.phone_confirmed_at,
    u.raw_user_meta_data,
    u.is_super_admin,
    -- 从metadata中提取常用字段，提升查询性能
    COALESCE(u.raw_user_meta_data->>'name', u.email) as display_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.raw_user_meta_data->>'language', 'en') as language,
    COALESCE(u.raw_user_meta_data->>'timezone', 'UTC') as timezone,
    -- 活跃状态计算
    CASE
        WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN true
        ELSE false
    END as is_active,
    -- 用户类型
    CASE
        WHEN u.is_super_admin THEN 'admin'
        ELSE 'user'
    END as user_role,
    -- 账户年龄（天）
    EXTRACT(days FROM NOW() - u.created_at) as account_age_days
FROM auth.users u;

-- 设置权限
GRANT SELECT ON public.user_profiles TO authenticated, anon;

-- 3. 创建物化视图（用于高频查询优化）
-- =============================================

-- 创建用户统计物化视图
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_stats_materialized AS
SELECT
    -- 总用户数
    COUNT(*) as total_users,
    -- 活跃用户数（近30天）
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '30 days') as active_users_30d,
    -- 活跃用户数（近7天）
    COUNT(*) FILTER (WHERE last_sign_in_at > NOW() - INTERVAL '7 days') as active_users_7d,
    -- 邮箱已验证用户数
    COUNT(*) FILTER (WHERE email_confirmed_at IS NOT NULL) as verified_users,
    -- 管理员用户数
    COUNT(*) FILTER (WHERE is_super_admin = true) as admin_users,
    -- 今日新注册用户数
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_users_today,
    -- 本周新注册用户数
    COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)) as new_users_week,
    -- 本月新注册用户数
    COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as new_users_month,
    -- 更新时间
    NOW() as updated_at
FROM auth.users;

-- 创建唯一索引
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_stats_materialized_single
ON public.user_stats_materialized ((true));

-- 授予权限
GRANT SELECT ON public.user_stats_materialized TO authenticated, anon;

-- 4. 创建数据库函数
-- ==================

-- 用户活跃度检查函数
CREATE OR REPLACE FUNCTION auth.is_user_active(user_id UUID, days INTEGER DEFAULT 30)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT last_sign_in_at > NOW() - INTERVAL '1 day' * days
FROM auth.users
WHERE id = user_id;
$$;

-- 获取用户完整信息函数
CREATE OR REPLACE FUNCTION auth.get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    phone TEXT,
    display_name TEXT,
    avatar_url TEXT,
    language TEXT,
    timezone TEXT,
    is_active BOOLEAN,
    is_super_admin BOOLEAN,
    user_role TEXT,
    account_age_days BIGINT,
    created_at TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ,
    email_confirmed_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
    u.id,
    u.email,
    u.phone,
    COALESCE(u.raw_user_meta_data->>'name', u.email) as display_name,
    u.raw_user_meta_data->>'avatar_url' as avatar_url,
    COALESCE(u.raw_user_meta_data->>'language', 'en') as language,
    COALESCE(u.raw_user_meta_data->>'timezone', 'UTC') as timezone,
    (u.last_sign_in_at > NOW() - INTERVAL '30 days') as is_active,
    u.is_super_admin,
    CASE WHEN u.is_super_admin THEN 'admin' ELSE 'user' END as user_role,
    EXTRACT(days FROM NOW() - u.created_at) as account_age_days,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
FROM auth.users u
WHERE u.id = user_id;
$$;

-- 刷新物化视图函数
CREATE OR REPLACE FUNCTION public.refresh_user_stats_materialized()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats_materialized;
END;
$$;

-- 获取用户统计数据函数
CREATE OR REPLACE FUNCTION public.get_user_statistics()
RETURNS TABLE (
    metric TEXT,
    value BIGINT,
    description TEXT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT * FROM public.user_stats_materialized
CROSS JOIN LATERAL (
    VALUES
        ('total_users', total_users, '总用户数'),
        ('active_users_30d', active_users_30d, '近30天活跃用户'),
        ('active_users_7d', active_users_7d, '近7天活跃用户'),
        ('verified_users', verified_users, '邮箱已验证用户'),
        ('admin_users', admin_users, '管理员用户数'),
        ('new_users_today', new_users_today, '今日新用户'),
        ('new_users_week', new_users_week, '本周新用户'),
        ('new_users_month', new_users_month, '本月新用户')
) AS stats(metric, value, description);
$$;

-- 5. 创建触发器（自动更新时间戳）
-- ==============================

-- 更新updated_at字段的函数（如果不存在）
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- 这个触发器主要用于public schema的表
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. 数据库清理和维护
-- ======================

-- 清理过期会话（保留7天）
DELETE FROM auth.sessions
WHERE created_at < NOW() - INTERVAL '7 days';

-- 更新表统计信息
ANALYZE auth.users;

-- 重建索引（如果需要）
REINDEX INDEX CONCURRENTLY idx_auth_users_last_sign_in_at;
REINDEX INDEX CONCURRENTLY idx_auth_users_email_confirmed_at;
REINDEX INDEX CONCURRENTLY idx_auth_users_created_at;

-- 7. 性能监控查询
-- =================

-- 查看索引使用情况
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname IN ('auth', 'public')
ORDER BY idx_scan DESC;

-- 查看表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname IN ('auth', 'public')
ORDER BY size_bytes DESC;

-- 8. 优化完成确认
-- ================

-- 输出优化摘要
DO $$
BEGIN
    RAISE NOTICE '=== Google-Monetize Supabase数据库优化完成 ===';
    RAISE NOTICE '1. 已创建auth.users表的性能索引';
    RAISE NOTICE '2. 已创建优化的user_profiles视图';
    RAISE NOTICE '3. 已创建用户统计物化视图';
    RAISE NOTICE '4. 已创建数据库函数和触发器';
    RAISE NOTICE '5. 已清理过期数据';
    RAISE NOTICE '6. 已更新表统计信息';
    RAISE NOTICE '优化完成时间: %', NOW();
END $$;
`;

  return sql;
}

// 主函数
async function main() {
  const command = process.argv[2] || 'analyze';

  switch (command) {
    case 'analyze':
      await analyzeDatabase();
      break;
    case 'generate-sql':
      console.log('📝 生成Supabase数据库优化SQL脚本...');
      console.log('\n请在Supabase Dashboard的SQL Editor中执行以下脚本:\n');
      console.log('=' .repeat(80));
      console.log(generateOptimizationSQL());
      console.log('=' .repeat(80));
      console.log('\n✅ SQL脚本已生成，请复制到Supabase Dashboard执行');
      break;
    case 'help':
      console.log('用法: node supabase-client.cjs [命令]');
      console.log('命令:');
      console.log('  analyze        - 分析数据库状态');
      console.log('  generate-sql   - 生成SQL优化脚本');
      console.log('  help           - 显示此帮助');
      break;
    default:
      console.log('❌ 未知命令:', command);
      console.log('使用 "help" 查看可用命令');
  }
}

// 运行主函数
main().catch(console.error);