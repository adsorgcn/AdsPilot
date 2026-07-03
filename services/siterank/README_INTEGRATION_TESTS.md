# Siterank 服务集成测试指南

## 概述

Siterank 服务的集成测试直接连接到预发环境进行实际测试，验证评分算法、数据库操作和API端点的正确性。

## 环境配置

### 必需的环境变量

```bash
# Supabase 数据库连接（预发环境）
export DATABASE_URL="postgres://postgres.YOUR_SUPABASE_PROJECT:<PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Siterank 服务URL（预发环境）
export SITERANK_SERVICE_URL="https://siterank-preview-yt54xvsg5q-an.a.run.app"

# 测试用户Token（可选）
export TEST_USER_TOKEN="your-test-token"
```

### 获取数据库密码

从 Secret Manager 获取 Supabase 密码：

```bash
gcloud secrets versions access latest \
  --secret="SUPABASE_DB_PASSWORD" \
  --project=${GCP_PROJECT_ID}
```

## 运行测试

### 运行所有集成测试

```bash
cd services/siterank
go test -v -tags=integration ./...
```

### 运行特定测试

```bash
# 测试健康检查
go test -v -tags=integration -run TestSiterankServiceHealth

# 测试数据库操作
go test -v -tags=integration -run TestSiterankDatabaseOperations

# 测试评分逻辑
go test -v -tags=integration -run TestEvaluationScoring

# 测试错误处理
go test -v -tags=integration -run TestErrorHandling
```

### 跳过集成测试（本地开发）

```bash
# 使用 -short 标志跳过集成测试
go test -v -short ./...
```

## 测试覆盖范围

### 1. 域模型测试 (`domain/siterank_test.go`)
- ✅ 创建分析记录
- ✅ 状态转换（pending → running → completed/failed）
- ✅ 分数设置和更新

### 2. 集成测试 (`integration_test.go`)
- ✅ 服务健康检查
- ✅ 数据库 CRUD 操作
- ✅ 评分算法验证
- ✅ 完整工作流测试
- ✅ 多分析并发处理
- ✅ 品牌提取逻辑
- ✅ SimilarWeb 缓存
- ✅ Token 消耗追踪
- ✅ 错误处理

### 3. 中间件测试 (`middleware/ratelimit_test.go`)
- ✅ 速率限制逻辑
- ✅ 并发请求处理

### 4. SimilarWeb 缓存测试 (`similarweb/cache_test.go`)
- ✅ 缓存命中/未命中
- ✅ 缓存过期

## 测试架构

```
集成测试架构:
┌─────────────────────────────────────┐
│   集成测试 (integration_test.go)    │
│   - 使用真实数据库连接                │
│   - 调用预发环境API                   │
│   - 验证端到端流程                    │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Siterank Service (预发环境)        │
│   - evaluation.Service               │
│   - browser-exec 集成                │
│   - SimilarWeb 集成                  │
│   - AI 评估集成                       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   Supabase PostgreSQL (预发环境)     │
│   - offer_evaluations 表             │
│   - domain_cache 表                  │
│   - User 表                          │
└─────────────────────────────────────┘
```

## 评分算法测试

### 基础评估 (1 Token)
- 浏览器访问 URL
- 提取品牌名称
- 获取 SimilarWeb 数据
- 返回基础评分

### AI 评估 (3 Tokens = 1 Basic + 2 AI)
- 在基础评估基础上
- 调用 Gemini AI
- 生成推荐分数和原因
- 提供竞争对手和预算建议

### 测试用例

```go
// 基础评估测试
func TestBasicEvaluation(t *testing.T) {
    // 1. 创建评估请求
    // 2. 验证浏览器访问成功
    // 3. 验证品牌提取
    // 4. 验证 SimilarWeb 数据
    // 5. 验证评分在合理范围
}

// AI 评估测试
func TestAIEvaluation(t *testing.T) {
    // 1. 先完成基础评估
    // 2. 调用 AI 评估
    // 3. 验证推荐分数
    // 4. 验证 AI 原因列表
    // 5. 验证竞争对手分析
}
```

## 故障排查

### 数据库连接失败

```bash
# 检查网络连接
ping aws-1-ap-northeast-1.pooler.supabase.com

# 验证密码
gcloud secrets versions access latest --secret="SUPABASE_DB_PASSWORD"

# 测试数据库连接
psql "$DATABASE_URL" -c "SELECT version();"
```

### 服务不可用

```bash
# 检查服务状态
curl https://siterank-preview-yt54xvsg5q-an.a.run.app/health

# 查看服务日志
gcloud run services logs read siterank-preview \
  --region=asia-northeast1 \
  --limit=50
```

### 测试超时

某些测试可能需要较长时间（如 AI 评估），可以增加超时：

```bash
go test -v -tags=integration -timeout 5m ./...
```

## 持续集成

在 CI 环境中运行集成测试：

```yaml
# .github/workflows/test-siterank.yml
- name: Run Integration Tests
  env:
    DATABASE_URL: ${{ secrets.SUPABASE_DATABASE_URL }}
    SITERANK_SERVICE_URL: https://siterank-preview-yt54xvsg5q-an.a.run.app
  run: |
    cd services/siterank
    go test -v -tags=integration ./...
```

## 最佳实践

1. **数据清理**: 每个测试后清理测试数据
2. **唯一标识**: 使用时间戳生成唯一测试ID
3. **幂等性**: 测试应该可以重复运行
4. **超时处理**: 设置合理的超时时间
5. **错误检查**: 验证错误处理逻辑
6. **并发测试**: 测试并发场景下的数据一致性

## 测试覆盖率目标

- **域模型**: 100% (已达成)
- **评分算法**: >80%
- **API 端点**: >70%
- **错误处理**: >60%

## 参考文档

- [架构设计](../../docs/SupabaseGo/MustKnowV6.md)
- [Monorepo 构建最佳实践](../../docs/monorepo-build-best-practices.md)
- [Siterank 服务架构](./README.md)
