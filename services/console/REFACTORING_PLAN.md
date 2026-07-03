# Console服务精简重构方案

**更新时间**: 2025-09-30 17:00
**目标**: 将Console从52个端点精简到22个核心端点，专注于用户管理、Token管理、API密钥和配置热更新

---

## 📋 保留的核心功能（22个端点）

### 1. 用户管理
- `GET  /api/v1/console/users` - 用户列表
- `*    /api/v1/console/users/{id}/*` - 用户详情/Token/订阅/角色

### 2. Token管理
- `GET  /api/v1/console/tokens/stats` - Token统计
- `*    /api/v1/console/users/{id}/tokens` - 用户Token管理

### 3. Token消耗规则（需新增）
- `GET    /api/v1/console/tokens/rules` - 获取消耗规则列表
- `POST   /api/v1/console/tokens/rules` - 创建消耗规则
- `PUT    /api/v1/console/tokens/rules/{id}` - 更新消耗规则
- `DELETE /api/v1/console/tokens/rules/{id}` - 删除消耗规则

**数据结构**:
```go
type TokenRule struct {
    ID           string    `json:"id"`
    ServiceName  string    `json:"serviceName"`  // adscenter, batchopen, siterank
    ActionType   string    `json:"actionType"`   // query, batch_open, rank_check
    CostPerUnit  int       `json:"costPerUnit"`  // Token消耗量
    Description  string    `json:"description"`
    CreatedAt    time.Time `json:"createdAt"`
    UpdatedAt    time.Time `json:"updatedAt"`
}
```

### 4. 套餐管理（通过配置管理）
- `GET  /api/v1/console/config?key=plans.*` - 获取套餐配置
- `PUT  /api/v1/console/config` - 更新套餐配置

**套餐配置示例**:
```json
{
  "plans.free.tokenGrant": 1000,
  "plans.free.features": ["basic_ads", "manual_batch"],
  "plans.pro.tokenGrant": 10000,
  "plans.pro.priceMonthly": 29900,
  "plans.enterprise.tokenGrant": 100000,
  "plans.enterprise.features": ["all", "priority_support", "dedicated_account_manager"]
}
```

### 5. API密钥管理
- `GET    /api/v1/console/apikeys` - API密钥列表
- `POST   /api/v1/console/apikeys` - 创建API密钥
- `*      /api/v1/console/apikeys/{id}` - 密钥CRUD
- `POST   /api/v1/console/apikeys/validate` - 密钥验证（内部）

### 6. 配置热更新
- `GET  /api/v1/console/config` - 配置列表
- `GET  /api/v1/console/config/history` - 配置历史
- `*    /api/v1/console/config/{key}` - 配置CRUD
- `GET  /ops/console/config/v1` - 配置快照

**支持的配置项**:
```
- rateLimit.adscenter.rpm          (Adscenter限流：请求/分钟)
- rateLimit.batchopen.maxConcurrent (Batchopen限流：最大并发)
- rateLimit.siterank.qpm           (Siterank限流：查询/分钟)
- businessRules.adscenter.maxAdsPerRequest (业务规则：单次最多查询广告数)
- businessRules.batchopen.maxUrlsPerBatch  (业务规则：单批次最多URL数)
- plans.*                          (套餐配置)
- tokens.rules.*                   (Token消耗规则)
```

### 7. 基础功能
- `GET /healthz` - 健康检查
- `GET /health` - 健康检查
- `GET /readyz` - 就绪检查
- `GET /api/health` - 健康聚合

### 8. Dashboard统计
- `GET /api/v1/console/stats` - Admin dashboard统计

---

## ❌ 删除的功能（30个端点）

### 运营监控类（16个）
- `/api/v1/console/api-usage` - API使用量统计
- `/api/v1/console/slo` - SLO聚合
- `/api/v1/console/roi/*` - ROI分析（2个）
- `/api/v1/console/adscenter/business` - 业务指标
- `/api/v1/console/adscenter/executions/summary` - 执行摘要
- `/api/v1/console/adscenter/sync/*` - 同步相关（2个）
- `/api/v1/console/adscenter/bulk-actions/*` - 批量操作（5个）
- `/api/v1/console/alerts` - 告警
- `/api/v1/console/incidents` - 事件
- `/api/v1/console/limits/policy` - 限流策略

### Event Sourcing类（5个）
- `/api/v1/console/events` - 事件查询
- `/api/v1/console/events/{id}` - 事件详情
- `/api/v1/console/events/export` - 导出
- `/api/v1/console/events/replay/*` - 回放（2个）

### Dead Letter Queue类（4个）
- `/api/v1/console/adscenter/bulk-actions/deadletters*` - Adscenter DLQ（2个）
- `/api/v1/console/offers/kpi/deadletters` - Offer DLQ
- `/api/v1/console/offers/kpi/retry` - Offer重试

### 其他（5个）
- `/api/v1/console/consistency/offers` - 数据一致性
- `/api/v1/console/notifications/*` - 通知管理（4个）
- `/api/v1/console/admin/policy*` - Admin白名单（2个）
- `/api/v1/console/security/audits` - 审计日志
- `/console/*` - 静态UI（删除）

---

## 🔧 需要新增的功能

### 1. Token消耗规则管理

**数据库表** (`console` schema):
```sql
CREATE TABLE IF NOT EXISTS token_consumption_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    cost_per_unit INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(service_name, action_type)
);

-- 初始数据
INSERT INTO token_consumption_rules (service_name, action_type, cost_per_unit, description) VALUES
('adscenter', 'ad_query', 1, '查询单条广告消耗1 Token'),
('adscenter', 'bulk_sync', 10, '批量同步消耗10 Token'),
('batchopen', 'batch_open_url', 1, '批量打开单个URL消耗1 Token'),
('siterank', 'rank_check', 5, '关键词排名检查消耗5 Token'),
('offer', 'offer_query', 2, '查询Offer消耗2 Token');
```

**Handler实现** (`services/console/internal/handlers/token_rules.go`):
```go
package handlers

import (
    "encoding/json"
    "net/http"
    "github.com/ScientificInternet/Google-Monetize/pkg/errors"
)

type TokenRule struct {
    ID          string `json:"id"`
    ServiceName string `json:"serviceName"`
    ActionType  string `json:"actionType"`
    CostPerUnit int    `json:"costPerUnit"`
    Description string `json:"description"`
    CreatedAt   string `json:"createdAt"`
    UpdatedAt   string `json:"updatedAt"`
}

func (h *Handler) getTokenRules(w http.ResponseWriter, r *http.Request) {
    rows, err := h.DB.Query(r.Context(), `
        SELECT id, service_name, action_type, cost_per_unit, description, created_at, updated_at
        FROM token_consumption_rules
        ORDER BY service_name, action_type
    `)
    if err != nil {
        errors.Write(w, r, 500, "QUERY_ERROR", "Failed to query token rules", nil)
        return
    }
    defer rows.Close()

    var rules []TokenRule
    for rows.Next() {
        var r TokenRule
        rows.Scan(&r.ID, &r.ServiceName, &r.ActionType, &r.CostPerUnit, &r.Description, &r.CreatedAt, &r.UpdatedAt)
        rules = append(rules, r)
    }
    json.NewEncoder(w).Encode(rules)
}

func (h *Handler) createTokenRule(w http.ResponseWriter, r *http.Request) {
    var rule TokenRule
    if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
        errors.Write(w, r, 400, "INVALID_JSON", "Invalid request body", nil)
        return
    }

    err := h.DB.QueryRow(r.Context(), `
        INSERT INTO token_consumption_rules (service_name, action_type, cost_per_unit, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at, updated_at
    `, rule.ServiceName, rule.ActionType, rule.CostPerUnit, rule.Description).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)

    if err != nil {
        errors.Write(w, r, 500, "INSERT_ERROR", "Failed to create token rule", nil)
        return
    }

    json.NewEncoder(w).Encode(rule)
}

func (h *Handler) updateTokenRule(w http.ResponseWriter, r *http.Request) {
    // 实现更新逻辑
}

func (h *Handler) deleteTokenRule(w http.ResponseWriter, r *http.Request) {
    // 实现删除逻辑
}
```

---

## 📁 代码文件变更清单

### 需要修改的文件

1. **`services/console/internal/handlers/http.go`**
   - 删除30个不需要的端点注册
   - 删除静态文件服务代码（Line 142-157）
   - 新增Token规则管理端点

2. **`services/console/internal/handlers/` (删除的handler文件)**
   - 删除 `events.go` - Event Sourcing相关
   - 删除 `roi.go` - ROI分析
   - 删除 `adscenter_ops.go` - Adscenter运营功能
   - 删除 `deadletters.go` - 死信队列管理
   - 删除 `notifications.go` - 通知管理
   - 删除 `alerts.go` - 告警管理
   - 删除 `audits.go` - 审计日志

3. **`services/console/internal/handlers/` (新增handler文件)**
   - 新增 `token_rules.go` - Token消耗规则管理

4. **`apps/frontend/src/lib/console-api-client.ts`**
   - 新增 `tokens.rules` API方法
   - 删除不再需要的API方法（events, roi, deadletters等）

5. **`services/console/Dockerfile`**
   - 移除静态文件复制指令

---

## 📊 精简效果

| 指标 | 精简前 | 精简后 | 改进 |
|-----|-------|-------|------|
| **API端点数** | 52个 | 22个 | ✅ -57% |
| **代码文件数** | ~15个handler | ~8个handler | ✅ -47% |
| **Docker镜像大小** | ~150MB | ~80MB（预估）| ✅ -47% |
| **代码行数** | ~2223行 | ~1200行（预估）| ✅ -46% |
| **维护复杂度** | 高 | 低 | ✅ 显著降低 |

---

## 🚀 实施步骤

### Phase 1: 代码清理（2天）
1. [ ] 删除不需要的handler文件
2. [ ] 更新`http.go`，移除30个端点注册
3. [ ] 删除静态文件服务代码
4. [ ] 更新Dockerfile

### Phase 2: 新增Token规则管理（1天）
1. [ ] 创建数据库表`token_consumption_rules`
2. [ ] 实现`token_rules.go` handler
3. [ ] 在`http.go`中注册新端点
4. [ ] 更新`console-api-client.ts`

### Phase 3: Makerkit集成（3天）
1. [ ] 创建`/admin/tokens`页面（Token管理）
2. [ ] 创建`/admin/plans`页面（套餐管理）
3. [ ] 创建`/admin/apikeys`页面（API密钥）
4. [ ] 创建`/admin/config`页面（配置热更新）

### Phase 4: 测试验证（1天）
1. [ ] API端点测试
2. [ ] 前端页面测试
3. [ ] 配置热更新测试

---

## 📝 注意事项

1. **数据库迁移**: Token消耗规则表需要在部署前创建
2. **向后兼容**: 删除的API端点可能被其他服务使用，需要确认依赖关系
3. **文档更新**: 更新OpenAPI文档，删除不再支持的端点
4. **监控告警**: 删除的运营监控功能需要用其他方式替代（Prometheus + Grafana）

---

**下一步**: 开始Phase 1代码清理