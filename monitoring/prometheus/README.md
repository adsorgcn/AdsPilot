# Google-Monetize Monitoring with Cloud Monitoring

本项目使用 **Google Cloud Monitoring** 来监控 Cloud Run 服务的业务指标。

## 架构概览

```
Cloud Run Services (billing, adscenter, offer)
    ↓ (expose /metrics endpoint with Prometheus format)
Manual scraping or viewing via /metrics
    ↓
Cloud Monitoring Metrics Explorer
    ↓ (query with MQL)
Grafana / Cloud Console Dashboards
```

**重要说明：**
- Cloud Run **没有自动采集 /metrics 的功能**
- /metrics 端点主要用于：
  1. **手动查看**：curl SERVICE_URL/metrics
  2. **Grafana 直接采集**：配置 Prometheus data source 指向 Cloud Run /metrics
  3. **开发调试**：本地测试指标是否正确

## 为什么不用 Google Managed Prometheus (GMP)?

**GMP 主要为 GKE 设计**，不适用于 Cloud Run：
- GMP 需要 Kubernetes 的 PodMonitoring 资源
- Cloud Run 无法直接集成 GMP
- 对于 100 用户规模，**直接用 /metrics + Grafana 更简单**

## 目录结构

```
monitoring/
├── prometheus/
│   ├── README.md           # 本文档
│   ├── alerts/             # Cloud Monitoring 告警策略
│   │   ├── business-alerts.yaml      # 业务核心指标告警
│   │   ├── gateway-alerts.yaml       # Gateway中间件告警
│   │   ├── high-error-rate.yaml
│   │   ├── high-token-refund-rate.yaml
│   │   └── low-ad-ctr.yaml
│   ├── dashboards/         # Grafana dashboard 配置
│   │   ├── billing-overview.json
│   │   ├── ad-performance.json
│   │   └── gateway-overview.json     # Gateway监控面板
│   └── promql-queries.md   # PromQL 查询示例
└── scripts/
    └── deploy-monitoring.sh # 部署脚本
```

## 可用指标

### Billing 指标 (16个)

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `gm_billing_tokens_consumed_total` | Counter | user_id, operation | Token 消耗总量 |
| `gm_billing_tokens_reserved_total` | Counter | user_id | Token 预留总量 |
| `gm_billing_tokens_committed_total` | Counter | user_id, operation | Token 提交总量 |
| `gm_billing_tokens_refunded_total` | Counter | user_id, reason | Token 退款总量 |
| `gm_billing_active_subscribers` | Gauge | plan | 活跃订阅数 |

### Offer 指标 (5个)

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `gm_offer_offers_created_total` | Counter | user_id, type | 创建的 Offer 数量 |
| `gm_offer_offers_completed_total` | Counter | user_id, type | 完成的 Offer 数量 |
| `gm_offer_offers_failed_total` | Counter | user_id, type, reason | 失败的 Offer 数量 |
| `gm_offer_offer_conversion_rate` | Gauge | type | Offer 转化率 |
| `gm_offer_offer_value_total` | Counter | user_id, type | Offer 总价值（分） |

### Ad 指标 (6个)

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `gm_adscenter_ads_created_total` | Counter | user_id, campaign_id, platform | 创建的广告数 |
| `gm_adscenter_ads_active` | Gauge | user_id, platform | 活跃广告数 |
| `gm_adscenter_ad_impressions_total` | Counter | user_id, campaign_id, platform | 广告展示次数 |
| `gm_adscenter_ad_clicks_total` | Counter | user_id, campaign_id, platform | 广告点击次数 |
| `gm_adscenter_ad_conversions_total` | Counter | user_id, campaign_id, platform | 广告转化次数 |
| `gm_adscenter_ad_spend_total` | Counter | user_id, campaign_id, platform | 广告花费（分） |

### Gateway Middleware 指标 (25个)

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `gateway_jwt_validation_duration_seconds` | Histogram | - | JWT验证延迟分布 |
| `gateway_jwt_validation_total` | Counter | status | JWT验证总数 |
| `gateway_jwt_validation_success_total` | Counter | - | JWT验证成功数 |
| `gateway_jwt_validation_failed_total` | Counter | reason | JWT验证失败数 |
| `gateway_permission_check_duration_seconds` | Histogram | - | 权限检查延迟分布 |
| `gateway_permission_check_total` | Counter | status | 权限检查总数 |
| `gateway_permission_check_failed_total` | Counter | reason | 权限检查失败数 |
| `gateway_subscription_query_duration_seconds` | Histogram | - | 订阅查询延迟分布 |
| `gateway_subscription_query_total` | Counter | status | 订阅查询总数 |
| `gateway_subscription_query_failed_total` | Counter | reason | 订阅查询失败数 |
| `gateway_token_reserve_duration_seconds` | Histogram | - | Token预留延迟分布 |
| `gateway_token_reserve_total` | Counter | status | Token预留总数 |
| `gateway_token_reserve_success_total` | Counter | - | Token预留成功数 |
| `gateway_token_reserve_failed_total` | Counter | reason | Token预留失败数 |
| `gateway_cache_hits_total` | Counter | hit, cache_type | 缓存命中统计 |
| `gateway_rate_limit_exceeded_total` | Counter | - | 限流触发次数 |
| `gateway_proxy_request_duration_seconds` | Histogram | service | 代理请求延迟分布 |
| `gateway_requests_total` | Counter | method, path, status | 总请求数 |
| `gateway_request_duration_seconds` | Histogram | method, path, status | 总请求延迟分布 |
| `gateway_health_check_total` | Counter | status | 健康检查统计 |
| `gateway_health_check_failed_total` | Counter | - | 健康检查失败数 |

### HTTP 性能指标 (3个)

| 指标名称 | 类型 | Labels | 说明 |
|---------|------|--------|------|
| `gm_http_request_duration_seconds` | Histogram | method, path, status | 请求延迟分布 |
| `gm_http_requests_total` | Counter | method, path, status | 请求总数 |
| `gm_http_errors_total` | Counter | method, path, status | 错误总数 |

## 查看指标

### 方法 1: 直接访问 /metrics 端点

```bash
# 获取 service URL
SERVICE_URL=$(gcloud run services describe adscenter-preview \
  --region=asia-northeast1 \
  --project=gm-439917 \
  --format='value(status.url)')

# 查看所有指标
curl $SERVICE_URL/metrics

# 过滤特定指标
curl $SERVICE_URL/metrics | grep gm_billing

# 示例输出:
# gm_billing_tokens_consumed_total{user_id="user123",operation="offer_creation"} 1500
# gm_billing_tokens_consumed_total{user_id="user456",operation="ad_campaign"} 800
```

### 方法 2: 使用 Cloud Monitoring Metrics Explorer (仅查看 Cloud Run 原生指标)

**注意：自定义的 gm_* 指标不会自动出现在 Cloud Monitoring 中！**

Cloud Monitoring 只显示 Cloud Run 原生指标：
- `run.googleapis.com/request_count`
- `run.googleapis.com/request_latencies`
- `run.googleapis.com/container/cpu/utilizations`

如果要在 Cloud Monitoring 中看到自定义指标，需要：
1. 修改代码，使用 Cloud Monitoring API 直接写入（见下文"方法 3"）
2. 或使用 OpenTelemetry Collector 转发

### 方法 3: 配置 Grafana 直接采集 /metrics

**推荐方案！最简单且免费。**

#### 步骤 1: 安装 Grafana (本地或 Grafana Cloud)

```bash
# 本地安装 (macOS)
brew install grafana
brew services start grafana

# 或使用 Grafana Cloud (免费 tier)
# https://grafana.com/auth/sign-up/create-user
```

#### 步骤 2: 添加 Prometheus Data Source

1. 打开 Grafana: http://localhost:3000
2. Configuration → Data Sources → Add data source → Prometheus
3. 配置：
   ```
   Name: Google-Monetize Adscenter
   URL: https://adscenter-preview-XXXXX-an.a.run.app
   HTTP Method: GET
   ```
4. Save & Test

#### 步骤 3: 导入 Dashboard

```bash
# 导入预制的 dashboard JSON
monitoring/prometheus/dashboards/billing-overview.json
monitoring/prometheus/dashboards/ad-performance.json
```

#### 步骤 4: 创建查询

在 Grafana 中，你可以直接使用 PromQL：

```promql
# 全局 Token 消耗速率
sum(rate(gm_billing_tokens_consumed_total[5m]))

# 按 operation 分组
sum(rate(gm_billing_tokens_consumed_total[5m])) by (operation)

# Top 10 用户
topk(10, sum(rate(gm_billing_tokens_consumed_total[5m])) by (user_id))

# Refund 率
sum(rate(gm_billing_tokens_refunded_total[5m]))
/
sum(rate(gm_billing_tokens_consumed_total[5m]))

# CTR (点击率)
sum(rate(gm_adscenter_ad_clicks_total[5m]))
/
sum(rate(gm_adscenter_ad_impressions_total[5m]))
```

## 常用 PromQL 查询示例

查看 [mql-queries.md](./mql-queries.md) 获取完整的查询示例。

### Billing 查询

```promql
# 1. 全局 Token 消耗速率 (tokens/sec)
sum(rate(gm_billing_tokens_consumed_total[5m]))

# 2. Token 消耗 by operation
sum(rate(gm_billing_tokens_consumed_total[5m])) by (operation)

# 3. Top 10 用户 by Token 消耗
topk(10, sum(rate(gm_billing_tokens_consumed_total[5m])) by (user_id))

# 4. Refund 率
sum(rate(gm_billing_tokens_refunded_total[5m]))
/
sum(rate(gm_billing_tokens_consumed_total[5m]))

# 5. Commit 率
sum(rate(gm_billing_tokens_committed_total[5m]))
/
sum(rate(gm_billing_tokens_reserved_total[5m]))

# 6. 过去 1 小时的 Token 消耗总量
sum(increase(gm_billing_tokens_consumed_total[1h]))
```

### Ad Performance 查询

```promql
# 1. 全局 CTR (Click-Through Rate)
sum(rate(gm_adscenter_ad_clicks_total[5m]))
/
sum(rate(gm_adscenter_ad_impressions_total[5m]))

# 2. CTR by platform
sum(rate(gm_adscenter_ad_clicks_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_impressions_total[5m])) by (platform)

# 3. CVR (Conversion Rate)
sum(rate(gm_adscenter_ad_conversions_total[5m]))
/
sum(rate(gm_adscenter_ad_clicks_total[5m]))

# 4. CPC (Cost Per Click) by platform
sum(rate(gm_adscenter_ad_spend_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_clicks_total[5m])) by (platform)

# 5. Top 10 campaigns by CTR
topk(10,
  sum(rate(gm_adscenter_ad_clicks_total[5m])) by (campaign_id)
  /
  sum(rate(gm_adscenter_ad_impressions_total[5m])) by (campaign_id)
)

# 6. Platform 分布 (按展示次数)
sum(rate(gm_adscenter_ad_impressions_total[5m])) by (platform)
```

### Gateway 中间件查询

```promql
# 1. JWT验证成功率
sum(rate(gateway_jwt_validation_success_total[5m]))
/
sum(rate(gateway_jwt_validation_total[5m]))

# 2. JWT验证延迟分布
histogram_quantile(0.95, sum(rate(gateway_jwt_validation_duration_seconds_bucket[5m])) by (le))

# 3. JWT验证失败率 by reason
sum(rate(gateway_jwt_validation_failed_total[5m])) by (reason)

# 4. 权限检查成功率
sum(rate(gateway_permission_check_total[5m]) - rate(gateway_permission_check_failed_total[5m]))
/
sum(rate(gateway_permission_check_total[5m]))

# 5. 权限检查延迟P95
histogram_quantile(0.95, sum(rate(gateway_permission_check_duration_seconds_bucket[5m])) by (le))

# 6. 缓存命中率
sum(rate(gateway_cache_hits_total{hit="true"}[5m]))
/
sum(rate(gateway_cache_hits_total[5m]))

# 7. Token预留成功率
sum(rate(gateway_token_reserve_success_total[5m]))
/
sum(rate(gateway_token_reserve_total[5m]))

# 8. Token预留延迟P95
histogram_quantile(0.95, sum(rate(gateway_token_reserve_duration_seconds_bucket[5m])) by (le))

# 9. Gateway整体错误率
sum(rate(gateway_requests_total{status=~"5.."}[5m]))
/
sum(rate(gateway_requests_total[5m]))

# 10. Gateway整体响应时间P95
histogram_quantile(0.95, sum(rate(gateway_request_duration_seconds_bucket[5m])) by (le))

# 11. 限流触发率
sum(rate(gateway_rate_limit_exceeded_total[5m]))
/
sum(rate(gateway_requests_total[5m]))

# 12. 后端服务代理延迟
histogram_quantile(0.95, sum(rate(gateway_proxy_request_duration_seconds_bucket[5m])) by (le, service))
```

## 部署告警

告警策略配置在 `alerts/` 目录：

```bash
# 部署告警策略到 Cloud Monitoring
./scripts/deploy-monitoring.sh --deploy-alerts
```

已配置的告警：

### 业务告警 (business-alerts.yaml)
1. **High Error Rate**: HTTP 5xx 错误率 > 5% 持续 5 分钟
2. **High Token Refund Rate**: Token 退款率 > 10% 持续 15 分钟
3. **Low Ad CTR**: 广告 CTR < 1% 持续 30 分钟（默认禁用）

### Gateway 告警 (gateway-alerts.yaml)
1. **JWT验证失败率高**: JWT验证失败率 > 10% (critical) / > 5% (warning)
2. **JWT验证延迟高**: P95延迟 > 1秒
3. **权限检查失败率高**: 权限检查失败率 > 5%
4. **权限检查延迟高**: P95延迟 > 2秒
5. **订阅查询失败率高**: 订阅查询失败率 > 5%
6. **订阅查询延迟高**: P95延迟 > 3秒
7. **Token预留失败率高**: Token预留失败率 > 10%
8. **Token预留延迟高**: P95延迟 > 2秒
9. **限流触发率过高**: 限流 > 10 req/s
10. **缓存命中率低**: 缓存命中率 < 80%
11. **Gateway整体错误率高**: 整体错误率 > 5%
12. **Gateway响应时间高**: P95响应时间 > 5秒
13. **Gateway服务不可用**: 服务停止响应 > 1分钟

## 成本分析

### 当前方案 (Prometheus /metrics + Grafana)

```
Cloud Run services: 免费（已有）
Grafana (本地): 免费
或 Grafana Cloud: 免费 tier (10k series, 14天保留)

总成本: $0/月
```

### 如果需要 Cloud Monitoring Custom Metrics

```
指标数量: 16 业务指标 × 100 用户 = 1600 时间序列
采样频率: 1 sample/分钟
数据量: 1600 × 1440 samples/天 × 8 bytes ≈ 18MB/天 ≈ 540MB/月

Cloud Monitoring 定价:
- 前 150MB ingestion: 免费
- 超出部分: $0.258/MB
- 成本: (540 - 150) × $0.258 = ~$100/月

结论: 当前方案(仅 /metrics)完全免费！
```

## Grafana Dashboard 导入

### Billing Overview Dashboard

1. 登录 Grafana
2. Dashboards → Import
3. 上传 `monitoring/prometheus/dashboards/billing-overview.json`
4. 选择 Prometheus data source
5. Import

包含面板：
- Global Token Consumption Rate
- Token Consumption by Operation
- Refund Rate (单值)
- Commit Rate (单值)
- Active Subscribers (单值)
- Top 10 Users by Consumption (表格)
- Hourly Token Trend (图表)

### Gateway Middleware Dashboard

同样步骤，导入 `gateway-overview.json`

包含面板：
- **请求概览**: 总请求率、成功/失败请求率
- **错误率**: 服务器错误率和客户端错误率（带阈值告警）
- **JWT验证性能**: P50/P95/P99延迟分布图
- **JWT验证成功率**: 验证成功率和失败率统计
- **权限检查性能**: P50/P95/P99延迟分布
- **订阅查询性能**: P50/P95/P99延迟分布
- **Token管理性能**: Token预留延迟和成功率
- **缓存性能**: 缓存命中率和命中/未命中统计
- **限流状态**: 限流触发频率和总请求对比
- **代理请求性能**: 各后端服务的延迟分布
- **整体响应时间分布**: 热力图显示响应时间分布
- **服务状态**: Gateway服务可用性状态

### Ad Performance Dashboard

同样步骤，导入 `ad-performance.json`

包含面板：
- Global CTR (单值)
- Global CVR (单值)
- Total Impressions (单值)
- Active Ads (单值)
- CTR by Platform (图表)
- Impressions by Platform (图表)
- Top Campaigns by CTR (表格)
- Platform Distribution (饼图)
- CPC by Platform (图表)
- Total Spend by Platform (图表)

## 故障排查

### /metrics endpoint 返回 404

```bash
# 检查 service 是否正确部署
gcloud run services describe adscenter-preview \
  --region=asia-northeast1 \
  --project=gm-439917

# 检查路由配置
curl -v https://YOUR_SERVICE_URL/metrics
```

### 指标值为 0 或不更新

```bash
# 1. 检查代码是否调用了 RecordXXX 方法
# 例如：m.RecordTokenConsumption(userID, operation, amount)

# 2. 查看 service 日志
gcloud run logs read adscenter-preview \
  --region=asia-northeast1 \
  --limit=50

# 3. 手动触发业务逻辑，然后查看 /metrics
curl $SERVICE_URL/api/offers/create -X POST ...
curl $SERVICE_URL/metrics | grep gm_offer
```

### Grafana 无法连接到 /metrics

```bash
# 1. 确认 Cloud Run service 允许未认证访问
gcloud run services describe adscenter-preview \
  --format="value(status.url)"

# 2. 测试从 Grafana 服务器访问
curl https://YOUR_SERVICE_URL/metrics

# 3. 如果需要认证，在 Grafana data source 中添加 Header:
# Authorization: Bearer $(gcloud auth print-identity-token)
```

## 最佳实践

### 1. 指标命名

✅ **DO:**
```
gm_billing_tokens_consumed_total (清晰的 namespace + 动作 + _total 后缀)
gm_http_request_duration_seconds (使用标准单位后缀)
```

❌ **DON'T:**
```
tokens (没有 namespace)
request_time (单位不明确)
```

### 2. Label 使用

✅ **DO:**
- 使用低基数 labels (platform, operation, type)
- user_id 可用于小规模系统 (< 1000 用户)

❌ **DON'T:**
- 避免高基数 labels 在大规模系统 (request_id, timestamp)
- 避免 labels 值动态生成 (user123_20241009)

### 3. 查询优化

✅ **DO:**
```promql
# 使用 rate() 查看速率
sum(rate(metric[5m]))

# 使用合适的时间窗口
rate(metric[5m])  # 短期趋势
rate(metric[1h])  # 长期趋势
```

❌ **DON'T:**
```promql
# 直接查询 counter (会一直增长)
sum(metric)

# 时间窗口太小
rate(metric[10s])  # 数据噪音大
```

## 参考资源

- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Grafana Prometheus Integration](https://grafana.com/docs/grafana/latest/datasources/prometheus/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)

## 支持

如有问题或建议：
1. 查看 Cloud Run logs: `gcloud run logs read SERVICE_NAME`
2. 检查 /metrics endpoint: `curl SERVICE_URL/metrics`
3. 联系 DevOps 团队
