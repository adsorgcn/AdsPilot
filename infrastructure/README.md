# Google-Monetize 基础设施配置脚本

本目录包含 Google-Monetize 项目的基础设施配置脚本，用于自动化 GCP 环境的部署和配置。

## 📋 脚本清单

| 脚本名称 | 任务编号 | 描述 | 状态 |
|---------|---------|------|------|
| `setup-all.sh` | - | 主配置脚本，按顺序执行所有配置 | ✅ |
| `setup-secret-manager.sh` | INFRA-001 | 配置 Secret Manager（SimilarWeb、Supabase、Redis） | ✅ |
| `setup-vertex-ai.sh` | INFRA-002 | 配置 Vertex AI（Gemini 模型访问权限） | ✅ |
| `setup-pubsub.sh` | INFRA-003 | 配置 Pub/Sub topics 和 subscriptions | ✅ |
| `setup-redis.sh` | INFRA-004 | 配置 Cloud Memorystore for Redis | ✅ |
| `setup-scheduler.sh` | INFRA-005 | 配置 Cloud Scheduler（试用期检查） | ✅ |
| `setup-api-gateway.sh` | INFRA-006 | 配置 API Gateway 并生成配置文件 | ✅ |
| `setup-cloud-build.sh` | INFRA-007 | 配置 Cloud Build 和 Artifact Registry | ✅ |

## 🚀 快速开始

### 完整配置（推荐）

运行主脚本，自动执行所有配置：

```bash
./infrastructure/setup-all.sh
```

### 单独配置

也可以单独运行某个配置脚本：

```bash
# 配置 Secret Manager
./infrastructure/setup-secret-manager.sh

# 配置 Vertex AI
./infrastructure/setup-vertex-ai.sh

# 配置 Pub/Sub
./infrastructure/setup-pubsub.sh

# 配置 Redis
./infrastructure/setup-redis.sh

# 配置 Cloud Scheduler
./infrastructure/setup-scheduler.sh

# 配置 API Gateway
./infrastructure/setup-api-gateway.sh

# 配置 Cloud Build
./infrastructure/setup-cloud-build.sh
```

## 📝 前置条件

1. **GCP 认证**
   ```bash
   gcloud auth login
   ```

2. **设置项目**
   ```bash
   gcloud config set project ${GCP_PROJECT_ID}
   ```

3. **必需工具**
   - gcloud CLI
   - Python 3
   - bash

## 🏗️ 基础设施架构

### 1. Secret Manager (INFRA-001)
- **密钥管理**：存储 API 密钥、数据库凭证、OAuth 凭证
- **关键 Secrets**：
  - `similarweb-api-key` - SimilarWeb API 密钥
  - `supabase-service-role-key` - Supabase 服务密钥
  - `redis-url` - Redis 连接地址
- **权限管理**：所有后端服务（offer、billing、useractivity 等）均有访问权限

### 2. Vertex AI (INFRA-002)
- **AI 服务**：Gemini 模型访问
- **服务账号**：siterank@{PROJECT_ID}.iam.gserviceaccount.com
- **IAM 角色**：
  - `roles/aiplatform.user` - Vertex AI 用户权限
  - `roles/storage.objectViewer` - 模型访问权限

### 3. Pub/Sub (INFRA-003)
- **Topic**：`siterank.evaluate` - 网站评分请求队列
- **Subscription**：`siterank-evaluate-sub` - Siterank 服务订阅
- **配置**：
  - Ack Deadline: 600s (10 分钟)
  - Message Retention: 7 天
  - 重试策略: 10s~600s

### 4. Redis (INFRA-004)
- **实例**：`gm-redis`
- **配置**：
  - 层级: BASIC
  - 内存: 1GB
  - 版本: Redis 7.0
  - 区域: asia-northeast1
- **访问方式**：通过 VPC Connector (`cr-conn-default-ane1`)

### 5. Cloud Scheduler (INFRA-005)
- **定时任务**：
  - `trial-expiration-check-preview` - Preview 环境试用期检查
  - `trial-expiration-check-production` - 生产环境试用期检查
- **执行时间**：每天凌晨 2 点（Asia/Shanghai）
- **端点**：`POST /api/v1/billing/trials/expire`

### 6. API Gateway (INFRA-006)
- **网关**：
  - Preview: `gm-gw-preview`
  - Production: `gm-gw`
- **配置生成**：使用 `scripts/gateway/merge-openapi.sh` 合并所有服务的 OpenAPI 规范
- **后端认证**：使用 codex-dev 服务账号

### 7. Cloud Build (INFRA-007)
- **Artifact Registry**：`gm-services`（Docker 镜像仓库）
- **日志存储**：`gs://gm-build-logs-asia-northeast1`
- **构建配置**：
  - Frontend: `deployments/cloudbuild/build-frontend-docker.yaml`
  - Offer: `deployments/cloudbuild/build-offer-docker.yaml`
  - Billing: `deployments/cloudbuild/build-billing-docker.yaml`
  - Siterank: `deployments/cloudbuild/build-siterank-docker.yaml`

## 🔍 验证基础设施

### 检查所有资源状态

```bash
# Secret Manager
gcloud secrets list --project=${GCP_PROJECT_ID}

# Redis
gcloud redis instances list --region=asia-northeast1 --project=${GCP_PROJECT_ID}

# Pub/Sub
gcloud pubsub topics list --project=${GCP_PROJECT_ID}
gcloud pubsub subscriptions list --project=${GCP_PROJECT_ID}

# Cloud Scheduler
gcloud scheduler jobs list --location=asia-northeast1 --project=${GCP_PROJECT_ID}

# API Gateway
gcloud api-gateway gateways list --project=${GCP_PROJECT_ID}

# Artifact Registry
gcloud artifacts repositories list --location=asia-northeast1 --project=${GCP_PROJECT_ID}

# Cloud Build
gcloud builds list --project=${GCP_PROJECT_ID} --limit=10
```

## 🌍 环境说明

### Preview 环境
- **域名**：https://www.urlchecker.dev
- **服务后缀**：`-preview`（如 `frontend-preview`、`offer-preview`）
- **镜像标签**：`preview-{commit_sha}`, `preview-latest`

### Production 环境
- **域名**：https://www.${APP_DOMAIN}
- **服务后缀**：无（如 `frontend`、`offer`）
- **镜像标签**：`prod-{commit_sha}`, `prod-latest`

## 📚 相关文档

- [MustKnowV6.md](../docs/SupabaseGo/MustKnowV6.md) - 项目架构和重要信息
- [DEPLOYMENT_CHECKLIST.md](../docs/BusinessRequirements/DEPLOYMENT_CHECKLIST.md) - 部署检查清单
- [MASTER_TASK_LIST.md](../docs/BusinessRequirements/MASTER_TASK_LIST.md) - 任务清单

## ⚠️ 注意事项

1. **幂等性**：所有脚本都设计为幂等的，可以安全地重复执行
2. **权限要求**：需要项目 Owner 或 Editor 权限
3. **成本估算**：
   - Redis (BASIC 1GB): ~$25/月
   - Pub/Sub: 按使用量计费
   - API Gateway: 按调用次数计费
   - Cloud Scheduler: 前 3 个任务免费
4. **VPC 依赖**：Redis 需要 VPC Connector (`cr-conn-default-ane1`)

## 🔒 安全最佳实践

1. **密钥管理**：所有敏感信息存储在 Secret Manager
2. **服务账号隔离**：每个服务使用独立的服务账号
3. **最小权限原则**：仅授予必要的 IAM 权限
4. **审计日志**：启用 Cloud Audit Logs

## 🛠️ 故障排查

### Secret Manager 配置失败
```bash
# 检查 API 是否启用
gcloud services list --enabled --project=${GCP_PROJECT_ID} | grep secretmanager

# 检查服务账号权限
gcloud projects get-iam-policy ${GCP_PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*"
```

### Redis 连接失败
```bash
# 检查 VPC Connector
gcloud compute networks vpc-access connectors describe cr-conn-default-ane1 \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 测试 Redis 连接（从 Cloud Shell）
redis-cli -h 10.25.251.131 -p 6379 PING
```

### Pub/Sub 消息未处理
```bash
# 检查订阅积压
gcloud pubsub subscriptions describe siterank-evaluate-sub \
  --project=${GCP_PROJECT_ID}

# 手动拉取消息
gcloud pubsub subscriptions pull siterank-evaluate-sub \
  --limit=10 \
  --project=${GCP_PROJECT_ID}
```

## 📞 支持

如有问题，请参考：
- GCP 文档：https://cloud.google.com/docs
- 项目文档：`docs/` 目录
- Issue Tracker：（待添加）
