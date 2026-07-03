#!/bin/bash

# Supabase数据库管理脚本
# 用于三层用户架构优化

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 加载Supabase配置
if [[ ! -f "secrets/supabase-credentials.json" ]]; then
    echo -e "${RED}错误: secrets/supabase-credentials.json 文件不存在${NC}"
    echo -e "${YELLOW}请参考 secrets/SUPABASE_ACCESS_GUIDE.md 配置凭证${NC}"
    exit 1
fi

PROJECT_REF=$(jq -r '.project_ref' secrets/supabase-credentials.json)
SERVICE_ROLE_KEY=$(jq -r '.service_role_key' secrets/supabase-credentials.json)
DB_HOST=$(jq -r '.db_host' secrets/supabase-credentials.json)
DB_PORT=$(jq -r '.db_port' secrets/supabase-credentials.json)
DB_NAME=$(jq -r '.db_name' secrets/supabase-credentials.json)
DB_USER=$(jq -r '.db_user' secrets/supabase-credentials.json)
DB_PASSWORD=$(jq -r '.db_password' secrets/supabase-credentials.json)

echo -e "${BLUE}=== Supabase数据库管理工具 ===${NC}"
echo -e "${BLUE}项目: ${PROJECT_REF}${NC}"
echo -e "${BLUE}数据库: ${DB_HOST}:${DB_PORT}/${DB_NAME}${NC}"
echo

# 函数：执行SQL查询
execute_sql() {
    local sql="$1"
    local description="$2"

    echo -e "${GREEN}执行: ${description}${NC}"
    echo -e "${YELLOW}SQL: ${sql}${NC}"

    # 使用supabase客户端连接
    local response=$(curl -s -X POST "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/execute_sql" \
        -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
        -H "Content-Type: application/json" \
        -H "apikey: ${SERVICE_ROLE_KEY}" \
        -d "{\"sql\": \"${sql}\"}")

    echo "${response}"
    echo
}

# 函数：创建SQL执行函数（如果不存在）
create_execute_sql_function() {
    echo -e "${GREEN}创建SQL执行函数...${NC}"

    local create_function_sql='
    CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
    RETURNS JSONB
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
    BEGIN
        -- 这个函数允许执行任意SQL（仅限管理员）
        -- 注意：在生产环境中需要谨慎使用
        RETURN jsonb_build_object('status', 'created', 'message', 'Function exists');
    END;
    $$;
    '

    echo "注意: SQL执行函数需要在Supabase Dashboard中手动创建"
}

# 函数：分析数据库状态
analyze_database() {
    echo -e "${BLUE}=== 分析数据库状态 ===${NC}"

    # 1. 数据库大小统计
    execute_sql "
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
    FROM pg_tables
    WHERE schemaname IN ('auth', 'public')
    ORDER BY size_bytes DESC;
    " "数据库表大小统计"

    # 2. 用户统计
    execute_sql "
    SELECT
        'Total Users' as metric,
        COUNT(*) as count
    FROM auth.users
    UNION ALL
    SELECT
        'Active Users (Last 30 days)',
        COUNT(*)
    FROM auth.users
    WHERE last_sign_in_at > NOW() - INTERVAL '30 days'
    UNION ALL
    SELECT
        'Email Verified Users',
        COUNT(*)
    FROM auth.users
    WHERE email_confirmed_at IS NOT NULL;
    " "���户活跃度统计"

    # 3. 认证方式分析
    execute_sql "
    SELECT
        provider,
        COUNT(*) as user_count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
    FROM auth.identities
    GROUP BY provider
    ORDER BY user_count DESC;
    " "认证方式分布"

    # 4. 索引分析
    execute_sql "
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
    " "索引使用情况"
}

# 函数：优化auth.users表
optimize_auth_users() {
    echo -e "${BLUE}=== 优化auth.users表 ===${NC}"

    # 1. 添加缺失的索引
    execute_sql "
    -- 为last_sign_in_at创建索引（用于活跃用户查询）
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_last_sign_in_at
    ON auth.users (last_sign_in_at DESC);

    -- 为email_verified字段创建索引
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_confirmed_at
    ON auth.users (email_confirmed_at) WHERE email_confirmed_at IS NOT NULL;

    -- 为created_at创建索引
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_created_at
    ON auth.users (created_at DESC);

    -- 为复合查询创建索引（邮箱+创建时间）
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auth_users_email_created
    ON auth.users (email, created_at DESC);
    " "创建auth.users表索引"

    # 2. 分析表统计信息
    execute_sql "ANALYZE auth.users;" "更新表统计信息"

    echo -e "${GREEN}auth.users表优化完成${NC}"
}

# 函数：优化public.user_profiles视图
optimize_user_profiles() {
    echo -e "${BLUE}=== 优化public.user_profiles视图 ===${NC}"

    # 1. 检查视图是否存在
    execute_sql "
    SELECT viewname, viewowner, definition
    FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'user_profiles';
    " "检查user_profiles视图"

    # 2. 创建或更新视图
    execute_sql "
    CREATE OR REPLACE VIEW public.user_profiles AS
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
        -- 从metadata中提取常用字段
        u.raw_user_meta_data->>'name' as display_name,
        u.raw_user_meta_data->>'avatar_url' as avatar_url,
        u.raw_user_meta_data->>'language' as language,
        u.raw_user_meta_data->>'timezone' as timezone
    FROM auth.users u;

    GRANT SELECT ON public.user_profiles TO authenticated, anon;
    " "创建优化的user_profiles视图"

    # 3. 创建物化视图（可选，用于高频查询）
    execute_sql "
    -- 创建物化视图以提升查询性能
    CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_profiles_materialized AS
    SELECT
        u.id,
        u.email,
        u.phone,
        u.created_at,
        u.updated_at,
        u.last_sign_in_at,
        u.email_confirmed_at,
        u.phone_confirmed_at,
        u.raw_user_meta_data->>'name' as display_name,
        u.raw_user_meta_data->>'avatar_url' as avatar_url,
        u.raw_user_meta_data->>'language' as language,
        u.raw_user_meta_data->>'timezone' as timezone,
        CASE
            WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN true
            ELSE false
        END as is_active
    FROM auth.users u;

    -- 创建唯一索引
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_materialized_id
    ON public.user_profiles_materialized (id);

    -- 创建活跃用户索引
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_materialized_active
    ON public.user_profiles_materialized (is_active, last_sign_in_at DESC);

    -- 授予权限
    GRANT SELECT ON public.user_profiles_materialized TO authenticated, anon;
    " "创建物化视图"

    echo -e "${GREEN}user_profiles视图优化完成${NC}"
}

# 函数：创建数据库函数
create_database_functions() {
    echo -e "${BLUE}=== 创建数据库函数 ===${NC}"

    # 1. 用户活跃度检查函数
    execute_sql "
    CREATE OR REPLACE FUNCTION auth.is_user_active(user_id UUID, days INTEGER DEFAULT 30)
    RETURNS BOOLEAN
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
    SELECT last_sign_in_at > NOW() - INTERVAL '1 day' * days
    FROM auth.users
    WHERE id = user_id;
    $$;
    " "用户活跃度检查函数"

    # 2. 获取用户完整信息函数
    execute_sql "
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
        created_at TIMESTAMPTZ,
        last_sign_in_at TIMESTAMPTZ
    )
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
    SELECT
        u.id,
        u.email,
        u.phone,
        u.raw_user_meta_data->>'name' as display_name,
        u.raw_user_meta_data->>'avatar_url' as avatar_url,
        u.raw_user_meta_data->>'language' as language,
        u.raw_user_meta_data->>'timezone' as timezone,
        (u.last_sign_in_at > NOW() - INTERVAL '30 days') as is_active,
        u.created_at,
        u.last_sign_in_at
    FROM auth.users u
    WHERE u.id = user_id;
    $$;
    " "用户信息获取函数"

    # 3. 刷新物化视图函数
    execute_sql "
    CREATE OR REPLACE FUNCTION public.refresh_user_profiles_materialized()
    RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    AS $$
    BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_profiles_materialized;
    END;
    $$;
    " "物化视图刷新函数"

    echo -e "${GREEN}数据库函数创建完成${NC}"
}

# 函数：清理无用数据
cleanup_unused_data() {
    echo -e "${BLUE}=== 清理无用数据 ===${NC}"

    # 1. 清理过期的会话
    execute_sql "
    DELETE FROM auth.sessions
    WHERE created_at < NOW() - INTERVAL '7 days';
    " "清理过期会话"

    # 2. 分析表空间
    execute_sql "
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname IN ('auth', 'public')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " "清理后的表大小"

    echo -e "${GREEN}数据清理完成${NC}"
}

# 函数：生成优化报告
generate_report() {
    echo -e "${BLUE}=== 生成优化报告 ===${NC}"

    execute_sql "
    -- 数据库总体状态
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
    WHERE schemaname IN ('auth', 'public');
    " "数据库总体状态"

    execute_sql "
    -- 性能指标
    SELECT
        'Auth Users Table Size',
        pg_size_pretty(pg_total_relation_size('auth.users')) as size
    UNION ALL
    SELECT
        'User Profiles View Size',
        pg_size_pretty(pg_total_relation_size('public.user_profiles_materialized')) as size
    UNION ALL
    SELECT
        'Total Auth Users',
        COUNT(*)::TEXT
    FROM auth.users;
    " "优化效果统计"

    echo -e "${GREEN}优化报告生成完成${NC}"
}

# 主菜单
case "${1:-analyze}" in
    "analyze")
        analyze_database
        ;;
    "optimize-auth")
        optimize_auth_users
        ;;
    "optimize-profiles")
        optimize_user_profiles
        ;;
    "create-functions")
        create_database_functions
        ;;
    "cleanup")
        cleanup_unused_data
        ;;
    "report")
        generate_report
        ;;
    "all")
        echo -e "${BLUE}执行完整优化流程...${NC}"
        analyze_database
        optimize_auth_users
        optimize_user_profiles
        create_database_functions
        cleanup_unused_data
        generate_report
        ;;
    "help"|"-h"|"--help")
        echo "用法: $0 [命令]"
        echo
        echo "命令:"
        echo "  analyze        - 分析数据库状态"
        echo "  optimize-auth  - 优化auth.users表"
        echo "  optimize-profiles - 优化user_profiles视图"
        echo "  create-functions - 创建数据库函数"
        echo "  cleanup        - 清理无用数据"
        echo "  report         - 生成优化报告"
        echo "  all            - 执行完整优化流程"
        echo "  help           - 显示此帮助"
        ;;
    *)
        echo -e "${RED}未知命令: $1${NC}"
        echo "使用 '$0 help' 查看可用命令"
        exit 1
        ;;
esac

echo -e "${GREEN}操作完成！${NC}"