-- Console Service Read-Only Views
-- Purpose: Provide optimized read access for admin dashboard cross-service queries
-- Architecture: Part of hybrid data access pattern
-- Execution: Cloud Run Job + Cloud SQL Proxy (Unix Socket)
-- Trigger: GitHub Actions database-migration-cloudrun.yml
--
-- These views are acceptable because:
-- 1. Read-only (no write operations)
-- 2. Performance-critical admin dashboard queries
-- 3. Clear documentation of cross-service dependencies
-- 4. Console never modifies data directly - always uses service APIs

-- Create console schema if not exists
CREATE SCHEMA IF NOT EXISTS console;

-- View 1: Subscription with User Information
-- Dependencies: billing.subscriptions, billing.users
CREATE OR REPLACE VIEW console.console_subscriptions_with_users AS
SELECT
    s.id,
    s.user_id,
    s.plan_name,
    s.status,
    s.current_period_ends_at,
    s.created_at as subscription_created_at,
    s.updated_at as subscription_updated_at,
    u.email as user_email,
    u.name as user_name,
    u.created_at as user_created_at
FROM billing.subscriptions s
LEFT JOIN billing.users u ON s.user_id = u.id;

COMMENT ON VIEW console.console_subscriptions_with_users IS
'Console admin view: Subscription data with user details. Read-only. Dependencies: billing.subscriptions, billing.users';

-- View 2: Dashboard Statistics Summary
-- Purpose: Pre-aggregated stats for fast dashboard loading
CREATE OR REPLACE VIEW console.console_dashboard_summary AS
SELECT
    -- User metrics
    (SELECT COUNT(*) FROM billing.users) as total_users,
    (SELECT COUNT(*) FROM billing.users WHERE created_at > NOW() - INTERVAL '24 hours') as users_24h,
    (SELECT COUNT(*) FROM billing.users WHERE created_at > NOW() - INTERVAL '7 days') as users_7d,

    -- Subscription metrics
    (SELECT COUNT(*) FROM billing.subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM billing.subscriptions WHERE status = 'cancelled') as cancelled_subscriptions,
    (SELECT COUNT(*) FROM billing.subscriptions WHERE status = 'trial') as trialing_subscriptions,

    -- Token metrics
    (SELECT COALESCE(SUM(balance), 0) FROM billing.token_balances) as total_token_balance,
    (SELECT COUNT(DISTINCT user_id) FROM billing.token_balances WHERE balance > 0) as users_with_tokens,

    -- Timestamp
    NOW() as computed_at;

COMMENT ON VIEW console.console_dashboard_summary IS
'Console admin view: Dashboard metrics. Read-only aggregation. Dependencies: billing.users, billing.subscriptions, billing.token_balances';

-- View 3: User Overview (for user management pages)
-- Combines user data with their subscription and token balance
CREATE OR REPLACE VIEW console.console_user_overview AS
SELECT
    u.id as user_id,
    u.email,
    u.name,
    u.created_at as user_created_at,
    u.updated_at as user_updated_at,
    s.plan_name as subscription_plan,
    s.status as subscription_status,
    s.current_period_ends_at as subscription_end_date,
    COALESCE(t.balance, 0) as token_balance,
    t.updated_at as token_last_updated
FROM billing.users u
LEFT JOIN billing.subscriptions s ON u.id = s.user_id
LEFT JOIN billing.token_balances t ON u.id = t.user_id;

COMMENT ON VIEW console.console_user_overview IS
'Console admin view: User data with subscription and tokens. Read-only. Dependencies: billing.users, billing.subscriptions, billing.token_balances';

-- Note: These are VIEWS not MATERIALIZED VIEWS
-- Pros: Always fresh data, no refresh needed
-- Cons: Computed on every query
-- For large datasets, consider converting to MATERIALIZED VIEW with refresh strategy
