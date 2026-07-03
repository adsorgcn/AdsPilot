# Gateway Middleware 实施计划

## 执行摘要

**项目**: Gateway Middleware Service - 统一权限和Token管理
**优先级**: P1 (最高)
**工作量**: 8周
**预期收益**:
- ⚡ API响应时间: 150ms → 5ms (97%提升)
- 📉 Billing服务负载降低80%
- 🧹 业务服务代码减少70%重复逻辑

## 当前状态

### ✅ Phase 1: MVP框架 (Week 1-2) - 已完成

**完成日期**: 2025-10-16

**交付物**:
- ✅ 项目结构创建
- ✅ 配置加载模块 (`internal/config`)
- ✅ JWT验证中间件 (`internal/middleware/jwt.go`)
- ✅ 反向代理中间件 (`internal/proxy/proxy.go`)
- ✅ 主程序框架 (`cmd/server/main.go`)
- ✅ 路由配置文件 (`config/routes.yaml`)
- ✅ Dockerfile
- ✅ README文档

**代码文件**:
```
services/gateway-middleware/
├── cmd/server/main.go              (150行) - 主程序
├── internal/
│   ├── config/config.go            (200行) - 配置加载
│   ├── middleware/jwt.go           (150行) - JWT验证
│   └── proxy/proxy.go              (150行) - 反向代理
├── config/routes.yaml              (130行) - 路由配置
├── Dockerfile                      (30行)
├── README.md                       (350行)
└── go.mod                          (15行)
```

**状态**: 🟢 基础框架完成，待编译测试

---

## 待实施 Phase 2-4

### 🔵 Phase 2: 核心功能集成 (Week 3-4)

**目标**: 实现订阅查询和权限检查

#### 2.1 Redis缓存模块 (3天)

**文件**: `internal/cache/redis.go`

**功能**:
- Redis连接管理
- 订阅信息缓存 (5分钟TTL)
- 权限配置缓存 (5分钟TTL)
- Token余额缓存 (1分钟TTL)

**实现要点**:
```go
type Cache struct {
    client *redis.Client
}

// GetSubscription 获取用户订阅信息（带缓存）
func (c *Cache) GetSubscription(ctx context.Context, userID string) (*Subscription, error)

// GetPermissions 获取套餐权限配置（带缓存）
func (c *Cache) GetPermissions(ctx context.Context, tier string) ([]string, error)

// GetTokenBalance 获取Token余额（带缓存）
func (c *Cache) GetTokenBalance(ctx context.Context, userID string) (int, error)
```

#### 2.2 订阅查询中间件 (2天)

**文件**: `internal/middleware/subscription.go`

**功能**:
- 查询用户订阅套餐 (Redis → Billing Service)
- 提取套餐等级 (starter/professional/pro/max/elite)
- 注入到Gin context和请求头

**实现要点**:
```go
type SubscriptionMiddleware struct {
    cache         *cache.Cache
    billingClient *BillingClient
}

func (m *SubscriptionMiddleware) Handler() gin.HandlerFunc {
    // 1. 从缓存查询订阅信息
    // 2. 缓存未命中时调用Billing服务
    // 3. 注入userTier到context
    // 4. 设置X-User-Tier请求头
}
```

#### 2.3 权限检查中间件 (3天)

**文件**: `internal/middleware/permission.go`

**功能**:
- 加载套餐权限配置 (Redis → Database)
- 检查路由要求的权限
- 拒绝无权限请求 (403 Forbidden)

**实现要点**:
```go
type PermissionMiddleware struct {
    config *config.Config
    cache  *cache.Cache
}

func (m *PermissionMiddleware) Handler() gin.HandlerFunc {
    // 1. 获取当前路由配置
    // 2. 检查requirePermission和requireTier
    // 3. 从缓存获取用户套餐权限列表
    // 4. 验证是否有所需权限
    // 5. 拒绝或放行
}
```

#### 2.4 监控指标 (2天)

**文件**: `internal/metrics/metrics.go`

**Prometheus指标**:
```go
var (
    // 请求指标
    RequestsTotal = promauto.NewCounterVec(...)
    RequestDuration = promauto.NewHistogramVec(...)

    // JWT验证指标
    JWTValidationFailures = promauto.NewCounterVec(...)

    // 权限检查指标
    PermissionDenied = promauto.NewCounterVec(...)

    // 缓存指标
    CacheHits = promauto.NewCounterVec(...)
    CacheMisses = promauto.NewCounterVec(...)

    // 后端代理指标
    BackendRequestDuration = promauto.NewHistogramVec(...)
    BackendErrors = promauto.NewCounterVec(...)
)
```

**验收标准**:
- [ ] Redis缓存命中率 >85%
- [ ] 权限检查延迟 <5ms (P95)
- [ ] 订阅查询延迟 <10ms (P95)
- [ ] 集成测试通过

---

### 🟡 Phase 3: Token管理 (Week 5-6)

**目标**: 实现Token预留和两阶段提交

#### 3.1 Token预留中间件 (4天)

**文件**: `internal/middleware/token.go`

**功能**:
- 检查路由Token消耗配置
- 调用Billing服务预留Token
- 将reservationID注入到context和请求头
- Token余额不足时拒绝请求 (402 Payment Required)

**实现要点**:
```go
type TokenMiddleware struct {
    cache         *cache.Cache
    billingClient *BillingClient
}

func (m *TokenMiddleware) Handler() gin.HandlerFunc {
    // 1. 获取路由Token cost
    // 2. 如果cost > 0，预留Token
    // 3. 保存reservationID到context
    // 4. 设置X-Token-Reservation-ID请求头
    // 5. 余额不足时返回402
}
```

#### 3.2 Token释放机制 (3天)

**功能**:
- 业务服务成功时：无需操作（业务服务自行commit）
- 业务服务失败时：Gateway自动释放预留Token
- 超时保护：预留Token自动过期（30分钟）

**实现要点**:
```go
// 在代理响应后处理
func (p *ReverseProxy) handleTokenRelease(c *gin.Context, resp *http.Response) {
    reservationID, exists := c.Get("tokenReservation")
    if !exists {
        return
    }

    // 如果后端返回4xx/5xx错误，自动释放Token
    if resp.StatusCode >= 400 {
        p.billingClient.ReleaseReservation(c.Request.Context(), reservationID)
    }
}
```

#### 3.3 幂等性保证 (2天)

**功能**:
- 使用X-Idempotency-Key确保重试安全
- Token预留去重
- 避免重复扣费

**实现要点**:
```go
// 生成或使用客户端提供的幂等性key
func getIdempotencyKey(c *gin.Context) string {
    key := c.GetHeader("X-Idempotency-Key")
    if key == "" {
        key = generateIdempotencyKey(c)
    }
    return key
}
```

**验收标准**:
- [ ] Token预留成功率 >99%
- [ ] 自动释放机制正常工作
- [ ] 幂等性测试通过
- [ ] 压力测试通过 (1000 req/s)

---

### 🟢 Phase 4: 生产就绪 (Week 7-8)

**目标**: 完善配置管理、限流和部署

#### 4.1 配置热更新 (3天)

**文件**: `internal/config/hot_reload.go`

**功能**:
- 订阅Pub/Sub配置变更事件
- 自动失效Redis缓存
- 无需重启服务

**实现要点**:
```go
type ConfigReloader struct {
    cache      *cache.Cache
    subscriber *pubsub.Subscriber
}

func (r *ConfigReloader) Subscribe() {
    // 订阅 config-updates topic
    // 收到消息时失效相关缓存
}
```

#### 4.2 限流中间件 (2天)

**文件**: `internal/middleware/ratelimit.go`

**功能**:
- 基于用户ID限流 (100 req/min)
- 基于IP限流 (防止滥用)
- 返回429 Too Many Requests

**实现要点**:
```go
type RateLimiter struct {
    cache *cache.Cache
}

func (r *RateLimiter) Handler() gin.HandlerFunc {
    // 使用Redis INCR实现滑动窗口限流
}
```

#### 4.3 Cloud Run部署配置 (2天)

**文件**: `cloudbuild-preview.yaml`, `cloudbuild.yaml`

**配置**:
```yaml
# Gateway Middleware Preview
resources:
  cpu: "1"
  memory: "512Mi"
autoscaling:
  min: 2  # 保持热实例
  max: 20
environment:
  - CONFIG_PATH=/config/routes.yaml
  - JWT_SECRET=${JWT_SECRET}
  - REDIS_URL=${REDIS_URL}
```

#### 4.4 完整测试 (3天)

**测试类型**:
- [ ] 单元测试 (覆盖率 >80%)
- [ ] 集成测试 (完整请求流程)
- [ ] 压力测试 (3000 req/s)
- [ ] 故障测试 (Redis/Billing服务故障)

**验收标准**:
- [ ] 所有测试通过
- [ ] 性能指标达标 (<10ms P95)
- [ ] 灰度发布成功
- [ ] 生产环境验证通过

---

## 部署策略

### 灰度发布计划

#### Week 7: 预发环境全量部署
```bash
# 1. 部署Gateway Middleware到preview环境
gcloud run deploy gateway-middleware-preview ...

# 2. 更新GCP API Gateway配置
# 将所有路由指向gateway-middleware-preview

# 3. 验证功能和性能
# - 功能测试 (所有API端点)
# - 性能测试 (响应时间、缓存命中率)
# - 压力测试 (峰值流量)

# 4. 监控1周，收集数据
```

#### Week 8: 生产环境全量部署
```bash
# 1. 部署到生产环境
gcloud run deploy gateway-middleware ...

# 2. 更新生产Gateway配置
# 将所有路由指向gateway-middleware

# 3. 严密监控
# - 错误率 <0.1%
# - 响应时间 <10ms P95
# - Billing服务负载降低60%

# 4. 回滚预案准备
# 保留旧配置，可立即回滚
```

### 回滚方案

如果出现问题，立即回滚：
```bash
# 1. 恢复GCP API Gateway配置
# 将路由改回直接指向业务服务

# 2. 降级Gateway Middleware
# 停止Gateway服务或缩容到0实例

# 3. 验证系统恢复正常
```

---

## 风险管理

### 高风险项

#### 1. 性能不达标
**风险**: Gateway成为新的性能瓶颈
**缓解**:
- Redis缓存优化（命中率>85%）
- HTTP连接池调优
- Goroutine池管理
- 完善的压力测试

#### 2. Redis故障
**风险**: Redis不可用导致服务中断
**缓解**:
- 实现降级逻辑（跳过缓存直接查询）
- Redis高可用配置（主从复制）
- 监控和告警

#### 3. 配置错误导致服务不可用
**风险**: 路由配置错误导致请求失败
**缓解**:
- 配置文件验证（启动时检查）
- 灰度发布策略
- 快速回滚机制

### 中风险项

#### 1. Token管理Bug
**风险**: Token预留后未释放，导致扣费错误
**缓解**:
- 完整的集成测试
- 幂等性保证
- 自动超时释放机制

#### 2. JWT验证绕过
**风险**: 安全漏洞
**缓解**:
- 代码审查
- 安全测试
- 定期安全扫描

---

## 资源需求

### 开发资源
- **Backend工程师**: 1人 x 8周
- **DevOps工程师**: 0.5人 x 2周 (Week 7-8部署)
- **QA工程师**: 0.5人 x 2周 (Week 7-8测试)

### 基础设施成本
| 项目 | 月成本 | 说明 |
|------|--------|------|
| Gateway Middleware (Cloud Run) | $40 | 2-20实例 |
| Redis (Memorystore) | $50 | 已有，无新增成本 |
| **总计** | **$40/月** | 净新增成本 |

**ROI分析**:
- 新增成本: +$40/月
- 节省Billing调用成本: -$30/月
- 净成本增加: +$10/月
- 性能提升收益: 97% API响应时间改善

---

## 里程碑和交付物

| Week | 里程碑 | 交付物 | 验收标准 |
|------|--------|--------|----------|
| Week 1-2 | ✅ MVP框架完成 | 基础代码、配置、文档 | 编译通过，架构清晰 |
| Week 3-4 | 核心功能集成 | Redis缓存、权限检查 | 集成测试通过 |
| Week 5-6 | Token管理 | Token预留、两阶段提交 | 压力测试通过 |
| Week 7 | 预发部署 | 全量灰度 | 功能+性能验证 |
| Week 8 | 生产部署 | 全量上线 | 监控指标达标 |

---

## 下一步行动

### 立即 (Week 3)
1. **编译测试MVP代码**
   ```bash
   cd services/gateway-middleware
   go mod tidy
   go build -o /tmp/gateway ./cmd/server
   ```

2. **实现Redis缓存模块**
   - 创建 `internal/cache/redis.go`
   - 实现订阅、权限、Token缓存
   - 单元测试

3. **实现订阅查询中间件**
   - 创建 `internal/middleware/subscription.go`
   - 集成Redis缓存
   - 编写测试用例

### Week 3-4
- 完成Phase 2所有功能
- 编写集成测试
- 性能基准测试

### Week 5-6
- 完成Phase 3 Token管理
- 压力测试和优化
- 文档完善

### Week 7-8
- 预发环境部署和验证
- 生产环境部署
- 监控和优化

---

## 相关文档

- [设计文档](../../docs/ArchitectureOpV1/14-API-GATEWAY-UNIFIED-PERMISSIONS.md)
- [完整优化方案](../../docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md)
- [README](./README.md)

---

**状态**: Phase 1完成，Phase 2即将开始
**最后更新**: 2025-10-16
**负责人**: Backend Team
**预计完成日期**: 2025-12-11 (8周后)
