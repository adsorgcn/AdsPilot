# Grafana Cloud 配置指南 (免费版)

**目标**: 为 Google-Monetize 配置 Grafana Cloud 免费版,接入所有业务指标

---

## 📋 前提条件

- ✅ Cloud Run 服务已部署并暴露 /metrics 端点
- ✅ 业务指标已集成 (billing, offer, adscenter)
- ✅ Prometheus 格式 metrics 已验证

---

## 🚀 步骤 1: 注册 Grafana Cloud 免费账号

### 1.1 访问注册页面

```
https://grafana.com/auth/sign-up/create-user
```

### 1.2 免费版限制 (足够使用)

| 资源 | 免费额度 | Google-Monetize 预计使用 |
|------|---------|-----------------|
| Active series (metrics) | 10,000 | ~2,000 (100用户 × 20指标) |
| Logs | 50 GB/月 | ~5-10 GB/月 |
| Traces | 50 GB/月 | 不使用 |
| Users | 3 | 1-2 个管理员 |
| Data retention | 14 天 | 足够 |

**结论**: 免费版完全满足需求 ✅

### 1.3 注册信息填写

- **Email**: 你的工作邮箱
- **Company**: Kiro / Google-Monetize
- **Role**: Developer / DevOps
- **Stack name**: 建议使用 `gm` 或 `gm-prod`

---

## 🔧 步骤 2: 获取 Cloud Run 服务 URL

在配置 Grafana 之前,先获取所有服务的 /metrics 端点 URL:

```bash
# 获取所有服务的 URL
for service in billing-preview offer-preview adscenter-preview; do
  URL=$(gcloud run services describe $service \
    --region=asia-northeast1 \
    --project=gm-439917 \
    --format='value(status.url)' 2>/dev/null)

  if [ -n "$URL" ]; then
    echo "$service: $URL/metrics"
  else
    echo "$service: NOT DEPLOYED"
  fi
done

# 输出示例:
# billing-preview: https://billing-preview-xxx-an.a.run.app/metrics
# offer-preview: https://offer-preview-xxx-an.a.run.app/metrics
# adscenter-preview: https://adscenter-preview-xxx-an.a.run.app/metrics
```

**保存这些 URL,稍后配置数据源时需要使用。**

---

## 🔗 步骤 3: 配置 Prometheus 数据源

### 3.1 登录 Grafana Cloud

注册完成后,你会看到:
```
Your Grafana instance: https://gm.grafana.net
```

点击 **"Launch Grafana"** 进入仪表盘。

### 3.2 添加 Prometheus 数据源 (billing 服务)

**重要**: Grafana Cloud 免费版不支持直接 scrape Cloud Run endpoints。
我们需要使用 **Grafana Agent** 或配置为 **Prometheus data source with HTTP**。

#### 方法 1: Prometheus HTTP Data Source (推荐,最简单)

1. 点击左侧菜单 **Configuration (齿轮图标) → Data sources**
2. 点击 **Add data source**
3. 选择 **Prometheus**
4. 填写配置:

```yaml
Name: Google-Monetize Billing
URL: https://billing-preview-XXX-an.a.run.app/metrics
HTTP Method: GET
Access: Server (default)

# Auth (如果 Cloud Run 需要认证)
# 通常预览环境设置为 --allow-unauthenticated,所以留空即可

# Advanced HTTP Settings
Timeout: 30s
HTTP Headers:
  # 如果需要自定义 header
  # Header: X-Custom-Header
  # Value: your-value
```

5. 点击 **Save & Test**

**预期结果**: 如果配置正确,会显示 ✅ "Data source is working"

如果失败,检查:
- Cloud Run 服务是否允许未认证访问 (`--allow-unauthenticated`)
- /metrics 端点是否可访问: `curl https://billing-preview-XXX.a.run.app/metrics`

---

### 3.3 添加其他服务的数据源

**重要提示**: Grafana Cloud 免费版限制 data source 数量。

**最佳实践**: 使用单个 Prometheus data source + federation

但由于 Cloud Run 没有 federation 支持,我们有两个选择:

#### 选项 A: 为每个服务创建独立数据源 (简单但达到限制)

重复步骤 3.2,分别为:
- Google-Monetize Offer (https://offer-preview-XXX.a.run.app/metrics)
- Google-Monetize Adscenter (https://adscenter-preview-XXX.a.run.app/metrics)

#### 选项 B: 部署 Prometheus 聚合器 (推荐,生产环境)

在 Cloud Run 上部署一个简单的 Prometheus 实例,scrape 所有服务的 /metrics,然后 Grafana 只连接这个聚合器。

**由于你是预览环境,建议先使用选项 A (独立数据源)。**

---

## 📊 步骤 4: 创建 Dashboard

### 4.1 导入预制 Dashboard (推荐)

我们已经为你准备了两个 Dashboard JSON:

1. **Billing Overview Dashboard**
   - 文件: `monitoring/prometheus/dashboards/billing-overview.json`
   - 包含: Token 消耗率、退款率、Top 用户等

2. **Ad Performance Dashboard**
   - 文件: `monitoring/prometheus/dashboards/ad-performance.json`
   - 包含: CTR, CVR, CPC, 平台分布等

**导入步骤:**

1. 点击左侧 **+ → Import**
2. 上传 `billing-overview.json`
3. 选择 data source: **Google-Monetize Billing**
4. 点击 **Import**

重复以上步骤导入 `ad-performance.json`。

---

### 4.2 手动创建 Dashboard (如果需要自定义)

1. 点击 **+ → Dashboard**
2. 点击 **Add new panel**
3. 在 **Query** 部分选择数据源: **Google-Monetize Billing**
4. 输入 PromQL 查询,例如:

```promql
# Panel 1: 全局 Token 消耗速率
sum(rate(gm_billing_tokens_consumed_total[5m]))
```

5. 配置可视化类型:
   - **Stat** (单值): 适合消耗率、成功率
   - **Graph/Time series**: 适合趋势图
   - **Table**: 适合 Top N 用户列表

6. 点击 **Apply** 保存 panel

---

## 🎨 步骤 5: 配置关键业务面板

### 5.1 Billing Dashboard 面板建议

| Panel 标题 | PromQL 查询 | 类型 |
|-----------|------------|------|
| Token 消耗速率 | `sum(rate(gm_billing_tokens_consumed_total[5m]))` | Stat |
| Token 退款率 | `sum(rate(gm_billing_tokens_refunded_total[5m])) / sum(rate(gm_billing_tokens_consumed_total[5m]))` | Stat (百分比) |
| 消耗 by Operation | `sum(rate(gm_billing_tokens_consumed_total[5m])) by (operation)` | Time series (stacked) |
| Top 10 用户 | `topk(10, sum(rate(gm_billing_tokens_consumed_total[5m])) by (user_id))` | Table |
| 退款原因分布 | `sum(rate(gm_billing_tokens_refunded_total[5m])) by (reason)` | Pie chart |

### 5.2 Offer Dashboard 面板建议

| Panel 标题 | PromQL 查询 | 类型 |
|-----------|------------|------|
| Offer 成功率 | `sum(rate(gm_offer_offers_completed_total[5m])) / sum(rate(gm_offer_offers_created_total[5m]))` | Stat (百分比) |
| Offer 失败率 | `sum(rate(gm_offer_offers_failed_total[5m])) / sum(rate(gm_offer_offers_created_total[5m]))` | Stat (百分比) |
| Offer 创建趋势 | `sum(rate(gm_offer_offers_created_total[5m]))` | Time series |
| 失败原因 Top 5 | `topk(5, sum(rate(gm_offer_offers_failed_total[5m])) by (reason))` | Bar gauge |

### 5.3 Ad Performance Dashboard 面板建议

| Panel 标题 | PromQL 查询 | 类型 |
|-----------|------------|------|
| 广告创建速率 | `sum(rate(gm_adscenter_ads_created_total[5m])) by (platform)` | Time series |
| Platform 分布 | `sum(rate(gm_adscenter_ads_created_total[5m])) by (platform)` | Pie chart |
| Top 10 用户 | `topk(10, sum(rate(gm_adscenter_ads_created_total[5m])) by (user_id))` | Table |

**注意**: 当前 adscenter 只集成了基础的 ads_created 指标。完整的 impressions/clicks/conversions 指标需要后续添加。

---

## ⚠️ 步骤 6: 配置告警 (可选)

### 6.1 创建告警规则

Grafana Cloud 免费版支持有限的告警。

**示例: High Token Refund Rate Alert**

1. 在 Dashboard panel 上点击 **Edit**
2. 切换到 **Alert** tab
3. 点击 **Create alert rule from this panel**
4. 配置:

```yaml
Rule name: High Token Refund Rate
Evaluate every: 1m
For: 5m

Condition:
  WHEN avg() OF query(A, 5m, now) IS ABOVE 0.10

# query(A) 是:
sum(rate(gm_billing_tokens_refunded_total[5m]))
/
sum(rate(gm_billing_tokens_consumed_total[5m]))

# 当退款率 > 10% 且持续 5 分钟时触发
```

5. 配置通知渠道:
   - Email
   - Slack (需配置 webhook)
   - PagerDuty (生产环境推荐)

---

## 🔍 步骤 7: 验证配置

### 7.1 测试 metrics 数据流

1. 打开 **Explore** (左侧菜单)
2. 选择数据源: **Google-Monetize Billing**
3. 输入查询:

```promql
gm_billing_tokens_consumed_total
```

4. 点击 **Run query**

**预期结果**: 应该看到类似的时间序列数据:

```
gm_billing_tokens_consumed_total{user_id="user123",operation="offer_creation"} 1500
gm_billing_tokens_consumed_total{user_id="user456",operation="ad_campaign"} 800
```

如果看不到数据:
- 检查 Cloud Run 服务是否部署了最新代码 (包含业务指标)
- 访问 `/metrics` 端点确认指标存在
- 检查 Grafana data source 配置

---

### 7.2 生成测试数据 (如果 metrics 为空)

如果当前没有真实业务数据,可以手动触发一些操作:

```bash
# 创建一个 Offer (需要有效的 auth token)
curl -X POST https://offer-preview-XXX.a.run.app/api/v1/offers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Offer",
    "originalUrl": "https://example.com"
  }'

# 然后查看 metrics
curl https://offer-preview-XXX.a.run.app/metrics | grep gm_offer_offers_created_total
```

---

## 🎯 步骤 8: 常用 Dashboard 布局建议

### 8.1 Overview Dashboard (首页)

推荐面板布局:

```
+------------------+------------------+------------------+
|  Token 消耗速率   |   Offer 成功率   |   广告创建速率    |
|   (Stat)         |   (Stat)         |   (Stat)        |
+------------------+------------------+------------------+
|  Token 消耗趋势 (Time series, 全宽)                    |
+-------------------------------------------------------+
|  Top 10 用户 by Token 消耗 (Table)                     |
+-------------------------------------------------------+
```

### 8.2 Detailed Billing Dashboard

```
+------------------+------------------+------------------+
|  Total Consumed  | Refund Rate      | Commit Rate      |
+------------------+------------------+------------------+
|  消耗 by Operation (Stacked area chart)               |
+-------------------------------------------------------+
|  退款原因分布      |  Top 10 用户                       |
|  (Pie chart)      |  (Table)                          |
+------------------+---------------------------------------+
```

---

## 📚 常见问题 (FAQ)

### Q1: Grafana Cloud 无法访问 Cloud Run /metrics 端点

**原因**: Cloud Run 服务可能需要认证,或者有 CORS 限制。

**解决方案**:
1. 确保 Cloud Run 服务部署时使用 `--allow-unauthenticated`
2. 检查 Cloud Run 是否有 ingress 限制
3. 如果必须使用认证,可以:
   - 在 Grafana data source 中添加 Authorization header
   - 或使用 Grafana Agent 作为代理

### Q2: Metrics 数据延迟很高

**原因**: Grafana 直接从 Cloud Run scrape,受网络延迟影响。

**解决方案**:
- 免费版: 可以接受 (通常 < 30s)
- 生产环境: 部署 Prometheus 聚合器

### Q3: 如何查看历史数据超过 14 天?

**限制**: Grafana Cloud 免费版只保留 14 天数据。

**解决方案**:
- 升级到付费版 (30天保留)
- 或自建 Prometheus + 长期存储 (Thanos/Cortex)

### Q4: 免费版的 10k series 够用吗?

**分析**:
```
100 用户 × 10 业务指标 × ~2 labels = ~2000 series
HTTP 指标: ~500 series
总计: ~2500 series
```

**结论**: 足够使用 ✅

当用户增长到 500+ 时,考虑:
- 优化 label cardinality
- 升级到付费版

---

## 🚀 下一步行动

### 立即执行 (今天)

1. ✅ 注册 Grafana Cloud: https://grafana.com/auth/sign-up/create-user
2. ✅ 获取 Cloud Run 服务 URL (运行上面的脚本)
3. ✅ 配置 3 个 Prometheus data sources (billing, offer, adscenter)
4. ✅ 导入预制 Dashboard

### 本周内

5. ⏳ 配置告警规则 (退款率、成功率、错误率)
6. ⏳ 创建团队 shared dashboard
7. ⏳ 配置 Slack notification channel

### 长期优化 (下个月)

8. ⏳ 部署 Prometheus 聚合器 (统一 metrics endpoint)
9. ⏳ 添加 adscenter 完整指标 (impressions, clicks, conversions)
10. ⏳ 集成 Cloud Logging (日志 → Grafana Loki)

---

## 📞 支持资源

- **Grafana Cloud 文档**: https://grafana.com/docs/grafana-cloud/
- **Prometheus 查询示例**: `monitoring/prometheus/promql-queries.md`
- **Dashboard 模板**: `monitoring/prometheus/dashboards/`
- **Google-Monetize 监控架构**: `monitoring/prometheus/README.md`

---

**配置完成后,请截图 Dashboard 并分享!** 📊✨
