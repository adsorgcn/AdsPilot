# Recommendations 服务

## 概述

Recommendations 服务是 gm 项目的推荐和风险检测服务，负责提供关键词建议、品牌词风险检测等功能。本服务与 adscenter 解耦，减少 Google Ads API 调用，提高系统效率。

### 核心功能

- ✅ **关键词推荐**: 智能关键词建议
- ✅ **品牌词风险检测**: 检测关键词是否包含品牌词
- ✅ **品牌档案管理**: 管理品牌名称和别名
- ✅ **离线审计**: 批量关键词审计
- ✅ **BigQuery 集成**: 从 BigQuery 导出数据
- ✅ **Firestore 缓存**: UI 缓存优化
- ✅ **分片处理**: 支持大规模数据处理

---

## 技术栈

- **语言**: Go 1.25.1
- **框架**: Chi Router
- **数据库**: Cloud SQL PostgreSQL (可选)
- **缓存**: Firestore (可选)
- **数据仓库**: BigQuery (可选)
- **部署**: GCP Cloud Run (asia-northeast1)
- **认证**: Supabase JWT

---

## 本地开发

### 前置条件

- Go 1.25+
- Docker (可选)
- GCP 服务账号密钥: `secrets/gcp_codex_dev.json`
- 访问 Secret Manager 的权限

### 环境变量

```bash
# 数据库 (可选)
DATABASE_URL=postgresql://...

# Firestore (可选)
FIRESTORE_ENABLED=1
GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID}

# Browser-Exec 服务 (可选)
BROWSER_EXEC_URL=https://browser-exec-preview-...
BROWSER_INTERNAL_TOKEN=...

# BigQuery (可选)
BQ_ENABLED=1
BQ_PROJECT_ID=${GCP_PROJECT_ID}
BQ_DATASET=ads_export
BQ_TABLE=keywords
BQ_KEYWORD_COL=keyword_text

# Supabase
SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
```

### 启动服务

```bash
# 进入服务目录
cd services/recommendations

# 安装依赖
go mod download

# 运行服务
go run main.go
```

---

## API 端点

### 认证

所有 API 端点需要 Supabase JWT Token：

```bash
Authorization: Bearer <supabase_jwt_token>
```

### 品牌词风险检测

#### 检测关键词

```bash
POST /api/v1/recommend/keywords/brand-check
Content-Type: application/json

{
  "seedDomain": "example.com",
  "keywords": ["example shoes", "buy shoes", "nike shoes"],
  "locale": "en-US",
  "landingUrl": "https://example.com/shoes"
}

Response 200:
{
  "items": [
    {
      "keyword": "example shoes",
      "containsBrand": false,
      "method": "none",
      "severity": "none"
    },
    {
      "keyword": "nike shoes",
      "containsBrand": true,
      "matchedAlias": "nike",
      "method": "exact",
      "score": 1.0,
      "severity": "error"
    }
  ]
}
```

#### 获取品牌档案

```bash
GET /api/v1/recommend/keywords/brand-profile?seedDomain=example.com

Response 200:
{
  "seedDomain": "example.com",
  "aliases": ["example", "example.com", "example shoes"],
  "updatedAt": "2025-10-08T10:00:00Z"
}
```

#### 获取检测结果

```bash
GET /api/v1/recommend/keywords/brand-results?seedDomain=example.com&limit=50&severity=error&containsBrand=true

Response 200:
{
  "items": [
    {
      "keyword": "nike shoes",
      "containsBrand": true,
      "matchedAlias": "nike",
      "severity": "error",
      "checkedAt": "2025-10-08T10:00:00Z"
    }
  ],
  "next": "cursor_token"
}
```

### 离线审计

#### 触发离线审计

```bash
POST /api/v1/recommend/internal/offline/brand-audit
X-Service-Token: <internal_token>
Content-Type: application/json

{
  "seedDomain": "example.com",
  "accountId": "123-456-7890",
  "keywords": ["keyword1", "keyword2"],  // 可选，不提供则从 BigQuery 拉取
  "days": 30,
  "limit": 10000,
  "shard": 0,        // 分片编号
  "totalShards": 4   // 总分片数
}

Response 202:
{
  "status": "accepted",
  "jobId": "job-123",
  "message": "Audit job started"
}
```

### 健康检查

```bash
# 健康检查
GET /health

# Prometheus 指标
GET /metrics
```

---

## 品牌词检测算法

### 检测方法

```
1. Exact Match (精确匹配)
   - 关键词完全匹配品牌名称或别名
   - 示例: "nike" 匹配 "nike"
   - Severity: error

2. Fuzzy Match (模糊匹配)
   - 关键词包含品牌名称或别名
   - 示例: "nike shoes" 包含 "nike"
   - Severity: warn

3. No Match (无匹配)
   - 关键词不包含品牌词
   - Severity: none
```

### 评分规则

```go
// 评分逻辑
func calculateBrandScore(keyword, brand string) float64 {
    if keyword == brand {
        return 1.0  // 完全匹配
    }
    
    if strings.Contains(keyword, brand) {
        return 0.8  // 包含匹配
    }
    
    // Levenshtein 距离
    distance := levenshtein(keyword, brand)
    similarity := 1.0 - (float64(distance) / float64(max(len(keyword), len(brand))))
    
    if similarity > 0.8 {
        return similarity  // 相似匹配
    }
    
    return 0.0  // 无匹配
}
```

---

## 数据持久化

### 数据库表 (可选)

```sql
-- 品牌档案
CREATE TABLE brand_profile (
    seed_domain VARCHAR(255) PRIMARY KEY,
    aliases JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 关键词风险结果
CREATE TABLE keyword_risk_results (
    id BIGSERIAL PRIMARY KEY,
    seed_domain VARCHAR(255) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    contains_brand BOOLEAN NOT NULL,
    matched_alias VARCHAR(255),
    method VARCHAR(50),
    score FLOAT,
    severity VARCHAR(50),
    checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_seed_domain (seed_domain),
    INDEX idx_severity (severity)
);
```

### Firestore 缓存 (可选)

```
users/{uid}/recommendations/brand-check/{seedDomain}
├── items: []
├── updatedAt: timestamp
└── ttl: 3600
```

---

## BigQuery 集成

### 数据导出

```sql
-- BigQuery 导出表结构
CREATE TABLE `project.dataset.keywords` (
    keyword_text STRING,
    account_id STRING,
    campaign_id STRING,
    impressions INT64,
    clicks INT64,
    cost FLOAT64,
    date DATE
);
```

### 查询示例

```go
// 从 BigQuery 拉取关键词
func fetchKeywordsFromBQ(accountID string, days int) ([]string, error) {
    query := fmt.Sprintf(`
        SELECT DISTINCT keyword_text
        FROM `+"`%s.%s.%s`"+`
        WHERE account_id = @accountId
          AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
        LIMIT 10000
    `, projectID, dataset, table)
    
    // 执行查询
    // ...
}
```

---

## 分片处理

### 为什么需要分片？

- 处理大规模数据（百万级关键词）
- 避免单个任务超时
- 提高并发处理能力

### 分片策略

```bash
# 创建 4 个分片任务
for shard in 0 1 2 3; do
  curl -X POST /api/v1/recommend/internal/offline/brand-audit \
    -H "X-Service-Token: $TOKEN" \
    -d "{
      \"seedDomain\": \"example.com\",
      \"shard\": $shard,
      \"totalShards\": 4
    }"
done
```

### 分片逻辑

```go
// 分片处理
func processKeywords(keywords []string, shard, totalShards int) []string {
    var shardKeywords []string
    
    for i, keyword := range keywords {
        if i % totalShards == shard {
            shardKeywords = append(shardKeywords, keyword)
        }
    }
    
    return shardKeywords
}
```

---

## 部署

### Preview 环境

```bash
# 推送到 main 分支自动触发部署
git push origin main

# 服务名: recommendations-preview
```

### 生产环境

```bash
# 推送到 production 分支自动触发部署
git push origin production

# 服务名: recommendations
```

### 定时任务

```bash
# 创建单个定时任务
./deployments/scripts/create-reco-scheduler.sh

# 创建分片定时任务
./deployments/scripts/create-reco-scheduler-sharded.sh 4  # 4 个分片
```

---

## 故障排查

### 常见问题

#### 1. BigQuery 查询失败

```bash
# 检查 BigQuery 权限
gcloud projects get-iam-policy ${GCP_PROJECT_ID}

# 测试查询
bq query --use_legacy_sql=false \
  "SELECT COUNT(*) FROM \`project.dataset.keywords\`"
```

#### 2. Firestore 写入失败

```bash
# 检查 Firestore 配置
gcloud firestore databases describe --project=${GCP_PROJECT_ID}

# 检查权限
gcloud projects get-iam-policy ${GCP_PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.role:roles/datastore.user"
```

#### 3. 离线审计超时

```bash
# 增加超时时间
gcloud run services update recommendations-preview \
  --timeout=900 \
  --region=asia-northeast1

# 使用分片处理
./deployments/scripts/create-reco-scheduler-sharded.sh 8
```

---

## 开发指南

### 代码结构

```
services/recommendations/
├── internal/              # 内部逻辑
│   ├── brand/            # 品牌检测
│   ├── keywords/         # 关键词处理
│   └── audit/            # 离线审计
├── admin.go               # 管理端点
├── main.go                # 主入口
└── openapi.yaml           # API 规范
```

### 添加新的检测方法

```go
// 1. 定义新方法
const (
    MethodExact  = "exact"
    MethodFuzzy  = "fuzzy"
    MethodSemantic = "semantic"  // 新方法
)

// 2. 实现检测逻辑
func checkSemantic(keyword, brand string) (bool, float64) {
    // 使用语义相似度模型
    embedding1 := getEmbedding(keyword)
    embedding2 := getEmbedding(brand)
    similarity := cosineSimilarity(embedding1, embedding2)
    
    return similarity > 0.7, similarity
}

// 3. 集成到主检测流程
func checkBrand(keyword, brand string) *BrandCheckResult {
    // ... 现有检测
    
    // 新方法
    if matched, score := checkSemantic(keyword, brand); matched {
        return &BrandCheckResult{
            ContainsBrand: true,
            Method:        MethodSemantic,
            Score:         score,
            Severity:      "warn",
        }
    }
    
    return &BrandCheckResult{ContainsBrand: false}
}
```

### 测试

```bash
# 运行所有测试
go test ./...

# 运行品牌检测测试
go test ./internal/brand/...

# 生成覆盖率报告
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## 性能优化

### 缓存策略

- 品牌档案缓存: 24 小时
- 检测结果缓存: 1 小时
- Firestore UI 缓存: 1 小时

### 批量处理

- 批量检测: 1000 个关键词/批次
- 并发处理: 10 个 goroutine
- 分片处理: 支持任意分片数

### BigQuery 优化

- 使用分区表
- 限制查询范围
- 缓存查询结果

---

## 监控和告警

### Prometheus 指标

- `recommendations_checks_total`: 检测总数
- `recommendations_brand_matches_total`: 品牌匹配总数
- `recommendations_audit_duration_seconds`: 审计时长
- `recommendations_bq_queries_total`: BigQuery 查询总数

### 告警规则

- 品牌匹配率异常: >50% 或 <1%
- BigQuery 查询失败率: >10%
- 审计超时率: >5%

---

## 贡献指南

### 提交代码

1. 创建功能分支
2. 编写代码和测试
3. 确保检测准确性
4. 创建 Pull Request

### 提交信息规范

- `feat(brand)`: 品牌检测功能
- `feat(audit)`: 审计功能
- `fix(bq)`: BigQuery 修复
- `perf`: 性能优化

---

## 相关资源

- [OpenAPI 规范](./openapi.yaml)
- [架构分析报告](../../docs/ArchitectureReviewV1/P1-FUNCTIONAL-SERVICES-ANALYSIS.md)
- [定时任务脚本](../../deployments/scripts/)

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队  
**状态**: ✅ 生产就绪

