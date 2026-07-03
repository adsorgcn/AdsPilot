# Siterank 服务

## 概述

Siterank 是 gm 项目的网站评分服务，负责评估网站质量、可信度和广告适配性。本服务使用多维度评分算法，为 Offer 评估提供关键数据支持。

### 核心功能

- ✅ **网站评分**: 综合评估网站质量 (0-100 分)
- ✅ **域名分析**: 域名年龄、历史、信誉
- ✅ **内容分析**: 内容质量、原创性、相关性
- ✅ **技术分析**: 性能、安全性、SEO
- ✅ **流量分析**: 访问量、来源、用户行为
- ✅ **品牌识别**: 自动识别品牌名称
- ✅ **国家检测**: 识别网站目标国家
- ✅ **缓存优化**: 评分结果缓存

---

## 技术栈

- **语言**: Go 1.25.1
- **框架**: Chi Router
- **数据库**: Cloud SQL PostgreSQL (代码内嵌 DDL)
- **缓存**: Redis (gm-redis)
- **外部 API**: 
  - Whois API (域名信息)
  - SimilarWeb API (流量数据)
  - Google Safe Browsing API (安全检查)
- **部署**: GCP Cloud Run (asia-northeast1)
- **认证**: Supabase JWT

---

## 评分算法

### 评分维度

```
总分 (0-100) = 加权平均
├── 域名质量 (25%)
│   ├── 域名年龄 (10%)
│   ├── 域名历史 (8%)
│   └── 域名信誉 (7%)
├── 内容质量 (30%)
│   ├── 内容原创性 (12%)
│   ├── 内容相关性 (10%)
│   └── 内容完整性 (8%)
├── 技术质量 (20%)
│   ├── 页面性能 (8%)
│   ├── 安全性 (7%)
│   └── SEO 优化 (5%)
└── 流量质量 (25%)
    ├── 访问量 (10%)
    ├── 流量来源 (8%)
    └── 用户行为 (7%)
```

### 评分等级

```
90-100: 优秀 (Excellent)
80-89:  良好 (Good)
70-79:  中等 (Fair)
60-69:  及格 (Pass)
0-59:   不及格 (Fail)
```

### 算法示例

```go
// 计算总分
func CalculateSiterank(site *Site) float64 {
    domainScore := calculateDomainScore(site)      // 25%
    contentScore := calculateContentScore(site)    // 30%
    technicalScore := calculateTechnicalScore(site) // 20%
    trafficScore := calculateTrafficScore(site)    // 25%
    
    totalScore := (domainScore * 0.25) +
                  (contentScore * 0.30) +
                  (technicalScore * 0.20) +
                  (trafficScore * 0.25)
    
    return math.Round(totalScore * 100) / 100
}

// 域名评分
func calculateDomainScore(site *Site) float64 {
    ageScore := calculateAgeScore(site.DomainAge)
    historyScore := calculateHistoryScore(site.DomainHistory)
    reputationScore := calculateReputationScore(site.Domain)
    
    return (ageScore * 0.4) + (historyScore * 0.3) + (reputationScore * 0.3)
}
```

---

## 本地开发

### 前置条件

- Go 1.25+
- Docker (可选)
- GCP 服务账号密钥: `secrets/gcp_codex_dev.json`
- 访问 Secret Manager 的权限

### 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# 外部 API
WHOIS_API_KEY=...                         # 可选
SIMILARWEB_BASE_URL=https://data.similarweb.com/api/v1/data
GOOGLE_SAFE_BROWSING_API_KEY=...          # 可选

# Browser-Exec 服务
BROWSER_EXEC_SERVICE_URL=https://browser-exec-preview-...

# Supabase
SUPABASE_URL=https://YOUR_SUPABASE_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
```

### 启动服务

```bash
# 进入服务目录
cd services/siterank

# 安装依赖
go mod download

# 运行服务
go run main.go
```

### 数据库初始化

Siterank 使用代码内嵌 DDL 模式，服务启动时自动创建表：

```go
// internal/handlers/ddl.go
func EnsureAllTables(ctx context.Context, db *sql.DB) error {
    // 自动创建所有表
}
```

**表结构**:
- `domain_cache` - 域名缓存
- `domain_country_cache` - 域名国家缓存
- `SiterankHistory` - 评分历史
- `User` - User stub 表

---

## API 端点

### 认证

所有 API 端点需要 Supabase JWT Token：

```bash
Authorization: Bearer <supabase_jwt_token>
```

### 主要端点

#### 网站评分

```bash
# 评估网站
POST /api/v1/siterank/evaluate
Content-Type: application/json

{
  "url": "https://example.com",
  "forceRefresh": false
}

Response 200:
{
  "url": "https://example.com",
  "domain": "example.com",
  "score": 85.5,
  "grade": "Good",
  "brandName": "Example",
  "country": "US",
  "breakdown": {
    "domainScore": 90.0,
    "contentScore": 85.0,
    "technicalScore": 82.0,
    "trafficScore": 88.0
  },
  "evaluatedAt": "2025-10-08T10:00:00Z",
  "cached": false
}
```

#### 批量评估

```bash
# 批量评估多个网站
POST /api/v1/siterank/batch
Content-Type: application/json

{
  "urls": [
    "https://example1.com",
    "https://example2.com",
    "https://example3.com"
  ]
}

Response 200:
{
  "results": [
    {
      "url": "https://example1.com",
      "score": 85.5,
      "grade": "Good"
    },
    ...
  ]
}
```

#### 域名信息

```bash
# 获取域名信息
GET /api/v1/siterank/domain/{domain}

Response 200:
{
  "domain": "example.com",
  "age": 25,  // 年
  "registrar": "GoDaddy",
  "country": "US",
  "reputation": "high"
}
```

#### 评分历史

```bash
# 获取评分历史
GET /api/v1/siterank/history/{domain}

Response 200:
{
  "domain": "example.com",
  "history": [
    {
      "score": 85.5,
      "evaluatedAt": "2025-10-08T10:00:00Z"
    },
    {
      "score": 84.2,
      "evaluatedAt": "2025-09-08T10:00:00Z"
    }
  ]
}
```

#### 健康检查

```bash
# 健康检查
GET /health

# Prometheus 指标
GET /metrics
```

---

## 缓存策略

### 评分缓存

```go
// 缓存键设计
const (
    DomainCacheKey = "siterank:domain:%s"
    ScoreCacheKey  = "siterank:score:%s"
    CacheTTL       = 24 * time.Hour  // 24 小时
)

// 缓存逻辑
func (s *Service) GetScore(domain string) (*Score, error) {
    // 1. 检查缓存
    if cached, err := s.cache.Get(ScoreCacheKey(domain)); err == nil {
        return cached, nil
    }
    
    // 2. 计算评分
    score := s.calculateScore(domain)
    
    // 3. 写入缓存
    s.cache.Set(ScoreCacheKey(domain), score, CacheTTL)
    
    return score, nil
}
```

### 强制刷新

```bash
# 强制重新评估（跳过缓存）
POST /api/v1/siterank/evaluate
{
  "url": "https://example.com",
  "forceRefresh": true
}
```

---

## 配置说明

### 评分权重配置

```yaml
# config.yaml
scoring:
  weights:
    domain: 0.25
    content: 0.30
    technical: 0.20
    traffic: 0.25
  
  thresholds:
    excellent: 90
    good: 80
    fair: 70
    pass: 60
```

### 缓存配置

```yaml
cache:
  ttl: 86400  # 24 小时
  maxSize: 10000
```

### API 配置

```yaml
external_apis:
  whois:
    enabled: true
    timeout: 10s
  similarweb:
    enabled: true
    timeout: 15s
  safe_browsing:
    enabled: true
    timeout: 5s
```

---

## 部署

### Preview 环境

```bash
# 推送到 main 分支自动触发部署
git push origin main

# 服务名: siterank-preview
```

### 生产环境

```bash
# 推送到 production 分支自动触发部署
git push origin production

# 服务名: siterank
```

---

## 故障排查

### 常见问题

#### 1. 评分结果不准确

```bash
# 检查外部 API 状态
curl https://api.whois.com/health
curl https://api.similarweb.com/health

# 查看评分日志
gcloud run services logs read siterank-preview \
  --filter="textPayload:scoring" \
  --limit=100

# 强制刷新评分
POST /api/v1/siterank/evaluate?forceRefresh=true
```

#### 2. 缓存问题

```bash
# 检查 Redis 连接
redis-cli -h <redis-host> ping

# 清除特定域名缓存
redis-cli DEL "siterank:score:example.com"

# 清除所有缓存
redis-cli FLUSHDB
```

#### 3. 外部 API 超时

```bash
# 增加超时时间
export API_TIMEOUT=30s

# 检查网络延迟
curl -w "@curl-format.txt" -o /dev/null -s https://api.whois.com
```

---

## 开发指南

### 代码结构

```
services/siterank/
├── api/                    # API 处理器
│   ├── handlers.go
│   └── routes.go
├── common/                 # 通用工具
│   ├── cache.go
│   └── http.go
├── internal/              # 内部逻辑
│   ├── domain/           # 域名分析
│   ├── content/          # 内容分析
│   ├── technical/        # 技术分析
│   ├── traffic/          # 流量分析
│   └── scoring/          # 评分算法
├── scripts/               # 脚本工具
├── main.go                # 主入口
└── openapi.yaml           # API 规范
```

### 添加新的评分维度

```go
// 1. 定义新维度
type SecurityScore struct {
    SSLScore      float64
    HeadersScore  float64
    VulnScore     float64
}

// 2. 实现计算逻辑
func calculateSecurityScore(site *Site) float64 {
    sslScore := checkSSL(site.URL)
    headersScore := checkSecurityHeaders(site.URL)
    vulnScore := checkVulnerabilities(site.URL)
    
    return (sslScore * 0.4) + (headersScore * 0.3) + (vulnScore * 0.3)
}

// 3. 集成到总分计算
func CalculateSiterank(site *Site) float64 {
    // ... 现有维度
    securityScore := calculateSecurityScore(site)  // 新维度
    
    totalScore := (domainScore * 0.20) +
                  (contentScore * 0.25) +
                  (technicalScore * 0.15) +
                  (trafficScore * 0.20) +
                  (securityScore * 0.20)  // 新维度权重
    
    return totalScore
}
```

### 测试

```bash
# 运行所有测试
go test ./...

# 运行评分算法测试
go test ./internal/scoring/...

# 生成覆盖率报告
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

---

## 性能优化

### 缓存优化

- 评分结果缓存 24 小时
- 域名信息缓存 7 天
- 国家信息缓存 30 天

### 并发优化

- 批量评估使用 goroutine 池
- 限制并发数量避免 API 限流
- 使用 context 控制超时

### API 调用优化

- 优先使用缓存数据
- 失败时使用降级策略
- 异步更新缓存

---

## 监控和告警

### Prometheus 指标

- `siterank_evaluations_total`: 评估总数
- `siterank_score_distribution`: 评分分布
- `siterank_cache_hit_rate`: 缓存命中率
- `siterank_api_calls_total`: 外部 API 调用总数
- `siterank_api_errors_total`: 外部 API 错误总数

### 告警规则

- 缓存命中率: <80%
- 外部 API 错误率: >10%
- 评估超时率: >5%

---

## 算法优化建议

### 当前算法优势

- ✅ 多维度综合评估
- ✅ 权重可配置
- ✅ 缓存优化性能

### 未来优化方向

- 🔄 机器学习模型
- 🔄 实时流量数据
- 🔄 用户反馈集成
- 🔄 行业特定评分

---

## 贡献指南

### 提交代码

1. 创建功能分支
2. 编写代码和测试
3. 确保评分算法准确性
4. 创建 Pull Request

### 提交信息规范

- `feat(scoring)`: 评分算法改进
- `feat(cache)`: 缓存优化
- `fix(api)`: API 修复
- `perf`: 性能优化

---

## 相关资源

- [OpenAPI 规范](./openapi.yaml)
- [架构分析报告](../../docs/ArchitectureReviewV1/P1-FUNCTIONAL-SERVICES-ANALYSIS.md)
- [评分算法文档](./docs/scoring-algorithm.md)

---

**最后更新**: 2025-10-08  
**维护者**: 后端团队  
**算法版本**: 1.0  
**状态**: ✅ 生产就绪
# CI/CD test trigger Fri Oct 17 01:55:01 CST 2025
# CI/CD test trigger Fri Oct 17 01:55:22 CST 2025
# Build trigger test 1760637648
# Deployment verification test 1760638349
# Full deployment test with API+Worker split architecture
