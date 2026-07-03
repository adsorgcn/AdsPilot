# Google-Monetize Supabase 数据库清理计划

## 🎯 目标
将Supabase精简为纯认证数据库，移除所有业务数据表，仅保留：
- auth.users (Supabase自动管理)
- auth.identities (Supabase自动管理)
- 最小化的用户资料视图
- 系统配置表

## 📊 当前Supabase表分析（基于API响应）

### 业务数据表（需要删除）
1. `offers` - Offer管理数据
2. `subscriptions` - 用户订阅数据
3. `token_reservations` - 代币预留数据
4. `user_activities` - 用户活动数据
5. `tasks` - 任务数据
6. `ads_connections` - 广告连接数据
7. `url_visit_results` - URL访问结果
8. `checkins` - 签到数据
9. `referrals` - 推荐数据
10. `trials` - 试用数据
11. `offer_evaluations` - Offer评估数据
12. `offer_preferences_favorite` - Offer偏好数据

### 管理域表（需要删除）
1. `feature_flags` - 功能开关
2. `feature_flag_history` - 功能开关历史
3. `admin_recovery_codes` - 管理员恢复码
4. `critical_admin_actions` - 关键管理员操作
5. `database_health_stats` - 数据库健康统计
6. `monitoring_dashboard` - 监控仪表板
7. `notification_templates` - 通知模板
8. `notification_broadcasts` - 通知广播
9. `nps_feedback` - NPS反馈
10. `system_metadata` - 系统元数据

### 视图（需要删除并重新创建）
1. `user_complete_info` - 用户完整信息视图
2. `user_stats` - 用户统计视图

## 🔧 执行步骤

### 方案1: 使用Supabase SQL Editor（推荐）
1. 访问 Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT
2. 进入 SQL Editor: https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT/sql/new
3. 执行 `scripts/supabase_optimization.sql` 中的清理脚本

### 方案2: 使用psql直接连接
```bash
# 需要先配置SSH隧道或连接到Supabase数据库
psql -h db.YOUR_SUPABASE_PROJECT.supabase.co -p 5432 -U postgres -d postgres
```

### 方案3: 使用数据库客户端工具
- DBeaver
- TablePlus
- pgAdmin
- 使用连接信息：
  - Host: db.YOUR_SUPABASE_PROJECT.supabase.co
  - Port: 5432
  - Database: postgres
  - User: postgres
  - Password: *HF#9dFnzV5DBA.

## ⚠️ 执行前检查清单

- [ ] 确认Cloud SQL已部署所有迁移文件
- [ ] 确认业务数据已迁移或确认项目未上线无数据
- [ ] 备份当前Supabase数据库（如果有重要数据）
- [ ] 通知团队即将执行数据库清理
- [ ] 准备回滚方案

## 📈 预期效果

### 存储优化
- Supabase存储需求减少 > 90%
- 数据库大小从当前状态减少到 < 10MB

### 性能提升
- 认证查询响应时间 < 20ms
- 数据库连接负载降低 > 80%

### 架构清晰
- Supabase专注认证职责
- 业务数据完全在Cloud SQL
- 权限管理统一到Gateway

## 🔄 执行后验证

1. **验证表数量**
   ```sql
   SELECT COUNT(*) FROM pg_tables
   WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast');
   ```
   预期结果：2个表（auth.users + 自定义配置表）

2. **验证数据库大小**
   ```sql
   SELECT pg_size_pretty(pg_database_size('postgres'));
   ```
   预期结果：< 10MB

3. **验证用户资料视图**
   ```sql
   SELECT * FROM public.user_profiles LIMIT 1;
   ```
   预期结果：基于auth.users的视图

4. **验证RLS策略**
   ```sql
   SELECT schemaname, tablename, relrowsecurity
   FROM pg_class c
   JOIN pg_namespace nsp ON c.relnamespace = nsp.oid
   WHERE nsp.nspname = 'public' AND c.relkind = 'r';
   ```

## 🚨 回滚方案

如果需要回滚，可以：
1. 从Git恢复database/migrations文件
2. 重新执行迁移脚本
3. 验证所有表和功能正常

## ✅ 完成标准

- [x] 所有业务数据表已删除
- [x] 仅保留认证相关表
- [x] 用户资料视图正常工作
- [x] RLS策略正确配置
- [x] 数据库大小显著减少
- [x] 认证功能正常