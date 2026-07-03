# PromQL Query Examples for Google-Monetize

本文档包含所有常用的 PromQL 查询示例，可直接在 Grafana 中使用。

这些查询**替代了 Recording Rules**，因为：
1. Cloud Run 不支持 GMP Recording Rules
2. 100 用户规模下，实时计算性能足够
3. 更灵活，无需预先定义

---

## 目录

- [Billing 指标查询](#billing-指标查询)
- [Offer 指标查询](#offer-指标查询)
- [Ad 指标查询](#ad-指标查询)
- [HTTP 性能指标查询](#http-性能指标查询)
- [跨服务聚合查询](#跨服务聚合查询)

---

## Billing 指标查询

### 1. 全局 Token 消耗速率 (tokens/sec)

```promql
# 所有用户的 Token 消耗速率
sum(rate(gm_billing_tokens_consumed_total[5m]))
```

**用途：** 监控系统整体负载
**Dashboard类型：** Graph
**Y轴单位：** tokens/sec

---

### 2. Token 消耗速率（按 operation 分组）

```promql
# 按操作类型分组的 Token 消耗
sum(rate(gm_billing_tokens_consumed_total[5m])) by (operation)
```

**用途：** 分析哪些操作消耗最多 Token
**Dashboard类型：** Stacked Graph
**Y轴单位：** tokens/sec

---

### 3. Top 10 用户（按 Token 消耗）

```promql
# 消耗 Token 最多的 10 个用户
topk(10, sum(rate(gm_billing_tokens_consumed_total[5m])) by (user_id))
```

**用途：** 识别重度用户或潜在滥用
**Dashboard类型：** Table
**列：** user_id, tokens/sec

---

### 4. Token Refund 率

```promql
# 退款率 = 退款 / 消耗
sum(rate(gm_billing_tokens_refunded_total[5m]))
/
sum(rate(gm_billing_tokens_consumed_total[5m]))
```

**用途：** 监控系统质量指标
**Dashboard类型：** Singlestat
**格式：** Percentage (0-1)
**阈值：** < 0.05 (绿色), 0.05-0.1 (黄色), > 0.1 (红色)

---

### 5. Token Commit 率

```promql
# 提交率 = 已提交 / 已预留
sum(rate(gm_billing_tokens_committed_total[5m]))
/
sum(rate(gm_billing_tokens_reserved_total[5m]))
```

**用途：** 监控预留转化效率
**Dashboard类型：** Singlestat
**格式：** Percentage
**期望值：** > 0.90

---

### 6. 过去 1 小时的 Token 消耗总量

```promql
# 1 小时内的总消耗
sum(increase(gm_billing_tokens_consumed_total[1h]))
```

**用途：** 账单预估、容量规划
**Dashboard类型：** Graph
**Y轴单位：** tokens

---

### 7. Token 消耗按用户和操作分组

```promql
# 多维度分析
sum(rate(gm_billing_tokens_consumed_total[5m])) by (user_id, operation)
```

**用途：** 详细分析用户行为模式
**Dashboard类型：** Heatmap 或 Table

---

### 8. 按 Refund 原因统计

```promql
# 退款原因分布
sum(rate(gm_billing_tokens_refunded_total[5m])) by (reason)
```

**用途：** 识别系统问题
**Dashboard类型：** Pie Chart

---

### 9. Active Subscribers（按 Plan）

```promql
# 活跃订阅用户数
gm_billing_active_subscribers
```

**用途：** 业务指标监控
**Dashboard类型：** Singlestat
**格式：** Number

---

### 10. 预测未来 Token 消耗（线性回归）

```promql
# 基于过去 30 分钟预测未来 10 分钟
predict_linear(
  sum(rate(gm_billing_tokens_consumed_total[5m]))[30m:],
  600
)
```

**用途：** 容量规划告警
**Dashboard类型：** Graph

---

## Offer 指标查询

### 1. Offer 创建速率（按类型）

```promql
sum(rate(gm_offer_offers_created_total[5m])) by (type)
```

**用途：** 监控业务活跃度
**Dashboard类型：** Graph

---

### 2. Offer Success Rate（成功率）

```promql
# 成功率 = 完成 / 创建
sum(rate(gm_offer_offers_completed_total[5m]))
/
sum(rate(gm_offer_offers_created_total[5m]))
```

**用途：** 系统健康指标
**Dashboard类型：** Singlestat
**格式：** Percentage
**期望值：** > 0.95

---

### 3. Offer Success Rate（按类型）

```promql
sum(rate(gm_offer_offers_completed_total[5m])) by (type)
/
sum(rate(gm_offer_offers_created_total[5m])) by (type)
```

**用途：** 分析不同类型 Offer 的质量
**Dashboard类型：** Bar Gauge

---

### 4. Offer Failure Rate（失败率）

```promql
# 失败率 = 失败 / 创建
sum(rate(gm_offer_offers_failed_total[5m]))
/
sum(rate(gm_offer_offers_created_total[5m]))
```

**用途：** 告警触发器
**阈值：** > 0.10

---

### 5. Offer 失败原因分布

```promql
sum(rate(gm_offer_offers_failed_total[5m])) by (reason)
```

**用途：** 故障分析
**Dashboard类型：** Table

---

### 6. 平均 Offer 价值（按类型）

```promql
# 平均价值（分）= 总价值 / 创建数
sum(rate(gm_offer_offer_value_total[5m])) by (type)
/
sum(rate(gm_offer_offers_created_total[5m])) by (type)
```

**用途：** 业务分析
**Dashboard类型：** Bar Gauge
**Y轴单位：** cents

---

### 7. Top 10 用户（按 Offer 创建数）

```promql
topk(10, sum(rate(gm_offer_offers_created_total[5m])) by (user_id))
```

**用途：** 识别活跃用户
**Dashboard类型：** Table

---

### 8. Offer 类型分布（百分比）

```promql
# 各类型占比
(
  sum(rate(gm_offer_offers_created_total[5m])) by (type)
  /
  sum(rate(gm_offer_offers_created_total[5m]))
) * 100
```

**用途：** 产品使用分析
**Dashboard类型：** Pie Chart

---

## Ad 指标查询

### 1. 全局 CTR (Click-Through Rate)

```promql
# CTR = 点击 / 展示
sum(rate(gm_adscenter_ad_clicks_total[5m]))
/
sum(rate(gm_adscenter_ad_impressions_total[5m]))
```

**用途：** 核心广告性能指标
**Dashboard类型：** Singlestat
**格式：** Percentage
**基准值：** 0.01-0.05 (1-5%)

---

### 2. CTR（按平台）

```promql
sum(rate(gm_adscenter_ad_clicks_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_impressions_total[5m])) by (platform)
```

**用途：** 对比不同平台表现
**Dashboard类型：** Bar Gauge

---

### 3. CVR (Conversion Rate)

```promql
# CVR = 转化 / 点击
sum(rate(gm_adscenter_ad_conversions_total[5m]))
/
sum(rate(gm_adscenter_ad_clicks_total[5m]))
```

**用途：** 转化效率监控
**Dashboard类型：** Singlestat
**格式：** Percentage

---

### 4. CVR（按平台）

```promql
sum(rate(gm_adscenter_ad_conversions_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_clicks_total[5m])) by (platform)
```

**用途：** 平台转化对比
**Dashboard类型：** Graph

---

### 5. CPC (Cost Per Click)

```promql
# CPC (分) = 花费 / 点击
sum(rate(gm_adscenter_ad_spend_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_clicks_total[5m])) by (platform)
```

**用途：** 成本控制
**Dashboard类型：** Graph
**Y轴单位：** cents

---

### 6. CPA (Cost Per Acquisition)

```promql
# CPA (分) = 花费 / 转化
sum(rate(gm_adscenter_ad_spend_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_conversions_total[5m])) by (platform)
```

**用途：** ROI 分析
**Dashboard类型：** Graph
**Y轴单位：** cents

---

### 7. Top 10 Campaigns（按 CTR）

```promql
topk(10,
  sum(rate(gm_adscenter_ad_clicks_total[5m])) by (campaign_id)
  /
  sum(rate(gm_adscenter_ad_impressions_total[5m])) by (campaign_id)
)
```

**用途：** 识别高效 Campaign
**Dashboard类型：** Table

---

### 8. Top 10 Campaigns（按 Impressions）

```promql
topk(10, sum(rate(gm_adscenter_ad_impressions_total[5m])) by (campaign_id))
```

**用途：** 识别高曝光 Campaign
**Dashboard类型：** Table

---

### 9. Platform 分布（按展示次数）

```promql
sum(rate(gm_adscenter_ad_impressions_total[5m])) by (platform)
```

**用途：** 平台流量分析
**Dashboard类型：** Pie Chart

---

### 10. Platform 分布（按花费金额）

```promql
sum(rate(gm_adscenter_ad_spend_total[5m])) by (platform)
```

**用途：** 预算分配分析
**Dashboard类型：** Pie Chart

---

### 11. 活跃广告数（按平台）

```promql
sum(gm_adscenter_ads_active) by (platform)
```

**用途：** 监控广告库存
**Dashboard类型：** Graph

---

### 12. 广告展示速率（Impression Rate）

```promql
sum(rate(gm_adscenter_ad_impressions_total[5m])) by (platform)
```

**用途：** 流量监控
**Dashboard类型：** Graph
**Y轴单位：** impressions/sec

---

## HTTP 性能指标查询

### 1. 平均请求延迟

```promql
# P50 延迟
histogram_quantile(0.5,
  sum(rate(gm_http_request_duration_seconds_bucket[5m])) by (le)
)
```

**用途：** 性能基准
**Dashboard类型：** Graph
**Y轴单位：** seconds

---

### 2. P95 / P99 延迟

```promql
# P95
histogram_quantile(0.95,
  sum(rate(gm_http_request_duration_seconds_bucket[5m])) by (le, path)
) by (path)

# P99
histogram_quantile(0.99,
  sum(rate(gm_http_request_duration_seconds_bucket[5m])) by (le, path)
) by (path)
```

**用途：** SLA 监控
**Dashboard类型：** Graph

---

### 3. 请求速率（QPS）

```promql
sum(rate(gm_http_requests_total[5m]))
```

**用途：** 负载监控
**Dashboard类型：** Graph
**Y轴单位：** requests/sec

---

### 4. 错误率

```promql
# 错误率 = 5xx / 总请求
sum(rate(gm_http_errors_total{status=~"5.."}[5m]))
/
sum(rate(gm_http_requests_total[5m]))
```

**用途：** 可用性监控
**Dashboard类型：** Singlestat
**格式：** Percentage
**告警阈值：** > 0.01

---

### 5. 按 Path 的错误率

```promql
sum(rate(gm_http_errors_total{status=~"5.."}[5m])) by (path)
/
sum(rate(gm_http_requests_total[5m])) by (path)
```

**用途：** 识别问题接口
**Dashboard类型：** Table

---

### 6. 慢查询识别（P99 > 1s 的路径）

```promql
histogram_quantile(0.99,
  sum(rate(gm_http_request_duration_seconds_bucket[5m])) by (le, path)
) by (path) > 1
```

**用途：** 性能优化
**Dashboard类型：** Table

---

## 跨服务聚合查询

### 1. 全系统总 QPS

```promql
# 所有服务的总请求数
sum(rate(gm_http_requests_total[5m]))
```

---

### 2. 平台 ROI（需要添加 revenue 指标）

```promql
# ROI = 收入 / 花费
# 注意：需要先实现 gm_adscenter_ad_revenue_total 指标
sum(rate(gm_adscenter_ad_revenue_total[5m])) by (platform)
/
sum(rate(gm_adscenter_ad_spend_total[5m])) by (platform)
```

---

### 3. 系统整体错误率

```promql
sum(rate(gm_http_errors_total{status=~"5.."}[5m]))
/
sum(rate(gm_http_requests_total[5m]))
```

---

## 告警查询

以下查询可用于 Grafana Alerting 或 Cloud Monitoring Alert Policies。

### 1. High Error Rate Alert

```promql
# 触发条件：错误率 > 5% 持续 5 分钟
(
  sum(rate(gm_http_errors_total{status=~"5.."}[5m]))
  /
  sum(rate(gm_http_requests_total[5m]))
) > 0.05
```

---

### 2. High Token Refund Alert

```promql
# 触发条件：退款率 > 10%
(
  sum(rate(gm_billing_tokens_refunded_total[5m]))
  /
  sum(rate(gm_billing_tokens_consumed_total[5m]))
) > 0.10
```

---

### 3. Low CTR Alert

```promql
# 触发条件：CTR < 1%
(
  sum(rate(gm_adscenter_ad_clicks_total[5m]))
  /
  sum(rate(gm_adscenter_ad_impressions_total[5m]))
) < 0.01
```

---

### 4. Low Offer Success Rate

```promql
# 触发条件：成功率 < 90%
(
  sum(rate(gm_offer_offers_completed_total[5m]))
  /
  sum(rate(gm_offer_offers_created_total[5m]))
) < 0.90
```

---

### 5. High P99 Latency

```promql
# 触发条件：P99 延迟 > 2 秒
histogram_quantile(0.99,
  sum(rate(gm_http_request_duration_seconds_bucket[5m])) by (le)
) > 2
```

---

## 使用技巧

### 1. 时间窗口选择

```promql
# 实时监控（短期波动）
rate(metric[1m])

# 稳定趋势（过滤噪音）
rate(metric[5m])

# 长期趋势
rate(metric[1h])
```

### 2. 聚合函数

```promql
sum()      # 求和
avg()      # 平均值
min()      # 最小值
max()      # 最大值
count()    # 计数
topk(N)    # Top N
bottomk(N) # Bottom N
```

### 3. 过滤器

```promql
# 精确匹配
{user_id="user123"}

# 正则匹配
{user_id=~"user.*"}

# 排除
{status!="200"}

# 正则排除
{path!~"/health"}
```

### 4. 比较运算符

```promql
# 百分比变化（与 1 小时前比较）
(
  sum(rate(metric[5m]))
  /
  sum(rate(metric[5m] offset 1h))
) - 1
```

---

## 参考

- [PromQL Basics](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL Operators](https://prometheus.io/docs/prometheus/latest/querying/operators/)
- [PromQL Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/)
