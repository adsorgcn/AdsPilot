-- ========================================
-- Supabase迁移辅助函数
-- 用于执行数据库清理操作
-- ========================================

-- 创建执行SQL的函数（需要service_role权限）
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql_text;
    RETURN 'SQL executed successfully: ' || sql_text;
EXCEPTION WHEN OTHERS THEN
    RETURN 'Error executing SQL: ' || SQLERRM;
END;
$$;

-- 创建查询表信息的函数
CREATE OR REPLACE FUNCTION get_table_info()
RETURNS TABLE(
    schema_name TEXT,
    table_name TEXT,
    size TEXT,
    row_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        COALESCE((SELECT n_live_tup FROM pg_stat_user_tables WHERE schemaname = pg_tables.schemaname AND relname = pg_tables.tablename), 0) as row_count
    FROM pg_tables
    WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$;