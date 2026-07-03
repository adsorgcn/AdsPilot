# Adscenter 服务

## 概述

Adscenter 是 gm 项目的核心服务，负责 Google Ads 账户管理、批量广告操作执行、诊断优化建议等功能。

### 核心功能

- ✅ **Google Ads 集成**: OAuth 认证和账户管理
- ✅ **批量操作**: 批量创建、更新、删除广告
- ✅ **预检查系统**: 操作前验证和风险评估
- ✅ **诊断引擎**: 广告账户诊断和优化建议
- ✅ **A/B 测试**: 广告测试管理
- ✅ **MCC 管理**: Manager Customer Center 账户链接
- ✅ **关键词优化**: 关键词扩展和优化
- ✅ **预算管理**: 预算转移和调整
- ✅ **审计和回滚**: 操作审计和回滚功能
- ✅ **计费集成**: Token 消耗计费

---

## 技术栈

- **语言**: Go 1.25.1
- **框架**: Chi Router
- **数据库**: Cloud SQL PostgreSQL (通过 VPC Connector)
- **缓存**: Redis (gm-redis)
- **消息队列**: Pub/Sub
- **部署**: GCP Cloud Run (asia-northeast1)
- **认证**: Supabase JWT
- **监控**: Prometheus + OpenTelemetry

---

## 本地开发

### 前置条件

- Go 1.25+
- Docker (可选，用于本地数据库)
- GCP 服务账号密钥: `secrets/gcp_codex_dev.json`
- 访问 Secret Manager 的权限

### 环境变量

主要环境变量从 GCP Secret Manager 获取：

```bash
# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...

# 外部服务
BILLING_SERVICE_URL=https://billing-preview-...
BROWSER_EXEC_SERVICE_URL=https://browser-exec-preview-...
SITERANK_SERVICE_URL=https://siterank-preview-...

# Supabase
SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
```

### 启动服务

#### 方式 1: 直接运行

```bash
# 进入服务目录
cd services/adscenter

# 安装依赖
go mod download

# 运行服务
go run main.go
```

#### 方式 2: 使用 Docker

```bash
# 构建镜像
docker build -t adscenter:local .

# 运行容器
docker run -p 8080:8080 \
  -v $(pwd)/secrets:/app/secrets \
  adscenter:local
```

### 数据库迁移

Adscenter 使用独立迁移文件 + DB Migrator Job 模式：

```bash
# 1. 构建 migrator 镜像
gcloud builds submit \
  --config=deployments/cloudbuild/build-migrator.yaml \
  --substitutions=_SERVICE=adscenter,_ENV=preview

# 2. 执行迁移
gcloud run jobs execute db-migrator-preview \
  --region=asia-northeast1 --wait

# 3. 启动服务（跳过内嵌迁移）
export ADSCENTER_SKIP_MIGRATIONS=1
go run main.go
```

---

## API 端点

### 认证

所有 API 端点需要 Supabase JWT Token：

```bash
Authorization: Bearer <supabase_jwt_token>
```

### 主要端点

完整 API 文档请参考 `openapi.yaml`。

#### OAuth 管理
- `POST /api/v1/adscenter/oauth/url` - 获取 OAuth 授权 URL
- `GET /api/v1/adscenter/oauth/callback` - OAuth 回调处理

#### 账户管理
- `GET /api/v1/adscenter/accounts` - 列出账户
- `POST /api/v1/adscenter/accounts` - 添加账户
- `DELETE /api/v1/adscenter/accounts/{id}` - 删除账户

#### 批量操作
- `POST /api/v1/adscenter/bulk-actions` - 提交批量操作
- `POST /api/v1/adscenter/bulk-actions/{id}/rollback` - 回滚操作
- `GET /api/v1/adscenter/bulk-actions/{id}/audits` - 查看审计日志

#### 诊断和优化
- `POST /api/v1/adscenter/diagnose` - 诊断分析
- `POST /api/v1/adscenter/diagnose/plan` - 生成优化计划
- `POST /api/v1/adscenter/diagnose/execute` - 执行诊断计划

#### A/B 测试
- `POST /api/v1/adscenter/ab-tests` - 创建 A/B 测试
- `GET /api/v1/adscenter/ab-tests` - 列出 A/B 测试
- `GET /api/v1/adscenter/ab-tests/{id}` - 获取测试详情

#### MCC 管理
- `POST /api/v1/adscenter/mcc/link` - 链接 MCC 账户
- `GET /api/v1/adscenter/mcc/status` - MCC 状态

#### 健康检查
- `GET /health` - 健康检查
- `GET /metrics` - Prometheus 指标

---

## 配置说明

### 速率限制
- 全局速率限制: 使用 Redis 实现
- Google Ads API 速率限制: 自动处理

### 缓存策略
- **Derivation Cache**: Redis 缓存，TTL 1 小时
- **Account Cache**: Redis 缓存，TTL 30 分钟

### 断路器配置
- **billing 服务**: 3 次失败后打开，60 秒超时
- **browser-exec 服务**: 3 次失败后打开，60 秒超时
- **siterank 服务**: 3 次失败后打开，60 秒超时

---

## 部署

### Preview 环境

```bash
# 推送到 main 分支自动触发部署
git push origin main
```

### 生产环境

```bash
# 推送到 production 分支自动触发部署
git push origin production
```

### 部署配置
- **区域**: asia-northeast1
- **资源**: 1 CPU, 1Gi 内存
- **并发**: 80
- **最大实例**: 20
- **VPC Connector**: cr-conn-default-ane1

---

## 故障排查

### 常见问题

#### 数据库连接失败
```bash
# 检查 VPC Connector
gcloud compute networks vpc-access connectors describe cr-conn-default-ane1 \
  --region=asia-northeast1

# 测试数据库连接
psql $DATABASE_URL
```

#### Redis 连接失败
```bash
# 检查 Redis 实例
gcloud redis instances describe gm-redis --region=asia-northeast1
```

#### Google Ads API 错误
- `AUTHENTICATION_ERROR`: OAuth token 过期或无效
- `AUTHORIZATION_ERROR`: 权限不足
- `QUOTA_ERROR`: API 配额超限

### 日志查看

```bash
# 查看 Cloud Run 日志
gcloud run services logs read adscenter-preview \
  --region=asia-northeast1 \
  --limit=100
```

---

## 开发指南

### 代码结构

```
services/adscenter/
├── cmd/                    # 命令行工具
├── internal/              # 内部包
│   ├── api/              # API 处理器
│   ├── ads/              # Google Ads 客户端
│   ├── domain/           # 领域模型
│   ├── executor/         # 操作执行器
│   └── storage/          # 数据访问层
├── main.go               # 主入口
└── openapi.yaml          # API 规范
```

### 测试

```bash
# 运行所有测试
go test ./...

# 生成覆盖率报告
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

### 代码规范
- 使用 `gofmt` 格式化代码
- 使用 `golangci-lint` 进行代码检查
- 保持函数简短（<50 行）

---

## 监控和告警

### Prometheus 指标
- `http_request_duration_seconds`: HTTP 请求时长
- `http_requests_total`: HTTP 请求总数
- `tokens_consumed_total`: Token 消耗总数
- `circuit_breaker_state`: 断路器状态

### 告警规则
- 高响应时间: P95 > 500ms
- 高错误率: > 0.01
- 断路器打开: 持续 1 分钟

---

## 贡献指南

### 提交代码

1. 创建功能分支: `git checkout -b feature/your-feature`
2. 编写代码和测试
3. 运行测试: `go test ./...`
4. 提交代码: `git commit -m "feat: your feature"`
5. 创建 Pull Request

### 提交信息规范

使用 Conventional Commits 格式：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `refactor`: 代码重构
- `test`: 测试相关

---

## 相关资源

- [OpenAPI 规范](./openapi.yaml)
- [架构设计文档](../../docs/ArchitectureReviewV1/)
- [项目构建指令](../../docs/SupabaseGo/MustKnowV6.md)

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队  
**状态**: ✅ 生产就绪
