# Gateway Middleware Service

API Gateway统一权限管理和Token管理中间件服务。

## 概述

Gateway Middleware是Google-Monetize系统的核心基础设施层组件，负责：

- ✅ JWT验证和用户身份认证
- 🔐 订阅套餐和权限检查
- 💰 Token预留和管理
- 🔄 请求反向代理到业务服务
- 📊 统一监控和日志

## 架构

```
Frontend
  ↓
GCP API Gateway
  ↓
Gateway Middleware (本服务)
  ├─ JWT验证
  ├─ 订阅套餐查询 (Redis缓存)
  ├─ 功能权限检查
  ├─ Token预留
  ├─ 请求头注入
  └─ 反向代理
  ↓
业务服务 (offer, billing, adscenter等)
```

## 功能特性

### 已实现 ✅
- [x] 配置文件加载 (YAML)
- [x] JWT验证中间件
- [x] 反向代理中间件
- [x] 路由匹配和转发
- [x] 健康检查端点
- [x] Prometheus metrics端点

### 待实现 🚧
- [ ] Redis缓存集成
- [ ] 订阅套餐查询中间件
- [ ] 功能权限检查中间件
- [ ] Token预留和管理中间件
- [ ] 配置热更新 (Pub/Sub)
- [ ] 限流中间件
- [ ] 详细的Prometheus指标

## 配置

配置文件: `config/routes.yaml`

```yaml
environment: preview

backends:
  offer: https://offer-preview-yt54xvsg5q-an.a.run.app
  billing: https://billing-preview-yt54xvsg5q-an.a.run.app
  # ...

routes:
  - prefix: /api/v1/offers
    backend: offer
    methods: [GET, POST]
    tokenCost: 0
    requireAuth: true
    # ...
```

## 本地开发

### 前置条件
- Go 1.25+
- Redis (可选，用于缓存)

### 运行

```bash
# 从项目根目录
cd services/gateway-middleware

# 安装依赖
go mod tidy

# 运行
go run cmd/server/main.go
```

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `PORT` | HTTP服务端口 | 8080 |
| `CONFIG_PATH` | 配置文件路径 | config/routes.yaml |
| `JWT_SECRET` | JWT签名密钥 | (开发环境默认值) |
| `GIN_MODE` | Gin运行模式 | debug |

## 部署

### Cloud Run部署

```bash
# 构建镜像
gcloud builds submit \
  --config=cloudbuild-preview.yaml \
  --project=${GCP_PROJECT_ID}

# 部署到Cloud Run
gcloud run deploy gateway-middleware-preview \
  --image=asia-northeast1-docker.pkg.dev/.../gateway-middleware:preview-latest \
  --region=asia-northeast1 \
  --platform=managed \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=10 \
  --set-env-vars=ENV=preview
```

## API端点

### 健康检查
```bash
GET /health
GET /healthz
```

### Prometheus Metrics
```bash
GET /metrics
```

### 业务API（代理）
所有 `/api/v1/*` 路径的请求都会被代理到相应的后端服务。

## 监控指标

### 已实现
- 标准HTTP指标 (由Prometheus自动收集)

### 待实现
- `gateway_requests_total` - 总请求数 (按路由、状态)
- `gateway_request_duration_seconds` - 请求延迟分布
- `gateway_jwt_validation_failures_total` - JWT验证失败次数
- `gateway_permission_denied_total` - 权限拒绝次数
- `gateway_token_reservation_total` - Token预留次数
- `gateway_cache_hits_total` - 缓存命中次数

## 错误处理

### HTTP状态码
- `401 Unauthorized` - JWT验证失败
- `403 Forbidden` - 权限不足
- `402 Payment Required` - Token余额不足
- `404 Not Found` - 路由不存在
- `502 Bad Gateway` - 后端服务故障
- `503 Service Unavailable` - 限流触发

## 安全性

- ✅ JWT签名验证
- ✅ HTTPS传输
- 🚧 限流保护
- 🚧 请求体大小限制
- 🚧 SQL注入防护

## 性能优化

- ✅ HTTP连接池复用
- ✅ 反向代理零拷贝
- 🚧 Redis缓存
- 🚧 配置预加载
- 🚧 Goroutine池管理

## 开发路线图

### Phase 1: MVP (Week 1-2) - 当前阶段 ✅
- [x] 基础项目结构
- [x] 配置加载模块
- [x] JWT验证中间件
- [x] 反向代理中间件
- [ ] 编译测试通过

### Phase 2: 核心功能 (Week 3-4)
- [ ] Redis缓存集成
- [ ] 订阅套餐查询
- [ ] 功能权限检查
- [ ] 详细监控指标
- [ ] 集成测试

### Phase 3: Token管理 (Week 5-6)
- [ ] Token预留中间件
- [ ] Token两阶段提交
- [ ] 自动释放机制
- [ ] 幂等性保证

### Phase 4: 生产就绪 (Week 7-8)
- [ ] 配置热更新
- [ ] 限流中间件
- [ ] 完整的错误处理
- [ ] 压力测试
- [ ] 文档完善

## 相关文档

- [设计文档](../../docs/ArchitectureOpV1/14-API-GATEWAY-UNIFIED-PERMISSIONS.md)
- [实施路线图](../../docs/ArchitectureOpV1/05-IMPLEMENTATION-ROADMAP.md)
- [完整优化方案](../../docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md)

## 故障排查

### 问题: JWT验证失败
检查:
- JWT_SECRET环境变量配置
- Token过期时间
- Issuer和Audience配置

### 问题: 后端服务无法访问
检查:
- 后端URL配置正确性
- VPC连接配置
- 后端服务健康状态

### 问题: 性能下降
检查:
- Redis连接状态
- HTTP连接池配置
- 后端服务响应时间

## License

Proprietary - Google-Monetize Platform

---

**当前版本**: MVP (Phase 1)
**最后更新**: 2025-10-16
**维护者**: Backend Team
# Updated Fri Oct 17 13:55:54 CST 2025
