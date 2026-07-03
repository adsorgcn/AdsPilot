# Gateway Middleware 部署指南

## 概述

Gateway Middleware是Google-Monetize的统一认证、授权和Token管理网关，部署在所有业务服务之前。

**架构位置**:
```
Frontend → GCP API Gateway → Gateway Middleware → 业务服务 (offer, billing, siterank等)
```

---

## 前置条件

### 1. GCP资源准备

**VPC Connector** (必需):
```bash
# Preview环境
gcloud compute networks vpc-access connectors describe gm-preview-vpc-connector \
  --region=asia-northeast1

# Production环境
gcloud compute networks vpc-access connectors describe gm-prod-vpc-connector \
  --region=asia-northeast1
```

**Redis (Memorystore)** (必需):
- Preview: `10.0.0.3:6379`
- Production: `10.0.1.3:6379`

**Service Account Key** (必需):
```bash
# Preview
gcloud secrets describe gm-preview-service-key

# Production
gcloud secrets describe gm-prod-service-key
```

### 2. 依赖服务

Gateway Middleware依赖以下服务：
- **Billing Service**: 订阅查询、权限查询、Token管理
- **Redis**: 缓存订阅、权限、Token余额
- **PostgreSQL**: 配置管理（未来用于热更新）

---

## 部署步骤

### Preview环境部署

#### 1. 手动触发部署

```bash
cd /path/to/gm

# 方式1: 使用gcloud submit
gcloud builds submit \
  --config=services/gateway-middleware/cloudbuild-preview.yaml \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 方式2: 通过Git推送触发（如果配置了Cloud Build触发器）
git push origin main
```

#### 2. 验证部署

```bash
# 查看服务状态
gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --platform=managed

# 获取服务URL
SERVICE_URL=$(gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --platform=managed \
  --format='value(status.url)')

echo "Gateway Middleware URL: $SERVICE_URL"

# 健康检查
curl $SERVICE_URL/health
# 预期响应: {"status":"healthy","service":"gateway-middleware"}

# Metrics端点
curl $SERVICE_URL/metrics
# 预期响应: Prometheus格式的metrics
```

#### 3. 配置环境变量（首次部署后）

根据实际环境调整以下环境变量：

```bash
gcloud run services update gateway-middleware-preview \
  --region=asia-northeast1 \
  --update-env-vars="\
REDIS_ADDRESS=10.0.0.3:6379,\
BILLING_SERVICE_URL=https://billing-preview-abc123.asia-northeast1.run.app,\
CONFIG_PATH=/app/config/routes.yaml,\
GIN_MODE=release,\
ENV=preview"
```

### Production环境部署

#### 1. 灰度发布流程

```bash
# Step 1: 部署到preview环境并验证（至少运行1周）
# 确保所有功能正常、无性能问题、无崩溃

# Step 2: 部署到production
gcloud builds submit \
  --config=services/gateway-middleware/cloudbuild.yaml \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}
```

#### 2. 生产环境配置

```bash
# 更新环境变量（使用生产Redis和Billing URL）
gcloud run services update gateway-middleware-prod \
  --region=asia-northeast1 \
  --update-env-vars="\
REDIS_ADDRESS=10.0.1.3:6379,\
BILLING_SERVICE_URL=https://billing-prod-xyz789.asia-northeast1.run.app,\
CONFIG_PATH=/app/config/routes.yaml,\
GIN_MODE=release,\
ENV=production"
```

#### 3. 流量切换

**方案A: GCP API Gateway配置更新**（推荐）
```yaml
# 更新API Gateway配置，将流量路由到gateway-middleware
x-google-backend:
  address: https://gateway-middleware-prod-xyz.asia-northeast1.run.app
```

**方案B: 逐步切换**（更安全）
1. 10%流量 → gateway-middleware，监控24小时
2. 50%流量 → gateway-middleware，监控24小时
3. 100%流量 → gateway-middleware

#### 4. 验证生产环境

```bash
# 获取服务URL
PROD_URL=$(gcloud run services describe gateway-middleware-prod \
  --region=asia-northeast1 \
  --platform=managed \
  --format='value(status.url)')

# 健康检查
curl $PROD_URL/health

# 使用真实JWT测试完整流程
TOKEN="Bearer eyJhbGc..."  # 从生产环境获取真实token
curl -H "Authorization: $TOKEN" $PROD_URL/api/v1/offers
```

---

## 配置管理

### 路由配置

路由配置文件位于 `config/routes.yaml`，定义了：
- 路由前缀和后端服务映射
- 权限要求（tier和permission）
- Token消耗配置

示例配置：
```yaml
routes:
  - prefix: /api/v1/offers
    backend: offer
    methods: [GET, POST, PUT, DELETE]
    requireAuth: true
    requireTier: [professional, pro, max, elite]
    requirePermission: offer:manage
    tokenCost: 10
    description: Offer management endpoints

  - prefix: /api/v1/evaluations
    backend: siterank
    methods: [POST]
    requireAuth: true
    requireTier: [starter, professional, pro, max, elite]
    tokenCost: 50  # Basic evaluation
    description: Site evaluation endpoints
```

**配置更新流程**:
1. 修改 `config/routes.yaml`
2. 提交代码并推送
3. 触发Cloud Build重新部署
4. 验证配置生效

**未来优化**: Phase 4将实现配置热更新（Pub/Sub），无需重新部署

### 环境变量说明

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `ENV` | 环境名称 | - | ✅ |
| `CONFIG_PATH` | 路由配置文件路径 | `config/routes.yaml` | ✅ |
| `GIN_MODE` | Gin框架模式 | `debug` | ⬜ |
| `PORT` | 服务端口 | `8080` | ⬜ |
| `REDIS_ADDRESS` | Redis地址 | - | ✅ |
| `REDIS_PASSWORD` | Redis密码 | - | ⬜ |
| `REDIS_DB` | Redis数据库 | `0` | ⬜ |
| `BILLING_SERVICE_URL` | Billing服务URL | - | ✅ |

---

## 监控和告警

### Prometheus Metrics

Gateway Middleware暴露以下metrics (通过 `/metrics` 端点):

**请求指标**:
- `gateway_requests_total{method,path,status,backend}` - 总请求数
- `gateway_request_duration_seconds{method,path,backend}` - 请求延迟

**JWT验证**:
- `gateway_jwt_validation_total{result}` - 验证次数 (success/failure)
- `gateway_jwt_validation_duration_seconds` - 验证延迟

**订阅查询**:
- `gateway_subscription_queries_total{result}` - 查询次数 (cache_hit/cache_miss/error)
- `gateway_subscription_query_duration_seconds` - 查询延迟

**权限检查**:
- `gateway_permission_checks_total{result}` - 检查次数 (allowed/denied/error)
- `gateway_permission_check_duration_seconds` - 检查延迟

**Token管理**:
- `gateway_token_reservations_total{result}` - 预留次数 (success/insufficient/error)
- `gateway_token_reservation_duration_seconds` - 预留延迟

**缓存操作**:
- `gateway_cache_operations_total{operation,result}` - 缓存操作次数
- `gateway_cache_operation_duration_seconds{operation}` - 缓存操作延迟

**后端代理**:
- `gateway_backend_requests_total{backend,method,status}` - 后端请求数
- `gateway_backend_request_duration_seconds{backend,method}` - 后端延迟
- `gateway_backend_errors_total{backend,error_type}` - 后端错误数

### 关键告警规则

**Critical级别**:
```yaml
- alert: GatewayHighErrorRate
  expr: rate(gateway_backend_errors_total[5m]) > 10
  severity: critical
  description: Gateway backend error rate is high

- alert: GatewayJWTValidationFailing
  expr: rate(gateway_jwt_validation_total{result="failure"}[5m]) > 5
  severity: critical
  description: JWT validation failure rate is high
```

**Warning级别**:
```yaml
- alert: GatewayHighLatency
  expr: histogram_quantile(0.95, gateway_request_duration_seconds) > 0.1
  severity: warning
  description: Gateway P95 latency > 100ms

- alert: GatewayCacheMissRate
  expr: rate(gateway_cache_operations_total{result="miss"}[5m]) / rate(gateway_cache_operations_total[5m]) > 0.2
  severity: warning
  description: Gateway cache miss rate > 20%
```

### Grafana Dashboard

导入 `monitoring/dashboards/gateway-middleware-dashboard.json` 到Grafana:

**包含面板**:
- 请求QPS和延迟
- JWT验证成功率
- 订阅查询缓存命中率
- 权限检查通过率
- Token预留成功率
- 后端服务健康状态
- Redis连接状态

---

## 故障排查

### 常见问题

#### 1. 服务无法启动

**症状**: Cloud Run部署失败，容器无法启动

**排查步骤**:
```bash
# 查看最近的日志
gcloud run services logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --limit=100

# 常见错误:
# - "Failed to load configuration": 检查CONFIG_PATH
# - "Redis connection failed": 检查REDIS_ADDRESS和VPC Connector
# - "Billing service unreachable": 检查BILLING_SERVICE_URL
```

#### 2. Redis连接失败

**症状**: 日志中出现"Redis connection failed"

**解决方案**:
```bash
# 1. 检查VPC Connector配置
gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --format='value(spec.template.spec.containers[0].env)'

# 2. 验证Redis可访问性（需要VPC内的VM）
redis-cli -h 10.0.0.3 -p 6379 PING
# 预期: PONG

# 3. 检查Redis Memorystore实例状态
gcloud redis instances list --region=asia-northeast1
```

#### 3. Billing服务调用失败

**症状**: 日志中出现"Failed to fetch subscription"

**解决方案**:
```bash
# 1. 验证Billing服务URL正确性
echo $BILLING_SERVICE_URL

# 2. 测试Billing服务可访问性
curl $BILLING_SERVICE_URL/health

# 3. 检查JWT token是否正确传递
# 查看日志中的Authorization header
```

#### 4. 缓存命中率低

**症状**: Metrics显示 cache_miss > 80%

**原因**:
- TTL配置过短
- Redis内存不足导致驱逐
- 缓存键冲突

**解决方案**:
```bash
# 检查Redis内存使用
redis-cli -h 10.0.0.3 INFO memory

# 查看驱逐统计
redis-cli -h 10.0.0.3 INFO stats | grep evicted

# 如果内存不足，升级Redis实例
gcloud redis instances update gm-preview-redis \
  --region=asia-northeast1 \
  --size=5
```

### 日志查询

**查看所有请求日志**:
```bash
gcloud run services logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --limit=100
```

**按严重程度过滤**:
```bash
# 只看错误
gcloud run services logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --log-filter='severity>=ERROR' \
  --limit=50
```

**按时间范围查询**:
```bash
gcloud run services logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --log-filter='timestamp>="2025-10-16T10:00:00Z"' \
  --limit=100
```

---

## 回滚流程

### 快速回滚

如果发现Gateway Middleware有问题，可以快速回滚：

#### 方案A: 回滚到上一个镜像

```bash
# 查看最近的镜像
gcloud artifacts docker images list \
  asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/gm-services/gateway-middleware \
  --limit=5

# 回滚到指定镜像
gcloud run services update gateway-middleware-preview \
  --region=asia-northeast1 \
  --image=asia-northeast1-docker.pkg.dev/${GCP_PROJECT_ID}/gm-services/gateway-middleware:preview-abc123
```

#### 方案B: 流量切回旧架构

如果Gateway Middleware完全不可用，临时切回原架构：

```yaml
# 修改API Gateway配置，直接路由到业务服务
# 例如: /api/v1/offers -> offer service
x-google-backend:
  address: https://offer-preview-xyz.asia-northeast1.run.app
```

### 回滚后验证

```bash
# 1. 验证服务正常
curl $SERVICE_URL/health

# 2. 验证metrics正常
curl $SERVICE_URL/metrics | grep gateway_requests_total

# 3. 查看错误日志
gcloud run services logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --log-filter='severity>=ERROR' \
  --limit=20
```

---

## 性能调优

### 资源配置建议

**Preview环境** (适中负载):
- CPU: 1核
- Memory: 1Gi
- Min instances: 2
- Max instances: 20
- Concurrency: 100

**Production环境** (高负载):
- CPU: 2核
- Memory: 2Gi
- Min instances: 3
- Max instances: 50
- Concurrency: 100

### 缓存TTL优化

根据业务需求调整TTL（修改 `config/routes.yaml`）:

| 数据类型 | 当前TTL | 推荐范围 | 说明 |
|---------|---------|----------|------|
| 订阅信息 | 5分钟 | 5-15分钟 | 用户订阅不常变化 |
| 权限配置 | 5分钟 | 5-30分钟 | 权限配置更新频率低 |
| Token余额 | 1分钟 | 30秒-2分钟 | 余额变化频繁，TTL不宜过长 |
| Token预留 | 30分钟 | 15-60分钟 | 预留有效期内需保持 |

### 连接池配置

修改 `internal/clients/billing.go` 和 `internal/proxy/proxy.go`:

```go
httpClient: &http.Client{
    Timeout: 60 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,  // 增加到200（高负载）
        MaxIdleConnsPerHost: 10,   // 增加到20（高负载）
        IdleConnTimeout:     90 * time.Second,
    },
}
```

---

## 安全配置

### JWT密钥管理

JWT验证密钥通过环境变量或Secret Manager管理：

```bash
# 方式1: 环境变量（不推荐用于生产）
gcloud run services update gateway-middleware-preview \
  --region=asia-northeast1 \
  --update-env-vars=JWT_SECRET=your-secret-key

# 方式2: Secret Manager（推荐）
gcloud run services update gateway-middleware-preview \
  --region=asia-northeast1 \
  --update-secrets=JWT_SECRET=gm-jwt-secret:latest
```

### 访问控制

Gateway Middleware目前配置为 `--allow-unauthenticated`，因为它本身负责JWT验证。

**生产环境建议**:
- 仅允许通过GCP API Gateway访问
- 配置VPC Service Controls限制访问源

---

## 联系支持

- **文档问题**: 更新本文档并提交PR
- **技术支持**: 联系Backend团队
- **紧急问题**: 参考 `ALERTING_SETUP.md` 中的联系方式
