-- Migration: Create recovery_codes table for admin emergency access
-- Date: 2025-10-09
-- Description: 管理员一次性恢复码表 - 用于 Google OAuth 故障时的应急访问

-- Create console schema if not exists
CREATE SCHEMA IF NOT EXISTS console;

CREATE TABLE IF NOT EXISTS console.admin_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    code_hash TEXT NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_from_ip TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(code_hash)
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON console.admin_recovery_codes(user_id) WHERE used = FALSE;
CREATE INDEX IF NOT EXISTS idx_recovery_codes_expires ON console.admin_recovery_codes(expires_at) WHERE used = FALSE;

-- 审计日志增强表
CREATE TABLE IF NOT EXISTS console.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON console.admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON console.admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON console.admin_audit_log(resource);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON console.admin_audit_log(created_at DESC);

-- 敏感操作标记视图
CREATE OR REPLACE VIEW console.critical_admin_actions AS
SELECT
    id,
    user_email,
    action,
    resource,
    resource_id,
    old_value,
    new_value,
    reason,
    ip_address,
    created_at
FROM console.admin_audit_log
WHERE action IN (
    'DELETE_USER',
    'UPDATE_USER_ROLE',
    'DELETE_CONFIG',
    'UPDATE_PACKAGE_PRICE',
    'GENERATE_RECOVERY_CODES',
    'USE_RECOVERY_CODE'
)
ORDER BY created_at DESC;

-- 清理过期恢复码的函数
CREATE OR REPLACE FUNCTION console.cleanup_expired_recovery_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM console.admin_recovery_codes
    WHERE expires_at < NOW()
    RETURNING COUNT(*) INTO deleted_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 表和字段注释
COMMENT ON TABLE console.admin_recovery_codes IS '管理员恢复码表 - 用于 Google OAuth 故障时的应急访问';
COMMENT ON COLUMN console.admin_recovery_codes.code_hash IS 'bcrypt 哈希后的恢复码';
COMMENT ON COLUMN console.admin_recovery_codes.used IS '是否已使用（一次性）';
COMMENT ON COLUMN console.admin_recovery_codes.expires_at IS '过期时间（默认 90 天）';

COMMENT ON TABLE console.admin_audit_log IS '管理员审计日志 - 记录所有管理操作的详细信息';
COMMENT ON COLUMN console.admin_audit_log.old_value IS '操作前的数据快照';
COMMENT ON COLUMN console.admin_audit_log.new_value IS '操作后的数据快照';
COMMENT ON COLUMN console.admin_audit_log.reason IS '操作理由（敏感操作必填）';