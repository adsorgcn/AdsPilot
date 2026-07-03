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
    // 1. 测试连接
    console.log('✅ 测试数据库连接...');
    const { data, error } = await supabase
      .from('auth.users')
      .select('count(*)')
      .limit(1);

    if (error) {
      console.error('❌ 数据库连接失败:', error);
      return;
    }
    console.log('✅ 数据库连接正常\n');

    // 2. 获取数据库表大小（通过查询系统表）
    console.log('📊 数据库表大小统计:');
    const { data: tableSizes, error: tableSizeError } = await supabase
      .rpc('get_table_sizes');

    if (tableSizeError) {
      console.log('⚠️  无法获取表大小信息（需要创建系统函数）');
    } else {
      console.table(tableSizes);
    }

    // 3. 分析用户数据
    console.log('\n👥 用户统计分析:');

    // 总用户数
    const { count: totalUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true });

    console.log(`总用户数: ${totalUsers}`);

    // 最近30天活跃用户
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: activeUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .gte('last_sign_in_at', thirtyDaysAgo.toISOString());

    console.log(`近30天活跃用户: ${activeUsers}`);

    // 邮箱已验证用户
    const { count: verifiedUsers } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true })
      .not('email_confirmed_at', 'is', null);

    console.log(`邮箱已验证用户: ${verifiedUsers}`);

    // 4. 分析认证方式
    console.log('\n🔐 认证方式分布:');
    const { data: identities, error: identitiesError } = await supabase
      .from('auth.identities')
      .select('provider')
      .limit(1000);

    if (!identitiesError && identities) {
      const providerCounts = identities.reduce((acc, identity) => {
        acc[identity.provider] = (acc[identity.provider] || 0) + 1;
        return acc;
      }, {});

      console.table(Object.entries(providerCounts).map(([provider, count]) => ({
        provider,
        count,
        percentage: ((count / totalUsers) * 100).toFixed(2) + '%'
      })));
    }

    // 5. 检查是否存在user_profiles视图
    console.log('\n👁️  检查user_profiles视图:');
    const { data: viewCheck, error: viewError } = await supabase
      .from('user_profiles')
      .select('count(*)')
      .limit(1);

    if (viewError) {
      console.log('⚠️  user_profiles视图不存在或无权限访问');
    } else {
      console.log('✅ user_profiles视图存在且可访问');
    }

    // 6. 获取数据库版本信息
    console.log('\n🗄️  数据库信息:');
    const { data: dbInfo } = await supabase
      .rpc('get_database_info')
      .catch(() => null);

    if (dbInfo) {
      console.table(dbInfo);
    } else {
      console.log('⚠️  无法获取数据库详细信息');
    }

    // 7. 检查表结构
    console.log('\n📋 auth.users表结构分析:');
    const { data: userSample, error: sampleError } = await supabase
      .from('auth.users')
      .select('id, email, created_at, last_sign_in_at, email_confirmed_at, raw_user_meta_data')
      .limit(1);

    if (!sampleError && userSample && userSample.length > 0) {
      const sample = userSample[0];
      console.log('字段示例:');
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        const type = typeof value;
        const preview = value && typeof value === 'object' ? JSON.stringify(value).substring(0, 100) + '...' : String(value);
        console.log(`  ${key}: ${type} = ${preview}`);
      });
    }

  } catch (error) {
    console.error('❌ 分析过程中出错:', error);
  }
}

// 创建必要的数据库函数
async function createDatabaseFunctions() {
  console.log('🛠️  创建数据库分析函数...');

  try {
    // 创建获取表大小的函数
    const { error: func1Error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION get_table_sizes()
        RETURNS TABLE (
          schemaname TEXT,
          tablename TEXT,
          size TEXT,
          size_bytes BIGINT
        )
        LANGUAGE sql
        SECURITY DEFINER
        AS $$
        SELECT
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname IN ('auth', 'public')
        ORDER BY size_bytes DESC;
        $$;
      `
    });

    if (func1Error) {
      console.log('⚠️  创建get_table_sizes函数失败（可能需要SQL执行权限）:', func1Error.message);
    } else {
      console.log('✅ get_table_sizes函数创建成功');
    }

    // 创建获取数据库信息的函数
    const { error: func2Error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION get_database_info()
        RETURNS TABLE (
          metric TEXT,
          value TEXT
        )
        LANGUAGE sql
        SECURITY DEFINER
        AS $$
        SELECT
            'Database Size' as metric,
            pg_size_pretty(pg_database_size(current_database())) as value
        UNION ALL
        SELECT
            'Total Tables',
            COUNT(*)::TEXT
        FROM pg_tables
        WHERE schemaname IN ('auth', 'public')
        UNION ALL
        SELECT
            'Total Indexes',
            COUNT(*)::TEXT
        FROM pg_indexes
        WHERE schemaname IN ('auth', 'public')
        UNION ALL
        SELECT
            'PostgreSQL Version',
            version();
        $$;
      `
    });

    if (func2Error) {
      console.log('⚠️  创建get_database_info函数失败:', func2Error.message);
    } else {
      console.log('✅ get_database_info函数创建成功');
    }

  } catch (error) {
    console.log('⚠️  无法创建函数（可能需要直接SQL执行权限）');
  }
}

// 主函数
async function main() {
  const command = process.argv[2] || 'analyze';

  switch (command) {
    case 'analyze':
      await analyzeDatabase();
      break;
    case 'create-functions':
      await createDatabaseFunctions();
      await analyzeDatabase(); // 创建函数后重新分析
      break;
    case 'help':
      console.log('用法: node supabase-client.js [命令]');
      console.log('命令:');
      console.log('  analyze        - 分析数据库状态');
      console.log('  create-functions - 创建数据库分析函数');
      console.log('  help           - 显示此帮助');
      break;
    default:
      console.log('❌ 未知命令:', command);
      console.log('使用 "help" 查看可用命令');
  }
}

// 运行主函数
main().catch(console.error);