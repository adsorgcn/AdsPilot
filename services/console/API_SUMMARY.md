# Console Service - 后台管理系统 API 总览

**服务定位**: 管理员视角的聚合查询和监控管理服务
**认证要求**: 所有端点使用 `middleware.AuthMiddleware + middleware.AdminOnly`
**API前缀**: `/api/v1/console`

---

## 📊 标准模块模式

每个管理模块遵循统一的设计模式：

1. **Stats端点** - 统计数据（总量、趋势、分类分布、Top N排行）
2. **List端点** - 列表数据（分页、筛选、搜索）
3. **Detail端点** - 详情数据（单个实体的完整信息）
4. **Actions端点** - 管理操作（调整、暂停、删除等管理员特权操作）

---

## 🎯 管理模块总览

| 模块 | Stats | List | Detail | Actions | 实现文件 |
|------|-------|------|--------|---------|---------|
| **仪表盘** | ✅ | - | - | - | tokens_handlers.go |
| **用户管理** | ✅ | ✅ | ✅ | ✅ | users_handlers.go |
| **Token管理** | ✅ | ✅ | - | ✅ | tokens_handlers.go |
| **Offer管理** | ✅ | ✅ | ✅ | ✅ | offers_handlers.go |
| **订阅管理** | ✅ | ✅ | ✅ | ✅ | subscriptions_handlers.go |
| **任务管理** | ✅ | ✅ | ✅ | ✅ | tasks.go |
| **Ads账号管理** | ✅ | ✅ | ✅ | - | ads_handlers.go |
| **通知广播** | ✅ | ✅ | - | ✅ | notifications_handlers.go |
| **分析数据** | ✅ | - | - | - | analytics_handlers.go |

---

## 📋 完整API端点列表

### 1. 仪表盘（Dashboard）

#### Stats - 全局统计
```
GET /api/v1/console/stats
```
**返回数据**:
```json
{
  "counters": {
    "users": 1234,
    "offers": 567,
    "subscriptionsActive": 890,
    "tokensTotal": 45000,
    "notifications24h": 123,
    "siterankAnalyses": 234,
    "batchopenTasks": 45,
    "events": 6789
  },
  "updatedAt": "2025-10-16T06:00:00Z"
}
```

---

### 2. 用户管理（User Management）

#### List - 用户列表
```
GET /api/v1/console/users?q=search&role=ADMIN&limit=50&offset=0
```
**查询参数**:
- `q` - 搜索关键词（email/name）
- `role` - 角色筛选
- `limit` - 每页数量（默认50，最大200）
- `offset` - 偏移量

**返回数据**: 用户列表数组

#### Detail - 用户详情
```
GET /api/v1/console/users/{userId}
```

#### Actions - 用户操作
```
POST /api/v1/console/users/actions
```
**请求体**:
```json
{
  "action": "ban|unban|delete",
  "userId": "user_123"
}
```

---

### 3. Token管理（Token Management）

#### Stats - Token统计
```
GET /api/v1/console/tokens/stats
```
**返回数据**:
```json
{
  "totalBalance": 45000,
  "totalUsers": 123,
  "avgBalance": 365,
  "usersWithZeroBalance": 12
}
```

#### List - Token余额列表
```
GET /api/v1/console/tokens/balances?page=1&pageSize=20&search=user@example.com
```
**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20，最大100）
- `search` - 搜索关键词（email/name）

**返回数据**:
```json
{
  "items": [
    {
      "userId": "user_123",
      "email": "user@example.com",
      "name": "User Name",
      "balance": 100,
      "lastUpdated": "2025-10-16T06:00:00Z"
    }
  ],
  "totalCount": 123,
  "page": 1,
  "pageSize": 20
}
```

#### Actions - Token充值
```
POST /api/v1/console/tokens/topup
```
**请求体**:
```json
{
  "userId": "user_123",
  "amount": 1000,
  "reason": "Manual adjustment by admin"
}
```

#### Analytics - 消耗趋势
```
GET /api/v1/console/tokens/consumption-trend?days=30
```

#### Analytics - Top消费者
```
GET /api/v1/console/tokens/top-consumers?limit=10
```

---

### 4. Offer管理（Offer Management）

#### Stats - Offer统计
```
GET /api/v1/console/offers/stats
```
**返回数据**:
```json
{
  "totalOffers": 567,
  "activeOffers": 450,
  "suspendedOffers": 12,
  "recentOffers": 23,
  "topUsers": [
    {
      "userId": "user_123",
      "userEmail": "user@example.com",
      "offerCount": 45
    }
  ]
}
```

#### List - Offer列表
```
GET /api/v1/console/offers?page=1&pageSize=20&status=active&userId=user_123&search=user@example.com
```
**查询参数**:
- `page` - 页码
- `pageSize` - 每页数量
- `status` - 状态筛选（active/suspended/deleted/pending）
- `userId` - 用户ID筛选
- `search` - 用户搜索（email/name）

**返回数据**:
```json
{
  "items": [
    {
      "id": "offer_123",
      "userId": "user_123",
      "name": "Nike Shoes",
      "status": "active",
      "landingUrl": "https://example.com",
      "createdAt": "2025-10-16T06:00:00Z",
      "updatedAt": "2025-10-16T06:00:00Z",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
  ],
  "totalCount": 567,
  "page": 1,
  "pageSize": 20
}
```

#### Detail - Offer详情
```
GET /api/v1/console/offers/{offerId}
```
**返回数据**:
```json
{
  "offer": {
    "id": "offer_123",
    "userId": "user_123",
    "name": "Nike Shoes",
    "status": "active",
    "landingUrl": "https://example.com",
    "createdAt": "2025-10-16T06:00:00Z",
    "updatedAt": "2025-10-16T06:00:00Z",
    "userEmail": "user@example.com",
    "userName": "User Name"
  },
  "kpi": {
    "clicks": 1234,
    "conversions": 56,
    "revenue": 5678
  }
}
```

#### Actions - 更新Offer状态
```
PATCH /api/v1/console/offers/{offerId}/status
```
**请求体**:
```json
{
  "status": "active|suspended|deleted|pending",
  "reason": "Admin decision"
}
```

---

### 5. 订阅管理（Subscription Management）

#### Stats - 订阅统计
```
GET /api/v1/console/subscriptions/stats
```
**返回数据**:
```json
{
  "totalSubscriptions": 890,
  "activeSubscriptions": 750,
  "trialingSubscriptions": 100,
  "canceledSubscriptions": 40,
  "recentSubscriptions": 23,
  "expiringSoon": 12,
  "planCounts": [
    {
      "planName": "pro",
      "count": 450
    },
    {
      "planName": "elite",
      "count": 200
    },
    {
      "planName": "starter",
      "count": 100
    }
  ],
  "growthTrend": [
    {
      "date": "2025-10-01",
      "count": 5
    },
    {
      "date": "2025-10-02",
      "count": 8
    }
  ]
}
```

#### List - 订阅列表
```
GET /api/v1/console/subscriptions?page=1&pageSize=20&plan=pro&status=active&search=user@example.com
```
**查询参数**:
- `page` - 页码
- `pageSize` - 每页数量
- `plan` - 套餐筛选（starter/pro/elite）
- `status` - 状态筛选（active/inactive/canceled/trialing）
- `search` - 用户搜索（email/name）

**返回数据**:
```json
{
  "items": [
    {
      "id": "sub_123",
      "userId": "user_123",
      "planName": "pro",
      "status": "active",
      "currentPeriodEnd": "2025-11-16T06:00:00Z",
      "createdAt": "2025-10-16T06:00:00Z",
      "updatedAt": "2025-10-16T06:00:00Z",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
  ],
  "totalCount": 890,
  "page": 1,
  "pageSize": 20
}
```

#### Detail - 订阅详情
```
GET /api/v1/console/subscriptions/{subscriptionId}
```

#### Actions - 手动调整订阅
```
PUT /api/v1/console/subscriptions/{subscriptionId}/adjust
```
**请求体**:
```json
{
  "planName": "pro|elite|starter",
  "status": "active|inactive|canceled|trialing",
  "days": 30
}
```

---

### 6. 任务管理（Task Management）

#### Stats - 任务统计
```
GET /api/v1/console/tasks/stats
```
**返回数据**:
```json
{
  "totalTasks": 234,
  "pendingTasks": 45,
  "runningTasks": 12,
  "completedTasks": 156,
  "failedTasks": 21
}
```

#### List - 任务列表
```
GET /api/v1/console/tasks?page=1&pageSize=20&status=pending&userId=user_123
```
**查询参数**:
- `page` - 页码
- `pageSize` - 每页数量
- `status` - 状态筛选
- `userId` - 用户ID筛选

#### Detail - 任务详情
```
GET /api/v1/console/tasks/{taskId}
```

#### Actions - 取消任务
```
POST /api/v1/console/tasks/{taskId}/cancel
```

#### Actions - 重试任务
```
POST /api/v1/console/tasks/{taskId}/retry
```

---

### 7. Ads账号管理（Ads Account Management）

#### Stats - Ads账号统计
```
GET /api/v1/console/ads/stats
```
**返回数据**:
```json
{
  "totalAccounts": 345,
  "activeAccounts": 280,
  "pendingAccounts": 45,
  "recentAccounts": 12,
  "platformCounts": [
    {
      "platform": "google",
      "count": 150
    },
    {
      "platform": "facebook",
      "count": 120
    },
    {
      "platform": "tiktok",
      "count": 75
    }
  ],
  "topUsers": [
    {
      "userId": "user_123",
      "userEmail": "user@example.com",
      "accountCount": 15
    }
  ]
}
```

#### List - Ads账号列表
```
GET /api/v1/console/ads/accounts?page=1&pageSize=20&platform=google&status=active&userId=user_123&search=user@example.com
```
**查询参数**:
- `page` - 页码
- `pageSize` - 每页数量
- `platform` - 平台筛选（google/facebook/tiktok等）
- `status` - 状态筛选（active/pending/suspended等）
- `userId` - 用户ID筛选
- `search` - 用户搜索（email/name）

**返回数据**:
```json
{
  "items": [
    {
      "id": "acc_123",
      "userId": "user_123",
      "platform": "google",
      "status": "active",
      "createdAt": "2025-10-16T06:00:00Z",
      "updatedAt": "2025-10-16T06:00:00Z",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
  ],
  "totalCount": 345,
  "page": 1,
  "pageSize": 20
}
```

#### Detail - Ads账号详情
```
GET /api/v1/console/ads/accounts/{accountId}
```

#### List - 批量操作列表
```
GET /api/v1/console/ads/bulk-operations?page=1&pageSize=20&status=pending&userId=user_123
```
**返回数据**:
```json
{
  "items": [
    {
      "id": "bulk_123",
      "userId": "user_123",
      "status": "pending",
      "totalActions": 100,
      "completedActions": 50,
      "failedActions": 5,
      "createdAt": "2025-10-16T06:00:00Z",
      "updatedAt": "2025-10-16T06:00:00Z",
      "userEmail": "user@example.com",
      "userName": "User Name"
    }
  ],
  "totalCount": 45,
  "page": 1,
  "pageSize": 20
}
```

---

### 8. 通知广播（Notification Broadcast）

#### Stats - 通知统计
```
GET /api/v1/console/notifications/stats
```

#### List - 广播列表
```
GET /api/v1/console/notifications/broadcasts
```

#### Actions - 创建广播
```
POST /api/v1/console/notifications/broadcast
```
**请求体**:
```json
{
  "title": "System Maintenance",
  "body": "Scheduled maintenance tonight",
  "targetGroup": "all|pro|elite",
  "data": "{\"url\": \"/maintenance\"}"
}
```

#### Template - 模板列表
```
GET /api/v1/console/notifications/templates
```

#### Template - 创建模板
```
POST /api/v1/console/notifications/templates/create
```

#### Template - 预览模板
```
POST /api/v1/console/notifications/templates/preview
```

---

### 9. 分析数据（Analytics）

#### Analytics - 用户增长数据
```
GET /api/v1/console/analytics/users?period=daily&days=30
```
**查询参数**:
- `period` - 时间粒度（daily/weekly/monthly）
- `days` - 时间范围（1-365天）

**返回数据**:
```json
{
  "todayNewUsers": 12,
  "weekNewUsers": 78,
  "monthNewUsers": 234,
  "dau": 1234,
  "wau": 5678,
  "mau": 12345,
  "dataPoints": [
    {
      "date": "2025-10-01",
      "value": 15
    },
    {
      "date": "2025-10-02",
      "value": 20
    }
  ]
}
```

#### Analytics - Token消耗数据
```
GET /api/v1/console/analytics/tokens?period=daily&days=30
```
**返回数据**:
```json
{
  "totalConsumed": 45000,
  "todayConsumed": 500,
  "weekConsumed": 3500,
  "monthConsumed": 15000,
  "topConsumers": [
    {
      "userId": "user_123",
      "userEmail": "user@example.com",
      "consumed": 1234
    }
  ],
  "dataPoints": [
    {
      "date": "2025-10-01",
      "value": 450
    }
  ]
}
```

#### Analytics - 收入统计数据
```
GET /api/v1/console/analytics/revenue?period=monthly&days=365
```
**返回数据**:
```json
{
  "mrr": 29000,
  "arr": 348000,
  "activeSubscribers": 750,
  "dataPoints": [
    {
      "date": "2025-10",
      "value": 29000
    }
  ]
}
```

#### Analytics - 活跃度数据
```
GET /api/v1/console/analytics/activity?days=30
```
**返回数据**:
```json
{
  "dau": 1234,
  "wau": 5678,
  "mau": 12345,
  "totalOffers": 567,
  "totalEvaluations": 890,
  "activeOffers": 450,
  "dataPoints": [
    {
      "date": "2025-10-01",
      "value": 1200
    }
  ]
}
```

---

## 🔒 认证和授权

### 中间件链
```go
middleware.AuthMiddleware(
  middleware.AdminOnly(
    http.HandlerFunc(handler)
  )
)
```

### 管理员判定逻辑
管理员身份通过以下方式验证：
1. **SUPER_ADMIN_EMAIL** 环境变量匹配
2. **ADMIN_EMAILS** 环境变量列表匹配
3. **ADMIN_UIDS** 环境变量列表匹配

---

## 📊 共同特性

### 1. 分页模式
所有列表端点支持统一的分页参数：
```
?page=1&pageSize=20
```

### 2. 筛选模式
根据实体类型提供相应筛选：
- `status` - 状态筛选
- `plan` - 套餐筛选
- `platform` - 平台筛选
- `userId` - 用户筛选

### 3. 搜索模式
支持用户信息搜索：
```
?search=user@example.com
```
使用 `ILIKE` 进行模糊匹配（email/name）

### 4. 用户信息关联
所有涉及用户的端点通过 `LEFT JOIN "User"` 关联用户信息：
```sql
LEFT JOIN "User" u ON entity."userId" = u.id
```
返回 `userEmail` 和 `userName` 字段

### 5. 响应格式
统一的列表响应格式：
```json
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 20
}
```

---

## 🛠️ 技术实现

### ServiceClients结构
```go
type ServiceClients struct {
    Supabase  *supabase.Client
    Billing   *clients.BillingClient
    Offer     *clients.OfferClient
    Adscenter *clients.AdscenterClient
}
```

### 环境变量
```bash
# Service URLs
BILLING_SERVICE_URL=http://billing:8080
OFFER_SERVICE_URL=http://offer:8080
ADSCENTER_SERVICE_URL=http://adscenter:8080

# Admin Authentication
SUPER_ADMIN_EMAIL=admin@gm.com
ADMIN_EMAILS=admin1@gm.com,admin2@gm.com
ADMIN_UIDS=uid_123,uid_456

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Database
DATABASE_URL=postgresql://...
```

---

## 📝 文件结构

```
services/console/internal/handlers/
├── http.go                        # 路由注册 + ServiceClients初始化
├── users_handlers.go              # 用户管理
├── tokens_handlers.go             # Token管理 + 全局Stats
├── offers_handlers.go             # Offer管理
├── subscriptions_handlers.go      # 订阅管理
├── tasks.go                       # 任务管理
├── ads_handlers.go                # Ads账号管理
├── notifications_handlers.go      # 通知广播
└── analytics_handlers.go          # 分析数据
```

---

**版本**: V1.0
**最后更新**: 2025-10-16
**维护者**: Google-Monetize Backend Team
