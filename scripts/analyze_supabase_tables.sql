-- ========================================
-- Google-Monetize Supabase 数据库现状分析脚本
-- 分析当前数据库表结构和数据量
-- ========================================

-- 1. 查看所有表
SELECT
    schemaname,
    tablename,
    tableowner,
    tablespace,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schemaname, tablename;

-- 2. 查看表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. 查看表的行数（对于大表可能较慢）
SELECT
    schemaname,
    tablename,
    n_tup_ins as total_inserts,
    n_tup_upd as total_updates,
    n_tup_del as total_deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY n_live_tup DESC;

-- 4. 查看RLS策略
SELECT
    nsp.nspname as schema_name,
    c.relname as table_name,
    pg_get_userbyid(c.relowner) as table_owner,
    c.relrowsecurity as rls_enabled,
    CASE WHEN c.relrowsecurity THEN 'YES' ELSE 'NO' END as rls_status
FROM pg_class c
JOIN pg_namespace nsp ON c.relnamespace = nsp.oid
WHERE nsp.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    AND c.relkind = 'r'
ORDER BY nsp.nspname, c.relname;

-- 5. 查看外键约束
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';