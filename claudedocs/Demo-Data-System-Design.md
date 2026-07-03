# 模拟数据系统设计文档

## 目标
实现智能模拟数据系统，为新用户提供开箱即用的演示体验，同时不影响用户真实数据的使用。

## 核心需求
1. **首次登录体验**：新用户看到预填充的模拟数据，而不是空页面
2. **无缝过渡**：用户添加第一条真实数据后，模拟数据自动隐藏
3. **数据隔离**：每个用户的模拟数据完全独立，基于 `user_id`
4. **不影响业务**：模拟数据不计入统计、不消耗Token、不参与真实业务逻辑

---

## 技术架构

### 1. 数据库Schema设计

#### 1.1 通用字段
所有支持模拟数据的表添加以下字段：
```sql
ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS demo_category VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_{table_name}_user_demo ON {table_name}(user_id, is_demo);
```

**字段说明**：
- `is_demo`: 标识是否为模拟数据
- `demo_category`: 模拟数据分类（如 "success", "pending", "failed" 用于演示不同状态）
- 索引：优化按用户和is_demo过滤的查询性能

#### 1.2 需要修改的表

**offer服务** (`services/offer/internal/handlers/ddl.go`):
```sql
-- Offers主表
ALTER TABLE Offers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE Offers ADD COLUMN IF NOT EXISTS demo_category VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_offers_user_demo ON Offers(user_id, is_demo);

-- 状态历史表
ALTER TABLE OfferStatusHistory ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
```

**siterank服务** (`services/siterank/internal/handlers/ddl.go`):
```sql
-- 评估记录表
ALTER TABLE offer_evaluations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_evaluations_user_demo ON offer_evaluations(user_id, is_demo);

-- Token预留表
ALTER TABLE token_reservations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
```

**adscenter服务** (`services/adscenter/internal/migrations/`):
```sql
-- 用户广告连接表
ALTER TABLE UserAdsConnection ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE UserAdsConnection ADD COLUMN IF NOT EXISTS demo_category VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_ads_connection_user_demo ON UserAdsConnection(user_id, is_demo);
```

### 2. API设计

#### 2.1 模拟数据初始化API

**Endpoint**: `POST /api/v1/demo/initialize`

**职责**：
- 检查用户是否已有真实数据
- 如果没有，创建完整的模拟数据集
- 幂等性：重复调用不会创建重复数据

**请求**：
```json
{
  "user_id": "uuid",
  "modules": ["offers", "tasks", "ads_accounts"]
}
```

**响应**：
```json
{
  "success": true,
  "initialized_modules": ["offers", "ads_accounts"],
  "skipped_modules": ["tasks"],  // 已有真实数据
  "demo_counts": {
    "offers": 8,
    "ads_accounts": 2
  }
}
```

#### 2.2 查询API修改

**所有查询API添加智能过滤逻辑**：

```go
// 伪代码示例
func ListOffers(userID string, includeDemoExplicit bool) ([]Offer, error) {
    // 1. 检查是否有真实数据
    hasRealData, err := HasRealData(userID, "offers")
    if err != nil {
        return nil, err
    }

    // 2. 智能过滤逻辑
    var query string
    if hasRealData && !includeDemoExplicit {
        // 有真实数据且未明确要求包含模拟数据 -> 只返回真实数据
        query = "SELECT * FROM Offers WHERE user_id = ? AND is_demo = FALSE"
    } else if !hasRealData {
        // 没有真实数据 -> 返回模拟数据
        query = "SELECT * FROM Offers WHERE user_id = ? AND is_demo = TRUE"
    } else {
        // 有真实数据且明确要求包含模拟数据 -> 返回所有数据
        query = "SELECT * FROM Offers WHERE user_id = ?"
    }

    return db.Query(query, userID)
}
```

#### 2.3 数据检查辅助API

**Endpoint**: `GET /api/v1/demo/status`

**响应**：
```json
{
  "modules": {
    "offers": {
      "has_real_data": false,
      "demo_count": 8,
      "real_count": 0
    },
    "ads_accounts": {
      "has_real_data": true,
      "demo_count": 2,
      "real_count": 3
    }
  }
}
```

### 3. 模拟数据内容设计

#### 3.1 Offers模拟数据（8条）

**成功案例（3条）**：
```go
var demoOffers = []DemoOffer{
    {
        Name:           "Nike Summer Sale Campaign",
        Brand:          "Nike",
        Country:        "US",
        URL:            "https://demo.example.com/nike-summer",
        Revenue:        250000,  // $2,500
        ROAS:           4.2,
        Clicks:         15000,
        Conversions:    1200,
        CTR:            0.08,
        AIScore:        92,
        DemoCategory:   "success",
        Status: OfferStatus{
            Evaluation: "evaluated",
            Click:      "configured",
            Deployment: "deployed",
            Archived:   false,
        },
    },
    {
        Name:           "Amazon Prime Day Electronics",
        Brand:          "Amazon",
        Country:        "US",
        URL:            "https://demo.example.com/amazon-prime",
        Revenue:        180000,  // $1,800
        ROAS:           3.8,
        Clicks:         12500,
        Conversions:    950,
        CTR:            0.076,
        AIScore:        88,
        DemoCategory:   "success",
        Status: OfferStatus{
            Evaluation: "evaluated",
            Click:      "configured",
            Deployment: "deployed",
            Archived:   false,
        },
    },
    {
        Name:           "Apple iPhone 15 Launch",
        Brand:          "Apple",
        Country:        "US",
        URL:            "https://demo.example.com/iphone15",
        Revenue:        320000,  // $3,200
        ROAS:           5.1,
        Clicks:         18000,
        Conversions:    1500,
        CTR:            0.083,
        AIScore:        95,
        DemoCategory:   "success",
        Status: OfferStatus{
            Evaluation: "evaluated",
            Click:      "configured",
            Deployment: "deployed",
            Archived:   false,
        },
    },
}
```

**待评估案例（3条）**：
```go
    {
        Name:           "Adidas Fall Collection",
        Brand:          "Adidas",
        Country:        "UK",
        URL:            "https://demo.example.com/adidas-fall",
        Revenue:        0,
        AIScore:        0,
        DemoCategory:   "pending",
        Status: OfferStatus{
            Evaluation: "not_evaluated",
            Click:      "not_configured",
            Deployment: "not_deployed",
            Archived:   false,
        },
    },
```

**失败案例（1条）**：
```go
    {
        Name:           "Generic Fitness App",
        Brand:          "FitLife",
        Country:        "US",
        URL:            "https://demo.example.com/fitlife",
        Revenue:        50000,   // $500
        ROAS:           1.2,     // Low ROAS
        Clicks:         5000,
        Conversions:    150,
        CTR:            0.03,    // Low CTR
        AIScore:        45,      // Failed score
        DemoCategory:   "failed",
        Status: OfferStatus{
            Evaluation: "evaluated",
            Click:      "configured",
            Deployment: "paused",
            Archived:   false,
        },
    },
```

**已归档案例（1条）**：
```go
    {
        Name:           "Holiday 2024 Campaign",
        Brand:          "Target",
        Country:        "US",
        URL:            "https://demo.example.com/target-holiday",
        Revenue:        150000,
        ROAS:           3.0,
        AIScore:        78,
        DemoCategory:   "archived",
        Status: OfferStatus{
            Evaluation: "evaluated",
            Click:      "configured",
            Deployment: "deployed",
            Archived:   true,
        },
    },
```

#### 3.2 Ads Accounts模拟数据（2条）

```go
var demoAdsAccounts = []DemoAdsAccount{
    {
        Platform:       "google",
        AccountID:      "demo-google-123456",
        AccountName:    "Demo Google Ads Account",
        Status:         "active",
        Currency:       "USD",
        Timezone:       "America/Los_Angeles",
        DemoCategory:   "active",
        Stats: AdsAccountStats{
            TotalSpend:     450000,  // $4,500
            Impressions:    2500000,
            Clicks:         125000,
            CTR:            0.05,
            AvgCPC:         360,     // $3.60
            Revenue:        1800000, // $18,000
            ROAS:           4.0,
            SpendTrend:     "up",
        },
    },
    {
        Platform:       "facebook",
        AccountID:      "demo-facebook-789012",
        AccountName:    "Demo Facebook Ads Account",
        Status:         "pending",
        Currency:       "USD",
        Timezone:       "America/New_York",
        DemoCategory:   "pending",
        Stats: AdsAccountStats{
            TotalSpend:     0,
            Impressions:    0,
            Clicks:         0,
        },
    },
}
```

#### 3.3 Tasks模拟数据（6条）

```go
var demoTasks = []DemoTask{
    // Completed evaluation task
    {
        Type:           "evaluation",
        Status:         "completed",
        Title:          "Evaluate Nike Summer Sale Campaign",
        TokensEstimated: 50,
        TokensConsumed:  48,
        Progress:       100,
        DemoCategory:   "completed",
        Result: TaskResult{
            Success: true,
            Message: "Evaluation completed successfully. AI Score: 92/100",
        },
    },
    // Running evaluation task
    {
        Type:           "evaluation",
        Status:         "running",
        Title:          "Evaluate Amazon Prime Day Electronics",
        TokensEstimated: 50,
        TokensConsumed:  30,
        Progress:       60,
        DemoCategory:   "running",
    },
    // Failed task
    {
        Type:           "click_tracking",
        Status:         "failed",
        Title:          "Configure click tracking for Generic Fitness App",
        TokensEstimated: 20,
        TokensConsumed:  15,
        DemoCategory:   "failed",
        Error:          "Failed to configure tracking pixel: Domain not accessible",
    },
    // Pending tasks
    {
        Type:           "link_replacement",
        Status:         "pending",
        Title:          "Update affiliate links for Holiday Campaign",
        TokensEstimated: 30,
        TokensConsumed:  0,
        DemoCategory:   "pending",
    },
}
```

### 4. 前端实现

#### 4.1 初始化Hook

创建 `apps/frontend/src/hooks/useDemoDataInitialization.ts`:

```typescript
export function useDemoDataInitialization() {
  const { user } = useAuth();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initializeDemoData() {
      if (!user || isInitialized) return;

      // 检查是否需要初始化
      const statusResponse = await fetch('/api/v1/demo/status', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` }
      });
      const status = await statusResponse.json();

      // 如果所有模块都没有真实数据，初始化模拟数据
      const needsInit = Object.values(status.modules).every(
        (m: any) => !m.has_real_data
      );

      if (needsInit && !isInitializing) {
        setIsInitializing(true);

        await fetch('/api/v1/demo/initialize', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modules: ['offers', 'tasks', 'ads_accounts']
          }),
        });

        setIsInitialized(true);
        setIsInitializing(false);
      }
    }

    initializeDemoData();
  }, [user]);

  return { isInitializing, isInitialized };
}
```

#### 4.2 数据查询Hook修改

修改 `apps/frontend/src/hooks/useOffers.ts`:

```typescript
export function useOffers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['offers', user?.id],
    queryFn: async () => {
      const token = await user?.getIdToken();

      // API自动处理智能过滤逻辑
      const response = await fetch('/api/v1/offers', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const offers = await response.json();

      // 前端额外标记模拟数据（用于UI提示）
      return offers.map((offer: Offer) => ({
        ...offer,
        _isDemoData: offer.is_demo,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

#### 4.3 UI提示组件

创建 `apps/frontend/src/components/DemoDataBanner.tsx`:

```typescript
export function DemoDataBanner({ onDismiss }: { onDismiss?: () => void }) {
  const { t } = useTranslation();

  return (
    <Alert type="info" className="mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          <span className="text-sm">
            {t('demo.banner.message',
              '您正在查看演示数据。添加您的第一个真实项目后，这些演示数据将自动隐藏。'
            )}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          {t('common.dismiss', '知道了')}
        </Button>
      </div>
    </Alert>
  );
}
```

### 5. 实施步骤

#### Phase 1: 数据库Schema修改（1天）
1. ✅ 修改 offer 服务 DDL
2. ✅ 修改 siterank 服务 DDL
3. ✅ 创建 adscenter 服务迁移文件
4. ✅ 部署Schema更新到Preview环境

#### Phase 2: 后端API实现（2天）
1. ✅ 创建 `/api/v1/demo/initialize` 端点
2. ✅ 创建 `/api/v1/demo/status` 端点
3. ✅ 修改所有查询API添加智能过滤
4. ✅ 实现模拟数据生成逻辑
5. ✅ 添加单元测试

#### Phase 3: 前端集成（1天）
1. ✅ 创建 `useDemoDataInitialization` hook
2. ✅ 修改数据查询hooks
3. ✅ 添加 DemoDataBanner 组件
4. ✅ 集成到主要页面（Dashboard, Offers, Tasks）

#### Phase 4: 测试和优化（1天）
1. ✅ 测试首次登录流程
2. ✅ 测试真实数据添加后的过渡
3. ✅ 性能测试（查询优化）
4. ✅ 部署到Production

---

## 最佳实践

### 1. 数据完整性
- ✅ 模拟数据必须通过API创建，禁止前端硬编码
- ✅ 模拟数据基于 `user_id` 完全隔离
- ✅ 模拟数据不计入业务统计

### 2. 性能优化
- ✅ 添加复合索引：`(user_id, is_demo)`
- ✅ 查询时始终包含 `is_demo` 过滤条件
- ✅ 使用数据库级别的过滤，不在应用层过滤

### 3. 用户体验
- ✅ 首次登录即可看到完整界面
- ✅ 模拟数据过渡无缝（用户无感知）
- ✅ 可选：提供"查看演示数据"开关（设置页面）

### 4. 维护性
- ✅ 模拟数据内容集中管理
- ✅ 定期更新模拟数据内容（反映最新业务场景）
- ✅ 提供清理脚本（删除过期模拟数据）

---

## 风险和注意事项

### 1. 数据混淆风险
**问题**: 用户误将模拟数据当作真实数据

**解决方案**:
- UI上使用不同颜色/图标标识模拟数据
- DemoDataBanner 明确提示
- 设置页面显示模拟数据状态

### 2. Token消耗风险
**问题**: 模拟数据评估消耗Token

**解决方案**:
- 所有涉及Token的操作跳过 `is_demo=true` 的数据
- Token预留API拒绝模拟数据请求

### 3. 统计污染风险
**问题**: 模拟数据污染统计图表

**解决方案**:
- 所有统计查询添加 `WHERE is_demo = FALSE`
- Dashboard API默认排除模拟数据

### 4. 性能风险
**问题**: 查询时额外的过滤条件影响性能

**解决方案**:
- 添加复合索引
- 使用查询计划分析优化

---

## 未来扩展

### 1. 可配置模拟数据
- 管理后台可编辑模拟数据内容
- 支持多语言模拟数据

### 2. 行业模板
- 不同行业的模拟数据集（电商、教育、医疗）
- 用户可选择行业模板

### 3. 交互式教程
- 基于模拟数据的引导教程
- 逐步演示功能使用

---

## 总结

模拟数据系统通过以下机制实现智能体验：

1. **数据库层**：`is_demo` 字段 + 复合索引
2. **API层**：智能过滤逻辑（HasRealData检查）
3. **前端层**：自动初始化 + 无缝过渡
4. **用户体验**：首次登录看到完整界面 → 添加真实数据后自动隐藏模拟数据

**核心优势**：
- ✅ 新用户体验优秀（非空页面）
- ✅ 用户过渡无感知
- ✅ 不污染真实数据
- ✅ 易于维护和扩展
