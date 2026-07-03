# Console Service - 管理后台部署指南

> **版本**: v2.0 - 新增 P0/P1 核心管理功能
> **日期**: 2025-10-09
> **服务**: Console Service (Admin Dashboard)

---

## 📦 **新增功能概览**

### **P0 核心功能（客服高频需求）**
1. ✅ **Token 余额手动调整** - 充值/扣减用户 Token
2. ✅ **Offer 全局管理** - 搜索/筛选/批量归档
3. ✅ **订阅状态管理** - 激活/暂停/取消订阅

### **P1 增强功能（运营监控）**
4. ✅ **实时业务大盘** - 今日数据 + 健康指标
5. ✅ **安全增强** - Recovery Code + 审计日志

---

## 🗄️ **数据库迁移**

### **迁移文件位置**
```
services/console/migrations/004_create_recovery_codes_table.sql
```

### **迁移内容**
```sql
-- 1. 管理员恢复码表（应急登录）
CREATE TABLE admin_recovery_codes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    code_hash TEXT NOT NULL,  -- bcrypt 哈希
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_from_ip TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,  -- 90天有效期
    UNIQUE(code_hash)
);

-- 2. 增强审计日志表（变更前后对比）
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    old_value JSONB,  -- 操作前快照
    new_value JSONB,  -- 操作后快照
    reason TEXT,      -- 操作理由（必填）
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 敏感操作视图
CREATE VIEW critical_admin_actions AS
SELECT * FROM admin_audit_log
WHERE action IN (
    'DELETE_USER',
    'UPDATE_USER_ROLE',
    'DELETE_CONFIG',
    'UPDATE_PACKAGE_PRICE',
    'GENERATE_RECOVERY_CODES',
    'USE_RECOVERY_CODE',
    'UPDATE_SUBSCRIPTION_STATUS',
    'BATCH_ARCHIVE_OFFERS'
);
```

### **执行迁移**
```bash
# 方式 1: 直接执行 SQL
psql $DATABASE_URL -f services/console/migrations/004_create_recovery_codes_table.sql

# 方式 2: 通过 Cloud Run Job（推荐）
gcloud run jobs execute console-migration \
  --region us-central1 \
  --args="004_create_recovery_codes_table.sql"
```

---

## 🚀 **新增 API 端点（11个）**

### **1. Token 管理（3个）**
```http
# 获取用户余额列表（分页/搜索）
GET /api/v1/console/tokens/balances
  ?page=1&pageSize=20&search=user@example.com

# 手动调整余额（充值/扣减）
POST /api/v1/console/tokens/topup
{
  "userId": "uuid",
  "amount": 1000,        // 正数=充值，负数=扣减
  "reason": "客服补偿：系统故障导致Token误扣"
}

# Token 统计
GET /api/v1/console/tokens/stats
```

### **2. Offer 管理（3个）**
```http
# 全局搜索 Offer（多维度筛选）
GET /api/v1/console/offers
  ?page=1
  &status=pending_evaluation
  &search=domain.com
  &userEmail=user@example.com
  &minScore=60
  &maxScore=90
  &sortBy=created_at
  &sortOrder=desc

# Offer 统计
GET /api/v1/console/offers/stats

# 批量归档
POST /api/v1/console/offers/batch-archive
{
  "offerIds": ["uuid1", "uuid2"],
  "reason": "违规内容批量清理"
}
```

### **3. 订阅管理（3个）**
```http
# 订阅列表（分页/筛选）
GET /api/v1/console/subscriptions
  ?page=1
  &status=active
  &search=user@example.com
  &planId=pro

# 订阅统计
GET /api/v1/console/subscriptions/stats

# 更新订阅状态
POST /api/v1/console/subscriptions/{id}/status
{
  "status": "paused",  // active | paused | canceled | past_due
  "reason": "用户申请暂停服务"
}
```

### **4. 业务大盘（2个）**
```http
# 实时统计（今日数据 + 健康指标）
GET /api/v1/console/dashboard/stats

# 今日每小时活动
GET /api/v1/console/dashboard/today-activity
```

---

## 🎨 **新增前端页面（4个）**

### **页面路径映射**
```
/manage/index.html          → 主仪表盘（已升级）
/manage/tokens.html         → Token 余额管理（新增）
/manage/offers.html         → Offer 管理（新增）
/manage/subscriptions.html  → 订阅管理（新增）
/manage/security.html       → Recovery Code 管理（新增）
/manage/audit-logs.html     → 审计日志（新增）
```

### **主仪表盘升级内容**
```html
<!-- 新增区域 1: 今日数据 -->
<h3>📈 今日数据</h3>
- 今日新增用户
- 今日新增 Offer
- 今日新增订阅
- 今日 Token 消耗

<!-- 新增区域 2: 健康指标 -->
<h3>⚠️ 健康指标</h3>
- 负余额用户（红色告警）
- 7天内到期订阅（橙色预警）
- 逾期订阅（红色告警）
- 评估失败率（>20% 红色告警）

<!-- 新增导航链接 -->
💰Token管理 | 📊Offer管理 | 💳订阅管理
```

---

## 🔐 **安全特性**

### **1. Recovery Code 系统**
- **格式**: ABCD-EFGH-IJKL-MNOP（16位 base32）
- **存储**: bcrypt 哈希（防止明文泄露）
- **有效期**: 90天
- **使用次数**: 一次性（使用后自动失效）
- **生成规则**: 管理员主动生成，自动撤销旧码

### **2. 审计日志增强**
- **变更对比**: 记录操作前后完整数据快照（JSONB 格式）
- **强制理由**: 所有敏感操作必须填写理由（≥10字）
- **实时告警**: 敏感操作自动发送 Slack 通知
- **保留期限**: 90天自动清理

### **3. 权限控制**
- **中间件**: `AdminOnly` 强制验证
- **会话验证**: 所有请求需要有效 JWT Token
- **IP 记录**: 记录所有操作的来源 IP

---

## 📊 **监控指标**

### **关键业务指标**
```javascript
// Dashboard Stats API 返回结构
{
  // 今日数据
  "todayNewUsers": 15,
  "todayNewOffers": 42,
  "todayNewSubscriptions": 8,
  "todayTokensConsumed": 125000,
  "todayTokensTopup": 200000,
  "todayRevenue": 1580.50,

  // 健康指标
  "negativeBalanceUsers": 3,        // ⚠️ 需要处理
  "expiringSubscriptions": 12,      // 7天内到期
  "pastDueSubscriptions": 2,        // ⚠️ 逾期
  "failedOfferRate": 0.15,          // 15%（<20% 正常）

  // 总体数据
  "totalUsers": 1250,
  "totalOffers": 3840,
  "totalSubscriptions": 385,
  "totalTokens": 8500000,
  "totalRevenue": 125680.00,

  "updatedAt": "2025-10-09T10:30:00Z"
}
```

### **告警规则建议**
```yaml
# Prometheus/Grafana 告警规则
alerts:
  - name: negative_balance_users
    condition: negativeBalanceUsers > 10
    severity: critical
    action: 立即查看 /manage/tokens.html

  - name: high_failure_rate
    condition: failedOfferRate > 0.20
    severity: warning
    action: 检查 Offer 服务状态

  - name: expiring_subscriptions
    condition: expiringSubscriptions > 50
    severity: info
    action: 准备续费提醒邮件
```

---

## 🧪 **功能测试清单**

### **P0 核心功能测试**

#### **1. Token 余额管理**
- [ ] 搜索用户邮箱
- [ ] 充值 Token（正数）
- [ ] 扣减 Token（负数）
- [ ] 查看负余额用户列表
- [ ] 验证审计日志记录

#### **2. Offer 管理**
- [ ] 按状态筛选（pending/deployed/archived）
- [ ] 按评分区间筛选
- [ ] 搜索域名
- [ ] 批量选择 + 批量归档
- [ ] 验证审计日志记录

#### **3. 订阅管理**
- [ ] 查看即将到期订阅（红色高亮）
- [ ] 激活订阅
- [ ] 暂停订阅
- [ ] 取消订阅
- [ ] 验证状态变更生效
- [ ] 验证审计日志记录

### **P1 增强功能测试**

#### **4. 业务大盘**
- [ ] 验证今日新增用户数
- [ ] 验证今日 Token 消耗数据
- [ ] 验证健康指标（负余额用户）
- [ ] 刷新按钮更新数据

#### **5. 安全功能**
- [ ] 生成 Recovery Code（10个）
- [ ] 下载/复制恢复码
- [ ] 使用恢复码登录（/auth/recovery.html）
- [ ] 验证一次性失效
- [ ] 查看审计日志（enhanced 模式）
- [ ] 查看敏感操作日志（critical 模式）

---

## 🔧 **部署步骤**

### **1. 数据库迁移**
```bash
# 连接到生产数据库
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# 执行迁移
psql $DATABASE_URL -f services/console/migrations/004_create_recovery_codes_table.sql

# 验证表创建
psql $DATABASE_URL -c "\d admin_recovery_codes"
psql $DATABASE_URL -c "\d admin_audit_log"
```

### **2. 构建镜像**
```bash
cd services/console

# 构建
docker build -t gcr.io/PROJECT_ID/console:v2.0 .

# 推送
docker push gcr.io/PROJECT_ID/console:v2.0
```

### **3. 部署到 Cloud Run**
```bash
gcloud run deploy console \
  --image gcr.io/PROJECT_ID/console:v2.0 \
  --region us-central1 \
  --platform managed \
  --set-env-vars="DATABASE_URL=$DATABASE_URL" \
  --allow-unauthenticated
```

### **4. 验证部署**
```bash
# 健康检查
curl https://console.${APP_DOMAIN}/healthz

# 测试 Dashboard API
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://console.${APP_DOMAIN}/api/v1/console/dashboard/stats
```

---

## 📝 **回滚计划**

### **如果出现问题**
```bash
# 1. 回滚到上一版本
gcloud run services update-traffic console \
  --to-revisions=PREVIOUS_REVISION=100

# 2. 回滚数据库（仅表结构，不影响现有数据）
psql $DATABASE_URL << EOF
DROP TABLE IF EXISTS admin_recovery_codes;
DROP TABLE IF EXISTS admin_audit_log;
DROP VIEW IF EXISTS critical_admin_actions;
EOF
```

### **兼容性说明**
- ✅ 新增表不影响现有功能
- ✅ API 端点向后兼容（新增端点，未修改旧端点）
- ✅ 前端页面独立，不影响用户前台
- ⚠️ 依赖 `"User"` 和 `"Subscription"` 表（Billing Service）

---

## 🎯 **后续优化建议**

### **性能优化（可选）**
1. Dashboard Stats 添加 Redis 缓存（TTL 30秒）
2. Offer 列表添加复合索引（status + created_at）
3. 审计日志分区表（按月分区）

### **功能扩展（P2）**
1. 公告/通知发布系统
2. 黑名单管理（域名/IP/邮箱）
3. 功能开关/灰度发布
4. API 调用日志查询
5. 数据导出审计

---

## 📞 **联系方式**

- **文档**: `/docs/FrontendOptimization/ADMIN_SECURITY_ENHANCEMENT.md`
- **源码**: `/services/console/`
- **问题反馈**: GitHub Issues

---

**部署检查清单** ✅

- [ ] 数据库迁移执行成功
- [ ] 镜像构建并推送到 GCR
- [ ] Cloud Run 服务部署成功
- [ ] 健康检查通过
- [ ] Dashboard 页面可访问
- [ ] Token 管理功能测试通过
- [ ] Offer 管理功能测试通过
- [ ] 订阅管理功能测试通过
- [ ] 审计日志正常记录
- [ ] Recovery Code 生成测试通过
