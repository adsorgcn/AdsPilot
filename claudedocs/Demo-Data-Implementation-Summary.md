# 模拟数据系统实现总结

## 完成日期
2025-01-30

## 概述
成功实现了完整的模拟数据系统，使新用户可以看到预填充的演示数据，并在添加真实数据后自动隐藏模拟数据。

## 实现内容

### 1. 数据库Schema修改 ✅

#### Cloud SQL (database/migrations/000002_add_demo_fields.up.sql)
```sql
-- offers表
ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS demo_category VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_offers_user_demo ON offers(user_id, is_demo);

-- offer_evaluations表
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_offer_evaluations_user_demo ON offer_evaluations(offer_id, is_demo);

-- offer_revenues表
ALTER TABLE offer_revenues ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
```

#### Siterank Service (services/siterank/internal/handlers/ddl.go)
```go
// 添加迁移
{
    name: "add_is_demo_to_offer_evaluations",
    ddl:  `ALTER TABLE "offer_evaluations" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN DEFAULT FALSE`,
},
{
    name: "add_is_demo_to_token_reservations",
    ddl:  `ALTER TABLE "token_reservations" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN DEFAULT FALSE`,
},

// 添加索引
{
    name: "idx_offer_evaluations_user_demo",
    ddl:  `CREATE INDEX IF NOT EXISTS "idx_offer_evaluations_user_demo" ON "offer_evaluations"("user_id", "is_demo")`,
},
{
    name: "idx_token_reservations_user_demo",
    ddl:  `CREATE INDEX IF NOT EXISTS "idx_token_reservations_user_demo" ON "token_reservations"("user_id", "is_demo")`,
},
```

#### Adscenter Service (services/adscenter/internal/migrations/009_add_demo_fields.sql)
```sql
ALTER TABLE "UserAdsConnection"
ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "demo_category" VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_useradsconnection_user_demo
ON "UserAdsConnection"("userId", "is_demo");
```

#### Offer Service (services/offer/internal/handlers/ddl.go)
```go
{
    name: "add_is_demo_to_offer_status_history",
    ddl:  `ALTER TABLE "OfferStatusHistory" ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`,
},
{
    name: "add_is_demo_to_offer_kpi_dead_letter",
    ddl:  `ALTER TABLE "OfferKpiDeadLetter" ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`,
},
```

### 2. API实现 ✅

#### OpenAPI Specification (specs/openapi/offer.yaml)
添加了两个新endpoint：
- `POST /api/v1/demo/initialize` - 初始化模拟数据
- `GET /api/v1/demo/status` - 获取模拟数据状态

#### Backend实现 (services/offer/cmd/server/main.go)
```go
// 注册路由
protectedRoutes.HandleFunc("/v1/demo/initialize", demoInitializeHandler)
protectedRoutes.HandleFunc("/v1/demo/status", demoStatusHandler)

// 实现handler
func demoInitializeHandler(w http.ResponseWriter, r *http.Request)
func demoStatusHandler(w http.ResponseWriter, r *http.Request)
func createDemoOffers(ctx context.Context, userID string) int
```

**模拟数据内容**（8条Offers）：
1. Nike Summer Sale - 成功案例（$2,500收入，4.2 ROAS）
2. Amazon Prime Day - 成功案例（$1,800收入，3.8 ROAS）
3. Apple iPhone 15 - 成功案例（$3,200收入，5.1 ROAS）
4. Adidas Fall Collection - 待处理（正在优化）
5. Samsung Galaxy - 待处理（正在优化）
6. Sony PlayStation - 待处理（正在评估）
7. Microsoft Surface - 失败案例
8. Dell Laptop - 已归档（$1,500收入，3.2 ROAS）

### 3. 智能过滤逻辑 ✅

修改了 `getOffers()` 函数，实现智能过滤：

```go
// 检查用户是否有真实数据
var hasRealData bool
checkQuery := `SELECT EXISTS(SELECT 1 FROM offers WHERE user_id = $1 AND is_demo = FALSE)`
err := db.QueryRowContext(r.Context(), checkQuery, userID).Scan(&hasRealData)

// 智能过滤
if hasRealData {
    // 有真实数据 → 只显示真实数据
    query = `SELECT ... FROM offers WHERE user_id = $1 AND is_demo = FALSE`
} else {
    // 无真实数据 → 显示模拟数据
    query = `SELECT ... FROM offers WHERE user_id = $1 AND is_demo = TRUE`
}
```

### 4. 前端集成 ✅

#### Hook实现 (apps/frontend/src/core/hooks/use-demo-data.ts)
```typescript
// 自动初始化hook
export function useDemoDataInitialization()

// 状态查询hook
export function useDemoStatus()
```

**功能**：
- 自动检测新用户
- 如果用户无真实数据且无模拟数据，自动调用初始化API
- 幂等性：多次调用不会重复创建

#### Dashboard集成 (apps/frontend/src/components/dashboard/DashboardAggregates.tsx)
```typescript
import { useDemoDataInitialization } from '~/core/hooks/use-demo-data';

export function DashboardAggregates({ className }: DashboardAggregatesProps) {
  // ... other hooks

  // Auto-initialize demo data for new users
  useDemoDataInitialization();

  // ... rest of component
}
```

## 工作流程

### 新用户首次登录
1. 用户通过Google OAuth登录
2. Dashboard页面加载
3. `useDemoDataInitialization` hook自动执行：
   - 调用 `GET /api/v1/demo/status`
   - 检查用户是否有真实数据
   - 如果无真实数据且无模拟数据：
     - 调用 `POST /api/v1/demo/initialize`
     - 后端创建8条模拟offers
4. Offers列表API返回模拟数据
5. 用户看到预填充的演示页面

### 用户添加第一条真实数据
1. 用户通过UI创建第一条真实Offer
2. 后端写入数据库，`is_demo = FALSE`
3. 下次刷新Offers列表：
   - `hasRealData` 检查返回 `true`
   - 查询自动过滤：`WHERE is_demo = FALSE`
   - 模拟数据被隐藏
   - 用户只看到真实数据

## 技术亮点

1. **数据库层隔离**：
   - 所有表都添加 `is_demo` 字段
   - 复合索引 `(user_id, is_demo)` 优化查询性能

2. **智能过滤**：
   - 单次EXISTS查询判断是否有真实数据
   - 基于结果动态调整WHERE条件
   - 无需额外逻辑，数据库层完成过滤

3. **自动初始化**：
   - 前端hook自动检测并初始化
   - 幂等性设计，避免重复创建
   - 对用户完全透明

4. **平滑过渡**：
   - 无需用户手动操作
   - 添加真实数据后自动切换
   - 保持UI一致性

## 部署检查清单

### 数据库迁移
- [ ] 运行 Cloud SQL 迁移：`database/migrations/000002_add_demo_fields.up.sql`
- [ ] Siterank service 启动时自动应用 DDL 迁移
- [ ] Adscenter service 启动时应用 `009_add_demo_fields.sql`
- [ ] Offer service 启动时应用 DDL 迁移

### 后端部署
- [ ] 部署更新的 offer service（包含demo endpoints）
- [ ] 验证API可访问：`POST /api/v1/demo/initialize`, `GET /api/v1/demo/status`

### 前端部署
- [ ] 部署更新的 frontend（包含demo hooks）
- [ ] 验证 `use-demo-data.ts` hook正常工作

### 测试验证
- [ ] 创建新用户账号
- [ ] 访问Dashboard，确认自动初始化
- [ ] 查看Offers页面，确认显示8条模拟数据
- [ ] 创建第一条真实Offer
- [ ] 刷新Offers页面，确认只显示真实数据
- [ ] 删除真实Offer，确认重新显示模拟数据

## 后续优化建议

1. **扩展到其他模块**：
   - Tasks模拟数据
   - Ads Accounts模拟连接

2. **用户控制**：
   - 添加"显示/隐藏演示数据"开关
   - 允许用户手动清除演示数据

3. **数据质量**：
   - 定期更新演示数据内容
   - 添加更多行业和场景案例

4. **分析跟踪**：
   - 统计多少用户使用演示数据
   - 分析演示数据对转化的影响

## 相关文档

- 设计文档：`claudedocs/Demo-Data-System-Design.md`
- UI/UX优化：`claudedocs/UI-UX-Optimization-Recommendations.md`
- 架构原则：`docs/BasicPrinciples/MustKnowV7.md`
