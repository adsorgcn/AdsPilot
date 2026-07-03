# BFF Service (Backend For Frontend)

BFF Service聚合多个微服务的数据，为前端提供优化的Dashboard API。

## 功能特性

### Dashboard聚合API (BE-069~072)

- **并发调用5个微服务**：Offer, Siterank, Billing, Adscenter, Useractivity
- **Redis缓存**：5分钟TTL，减少后端服务压力
- **部分失败容错**：容忍<3个服务失败，仍能返回部分数据
- **Authorization透传**：将用户认证信息传递给下游服务

## Redis Secret Manager集成

### 配置方式（按优先级）

1. **REDIS_URL** - 直接配置Redis地址
2. **REDIS_URL_SECRET_NAME** - 从Secret Manager获取
3. **默认值** - `localhost:6379`

### 使用示例

```bash
# 方式1：直接配置
REDIS_URL=redis://10.0.0.1:6379

# 方式2：Secret Manager
REDIS_URL_SECRET_NAME=projects/PROJECT_ID/secrets/redis-url/versions/latest
```

### 创建Secret

```bash
# 创建Redis URL secret
gcloud secrets create redis-url \
  --replication-policy="automatic" \
  --data-file=- <<< "redis://10.0.0.1:6379"

# 授予服务账号访问权限
gcloud secrets add-iam-policy-binding redis-url \
  --member="serviceAccount:bff-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 测试

```bash
# 运行所有测试
go test ./... -v

# 配置包测试（100%通过）
go test ./internal/config -v
```

