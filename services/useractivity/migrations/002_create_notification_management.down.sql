-- ========================================
-- Google-Monetize 数据库回滚: Notification Management
-- 回滚通知管理表
-- 迁移ID: 004
-- 版本: v2.0
-- ========================================

-- 开始事务
BEGIN;

-- 删除视图
DROP VIEW IF EXISTS activity.nps_analytics;
DROP VIEW IF EXISTS activity.user_notification_activity;
DROP VIEW IF EXISTS activity.notification_analytics;

-- 删除触发器
DROP TRIGGER IF EXISTS update_broadcast_status_trigger ON activity.notification_broadcasts;
DROP TRIGGER IF EXISTS update_delivery_status_trigger ON activity.notification_deliveries;
DROP TRIGGER IF EXISTS update_nps_feedback_updated_at ON activity.nps_feedback;
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON activity.notification_preferences;
DROP TRIGGER IF EXISTS update_notification_deliveries_updated_at ON activity.notification_deliveries;
DROP TRIGGER IF EXISTS update_notification_broadcasts_updated_at ON activity.notification_broadcasts;
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON activity.notification_templates;

-- 删除函数
DROP FUNCTION IF EXISTS activity.update_broadcast_status();
DROP FUNCTION IF EXISTS activity.update_delivery_status();
DROP FUNCTION IF EXISTS activity.update_updated_at_column();

-- 删除表（按依赖关系逆序）
DROP TABLE IF EXISTS activity.nps_feedback;
DROP TABLE IF EXISTS activity.notification_preferences;
DROP TABLE IF EXISTS activity.notification_deliveries;
DROP TABLE IF EXISTS activity.notification_broadcasts;
DROP TABLE IF EXISTS activity.notification_templates;

-- 提交事务
COMMIT;

-- 验证回滚结果
DO $$
BEGIN
    RAISE NOTICE '✅ activity notification management tables dropped successfully';
END $$;

