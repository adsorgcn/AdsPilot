# Gateway Middleware 部署指南

## 📋 概述

Gateway Middleware 是 Google-Monetize 系统的统一 API 网关，负责：
- ✅ JWT 验证和用户身份认证
- ✅ 订阅套餐和权限检查（Redis 缓存）
- ✅ Token 预留和两阶段提交管理
- ✅ 限流保护
- ✅ 反向代理到业务服务

## 🏗️ 架构

```
Frontend → GCP API Gateway → Gateway Middleware → 业务服务 (offer, billing, etc.)
                                     ↓
                           [JWT + 订阅 + 权限 + Token + 限流]
                                     ↓
                            Redis Cache + Billing API
```

## 📦 部署步骤

### 前置条件

```bash
# 1. 确认 VPC Connector
gcloud compute networks vpc-access connectors describe cr-conn-default-ane1 \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 2. 确认 Secrets
gcloud secrets describe DATABASE_URL --project=${GCP_PROJECT_ID}
gcloud secrets describe REDIS_URL --project=${GCP_PROJECT_ID}

# 3. 确认 Redis 实例运行中
gcloud redis instances list --region=asia-northeast1
```

### 方法一：使用 CI/CD 流程（推荐）

```bash
# 1. 提交代码到 Git
git add services/gateway-middleware
git commit -m "feat(gateway): Deploy Gateway Middleware Phase 1-3"
git push origin main

# 2. Cloud Build 自动触发构建和部署
# 监控构建进度:
gcloud builds list --ongoing --project=${GCP_PROJECT_ID}
```

### 方法二：手动部署

```bash
cd /Users/jason/Documents/Kiro/gm

# 构建并部署
gcloud builds submit \
  --config=services/gateway-middleware/cloudbuild-preview.yaml \
  --project=${GCP_PROJECT_ID}
```

**预计时间**: 5-8 分钟

---

## ⚙️ 配置环境变量

部署完成后，需要配置以下环境变量：

```bash
gcloud run services update gateway-middleware-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID} \
  --update-secrets=\
DATABASE_URL=DATABASE_URL:latest,\
REDIS_URL=REDIS_URL:latest \
  --update-env-vars=\
CONFIG_PATH=/config/routes.yaml,\
BILLING_SERVICE_URL=https://billing-preview-yt54xvsg5q-an.a.run.app,\
JWT_ISSUER=https://${APP_DOMAIN},\
JWT_AUDIENCE=gm-api,\
LOG_LEVEL=info,\
ENVIRONMENT=preview,\
GIN_MODE=release
```

---

## ✅ 验证部署

### 1. 检查服务状态

```bash
gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID} \
  --format="value(status.url,status.conditions[0].status)"
```

### 2. 测试健康检查

```bash
GATEWAY_URL=$(gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID} \
  --format="value(status.url)")

curl -s "$GATEWAY_URL/health" | jq .
```

**预期输出**:
```json
{
  "status": "healthy",
  "service": "gateway-middleware"
}
```

### 3. 测试中间件流水线

```bash
# 测试 JWT 验证 (应返回 401)
curl -i "$GATEWAY_URL/api/v1/offers"

# 测试带 JWT 的请求 (需要有效的 JWT token)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "$GATEWAY_URL/api/v1/offers"
```

### 4. 检查 Prometheus 指标

```bash
curl -s "$GATEWAY_URL/metrics" | grep gateway_
```

应该看到:
- `gateway_jwt_validations_total`
- `gateway_subscription_cache_hits_total`
- `gateway_permission_checks_total`
- `gateway_token_reservations_total`
- `gateway_rate_limit_allowed_total`

---

## 🔄 更新 GCP API Gateway 配置

部署完成后，需要更新 API Gateway 指向新的 Gateway Middleware：

```bash
# 1. 更新 OpenAPI 规范
# 编辑 infrastructure/api-gateway/openapi-preview.yaml

# 2. 创建新的 API Config
gcloud api-gateway api-configs create gateway-middleware-config-v1 \
  --api=gm-api-preview \
  --openapi-spec=infrastructure/api-gateway/openapi-preview.yaml \
  --backend-auth-service-account=api-gateway@${GCP_PROJECT_ID}.iam.gserviceaccount.com

# 3. 更新 Gateway
gcloud api-gateway gateways update gm-gateway-preview \
  --api=gm-api-preview \
  --api-config=gateway-middleware-config-v1 \
  --location=asia-northeast1
```

---

## 📊 监控指标

### 关键指标

| 指标 | 目标 | 告警阈值 |
|------|------|----------|
| 请求成功率 | >99% | <95% |
| P95 延迟 | <10ms | >50ms |
| JWT 验证失败率 | <1% | >5% |
| Token 预留成功率 | >99% | <95% |
| Redis 缓存命中率 | >85% | <70% |
| 限流触发率 | <5% | >20% |

### 查看日志

```bash
# 实时日志
gcloud run logs tail gateway-middleware-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 最近 50 条日志
gcloud run logs read gateway-middleware-preview \
  --region=asia-northeast1 \
  --limit=50
```

---

## 🐛 故障排查

### 问题 1: JWT 验证失败

**症状**: 所有请求返回 401 Unauthorized

**检查**:
```bash
# 1. 检查 JWT 配置
gcloud run services describe gateway-middleware-preview \
  --region=asia-northeast1 \
  --format="value(spec.template.spec.containers[0].env)"

# 2. 检查日志
gcloud run logs read gateway-middleware-preview --limit=20 | grep JWT
```

**可能原因**:
- JWT_ISSUER 或 JWT_AUDIENCE 配置错误
- Token 过期或签名错误

### 问题 2: Redis 连接失败

**症状**: 日志中出现 "Redis connection failed"

**检查**:
```bash
# 1. 检查 Redis 实例状态
gcloud redis instances describe redis-preview \
  --region=asia-northeast1

# 2. 检查 VPC Connector
gcloud compute networks vpc-access connectors describe cr-conn-default-ane1 \
  --region=asia-northeast1

# 3. 检查 REDIS_URL secret
gcloud secrets versions access latest --secret=REDIS_URL
```

### 问题 3: Billing 服务调用失败

**症状**: Token 预留失败或权限检查失败

**检查**:
```bash
# 1. 测试 Billing 服务可访问性
curl -i https://billing-preview-yt54xvsg5q-an.a.run.app/health

# 2. 检查环境变量
gcloud run services describe gateway-middleware-preview \
  --format="value(spec.template.spec.containers[0].env)" | grep BILLING
```

### 问题 4: 高延迟

**症状**: P95 延迟 >50ms

**可能原因**:
- Redis 缓存未命中率高
- Billing 服务响应慢
- 并发请求过高

**优化**:
```bash
# 1. 检查缓存命中率
curl -s "$GATEWAY_URL/metrics" | grep cache_hits

# 2. 增加实例数
gcloud run services update gateway-middleware-preview \
  --min-instances=2 \
  --max-instances=20

# 3. 增加 CPU 配额
gcloud run services update gateway-middleware-preview \
  --cpu=2 \
  --memory=1Gi
```

---

## 🔙 回滚方案

### 快速回滚

```bash
# 1. 列出所有版本
gcloud run revisions list \
  --service=gateway-middleware-preview \
  --region=asia-northeast1 \
  --limit=5

# 2. 回滚到上一个版本
gcloud run services update-traffic gateway-middleware-preview \
  --region=asia-northeast1 \
  --to-revisions=PREVIOUS_REVISION=100
```

### 完全回退（使用旧架构）

```bash
# 更新 API Gateway 指向旧的直接路由
gcloud api-gateway gateways update gm-gateway-preview \
  --api=gm-api-preview \
  --api-config=direct-routing-config \
  --location=asia-northeast1
```

---

## 📈 预期收益

| 维度 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **性能** |  |  |  |
| API 响应时间 | 150ms | 5ms | **97%** |
| billing 服务负载 | 100 req/s | 20 req/s | **-80%** |
| **成本** |  |  |  |
| 重复代码 | 每个服务 300 行 | 0 行 | **-100%** |
| billing 实例数 | 10 | 2 | **-80%** |
| **可维护性** |  |  |  |
| 权限配置位置 | 分散在各服务 | 统一在 Gateway | **集中管理** |
| 配置更新时间 | 需重启所有服务 | 实时热更新 | **0 停机** |

---

## 📚 相关文档

- 设计文档: `docs/ArchitectureOpV1/14-API-GATEWAY-UNIFIED-PERMISSIONS.md`
- 实施计划: `services/gateway-middleware/IMPLEMENTATION_PLAN.md`
- 完整优化方案: `docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md`

---

**部署文档生成时间**: 2025-10-17
**当前状态**: Phase 1-3 完成，待部署验证
**维护者**: Backend Team
