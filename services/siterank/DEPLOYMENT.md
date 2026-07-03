# Siterank API+Worker 部署指南

## 架构概述

Siterank服务已拆分为两个独立的Cloud Run服务：

- **siterank-api-preview**: 处理HTTP API请求，快速响应（~50ms）
- **siterank-worker-preview**: 处理后台评估任务，独立扩缩容

## 资源配置对比

| 配置项 | API服务 | Worker服务 |
|--------|---------|------------|
| CPU | 0.5 核 | 1 核 |
| 内存 | 512Mi | 1Gi |
| 最小实例 | 1 | 1 |
| 最大实例 | 10 | 20 |
| 并发数 | 80 | 1 |
| 超时时间 | 60s | 600s |
| 认证 | 不需要 | 需要 (内部调用) |

## 部署步骤

### 1. 构建和部署 API 服务

```bash
# 从项目根目录执行
gcloud builds submit \
  --config=services/siterank/cloudbuild-api-preview.yaml \
  --project=${GCP_PROJECT_ID}
```

### 2. 构建和部署 Worker 服务

```bash
# 从项目根目录执行
gcloud builds submit \
  --config=services/siterank/cloudbuild-worker-preview.yaml \
  --project=${GCP_PROJECT_ID}
```

### 3. 验证部署

```bash
# 检查 API 服务
gcloud run services describe siterank-api-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 检查 Worker 服务
gcloud run services describe siterank-worker-preview \
  --region=asia-northeast1 \
  --project=${GCP_PROJECT_ID}

# 测试 API 健康检查
curl https://siterank-api-preview-[hash].a.run.app/health
```

## 环境变量

两个服务共享以下环境变量（通过Cloud Run设置）：

- `ENV=preview`
- `SERVICE_MODE=api` 或 `worker`
- `DATABASE_URL` (从Secret Manager)
- `REDIS_URL`
- `BROWSER_EXEC_URL`
- `BILLING_API_URL`
- `GCP_PROJECT_ID`

## Pub/Sub 配置

Worker服务需要订阅 `evaluation-tasks` 主题：

```bash
# 创建订阅（如果不存在）
gcloud pubsub subscriptions create siterank-worker-preview-sub \
  --topic=evaluation-tasks \
  --ack-deadline=600 \
  --push-endpoint=https://siterank-worker-preview-[hash].a.run.app/pubsub/evaluation \
  --project=${GCP_PROJECT_ID}
```

## 监控指标

### API 服务关键指标
- 请求延迟 P95: 目标 <100ms
- 请求成功率: 目标 >99%
- 实例数: 1-10

### Worker 服务关键指标
- 任务处理时间: 10-30秒
- 任务成功率: 目标 >95%
- 队列积压: 目标 <10个任务
- 实例数: 根据队列长度自动扩缩容

## 回滚方案

如果部署后出现问题，可以快速回滚：

```bash
# 回滚 API 服务到上一个版本
gcloud run services update-traffic siterank-api-preview \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1

# 回滚 Worker 服务到上一个版本
gcloud run services update-traffic siterank-worker-preview \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-northeast1
```

## 成本优化

### 预期成本变化
- **优化前**: 单服务 1 CPU + 1Gi 内存，持续运行
- **优化后**:
  - API服务: 0.5 CPU + 512Mi，按需扩缩容
  - Worker服务: 1 CPU + 1Gi，按任务量扩缩容
- **预期节省**: ~30% 成本

### 费用监控
```bash
# 查看 API 服务费用
gcloud run services describe siterank-api-preview \
  --region=asia-northeast1 \
  --format="value(status.traffic)"

# 查看 Worker 服务费用
gcloud run services describe siterank-worker-preview \
  --region=asia-northeast1 \
  --format="value(status.traffic)"
```

## 故障排查

### API 服务无响应
1. 检查日志: `gcloud run logs read siterank-api-preview --limit=50`
2. 检查健康检查: `curl https://[api-url]/health`
3. 检查数据库连接

### Worker 服务不处理任务
1. 检查 Pub/Sub 订阅配置
2. 检查 Worker 日志
3. 检查队列积压: `gcloud pubsub subscriptions describe siterank-worker-preview-sub`

## 生产环境部署

生产环境部署需要：
1. 修改 substitutions 中的环境标识
2. 更新 VPC connector 名称
3. 调整实例数限制
4. 配置告警规则

```bash
# 生产环境部署命令（示例）
gcloud builds submit \
  --config=services/siterank/cloudbuild-api-prod.yaml \
  --substitutions=_ENV=production,_MIN_INSTANCES=2,_MAX_INSTANCES=20
```

## 相关文档

- [API+Worker架构设计](../../docs/ArchitectureOpV1/API_WORKER_ARCHITECTURE.md)
- [完整优化方案](../../docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md)
- [服务清单](../../docs/ArchitectureOpV1/02-SERVICE-INVENTORY.md)
