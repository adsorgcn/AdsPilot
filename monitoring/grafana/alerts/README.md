# Grafana Cloud 告警配置指南

**适用于**: Grafana Cloud 免费版
**配置方式**: 通过 Grafana Cloud UI 配置

---

## 📋 前提条件

- ✅ 已完成 Grafana Cloud 注册和配置
- ✅ Prometheus data sources 已添加 (billing, offer, adscenter)
- ✅ Dashboards 已导入并显示数据
- ✅ 已配置通知渠道 (Email/Slack)

---

## 🔔 推荐的告警规则

### 1. 高 Token 退款率告警 (Critical)

**业务影响**: Token 退款率过高表示系统质量问题，直接影响用户体验和收入。

**配置步骤**:

1. 打开 Grafana Cloud → **Alerting** → **Alert rules**
2. 点击 **New alert rule**
3. 填写配置:

```yaml
Rule name: High Token Refund Rate

# Step 1: Set query and condition
Data source: Google-Monetize Billing
Query A (Refund Rate):
  sum(rate(gm_billing_tokens_refunded_total[5m]))
  /
  sum(rate(gm_billing_tokens_consumed_total[5m]))

Condition: WHEN last() OF A IS ABOVE 0.10

# Step 2: Set alert evaluation
Evaluate every: 1m
For: 5m

# Step 3: Add details
Folder: Google-Monetize Alerts
Summary: Token 退款率过高 ({{ $value | humanizePercentage }})
Description: |
  ⚠️ 过去 5 分钟 Token 退款率为 {{ $value | humanizePercentage }}，超过阈值 10%。

  可能原因:
  - Offer 执行质量下降
  - 系统错误导致退款
  - 用户余额不足

  请检查:
  1. 查看 Offer 失败率指标
  2. 检查系统错误日志
  3. 分析退款原因分布

Labels:
  severity: critical
  service: billing
  category: quality

# Step 4: Notifications
Contact point: Email / Slack
```

**测试方法**:
```bash
# 手动触发大量退款（测试环境）
curl -X POST https://billing-preview-XXX.a.run.app/api/v1/refund \
  -H "Authorization: Bearer TOKEN" \
  -d '{"user_id":"test","amount":1000,"reason":"test"}'
```

---

### 2. Offer 失败率过高 (Critical)

**业务影响**: Offer 失败率直接影响广告投放成功率和用户满意度。

**配置**:

```yaml
Rule name: High Offer Failure Rate

Data source: Google-Monetize Offer
Query A (Failure Rate):
  sum(rate(gm_offer_offers_failed_total[5m]))
  /
  sum(rate(gm_offer_offers_created_total[5m]))

Condition: WHEN last() OF A IS ABOVE 0.10

Evaluate every: 1m
For: 5m

Summary: Offer 失败率过高 ({{ $value | humanizePercentage }})
Description: |
  🚨 过去 5 分钟 Offer 失败率为 {{ $value | humanizePercentage }}，超过阈值 10%。

  请立即检查:
  1. browser-exec 服务健康状况
  2. siterank 服务可用性
  3. 网络连接问题
  4. 查看失败原因分布:
     topk(5, sum(rate(gm_offer_offers_failed_total[5m])) by (reason))

Labels:
  severity: critical
  service: offer
  category: reliability
```

---

### 3. HTTP 错误率过高 (Warning)

**业务影响**: HTTP 错误率升高可能表示服务异常或客户端问题。

**配置**:

```yaml
Rule name: High HTTP Error Rate

Data source: Google-Monetize Billing
Query A (Error Rate):
  sum(rate(gm_billing_http_errors_total[5m]))
  /
  sum(rate(gm_billing_http_requests_total[5m]))

Condition: WHEN last() OF A IS ABOVE 0.05

Evaluate every: 1m
For: 5m

Summary: HTTP 错误率过高 ({{ $value | humanizePercentage }})
Description: |
  ⚠️ 服务 {{ $labels.service }} HTTP 错误率为 {{ $value | humanizePercentage }}，超过 5% 阈值。

  请检查:
  1. 最近的部署变更
  2. 数据库连接状态
  3. 外部依赖服务状态

Labels:
  severity: warning
  service: billing
  category: reliability
```

**多服务版本** (为所有服务创建相同告警):
- 重复上述配置,分别为 `Google-Monetize Offer` 和 `Google-Monetize Adscenter` 数据源创建

---

### 4. P99 延迟过高 (Warning)

**业务影响**: 高延迟影响用户体验。

**配置**:

```yaml
Rule name: High P99 Latency - Billing

Data source: Google-Monetize Billing
Query A (P99):
  histogram_quantile(0.99,
    sum(rate(gm_billing_http_request_duration_seconds_bucket[5m])) by (le, method, path)
  )

Condition: WHEN last() OF A IS ABOVE 2.0

Evaluate every: 1m
For: 5m

Summary: P99 延迟过高 ({{ $value }}s)
Description: |
  📊 {{ $labels.method }} {{ $labels.path }} 的 P99 延迟为 {{ $value }}s，超过 2s 阈值。

  建议:
  1. 检查数据库查询性能
  2. 查看外部 API 调用延迟
  3. 分析慢请求日志

Labels:
  severity: warning
  service: billing
  category: performance
```

---

### 5. 断路器打开 (Critical)

**业务影响**: 断路器打开表示依赖服务不可用,系统进入降级模式。

**配置**:

```yaml
Rule name: Circuit Breaker Open

Data source: Google-Monetize Billing (或任何暴露断路器指标的服务)
Query A (Open State):
  circuitbreaker_state{state="open"}

Condition: WHEN last() OF A IS ABOVE 0

Evaluate every: 1m
For: 2m

Summary: 断路器已打开 - {{ $labels.service }}
Description: |
  🚨 服务 {{ $labels.service }} 的断路器已打开，依赖服务可能不可用。

  影响:
  - billing → Token 操作可能失败
  - browser-exec → 返回原始 URL (降级)
  - siterank → 返回默认分数 50 (降级)

  请检查:
  1. 依赖服务健康状况
  2. 网络连接
  3. 查看降级策略是否正常工作

Labels:
  severity: critical
  service: "{{ $labels.service }}"
  category: reliability
```

---

### 6. Token 消耗速率异常飙升 (Info)

**业务影响**: 可能表示用户活动增加或异常行为。

**配置**:

```yaml
Rule name: Token Consumption Spike

Data source: Google-Monetize Billing
Query A (Current Rate):
  sum(rate(gm_billing_tokens_consumed_total[5m]))

Query B (Historical Rate):
  sum(rate(gm_billing_tokens_consumed_total[1h] offset 1h))

Condition: WHEN last() OF A IS ABOVE last() OF B * 1.5

Evaluate every: 5m
For: 10m

Summary: Token 消耗速率异常飙升
Description: |
  📈 Token 消耗速率比 1 小时前增长了 {{ $value | humanizePercentage }}。

  这可能是:
  - ✅ 正常: 用户活动增加 (好事!)
  - ⚠️ 异常: Bot 攻击或滥用

  建议检查 Top 用户消耗情况。

Labels:
  severity: info
  service: billing
  category: usage
```

---

### 7. Offer 成功率低 (Warning)

**业务影响**: 成功率低于 50% 表示系统质量问题。

**配置**:

```yaml
Rule name: Low Offer Success Rate

Data source: Google-Monetize Offer
Query A (Success Rate):
  sum(rate(gm_offer_offers_completed_total[5m]))
  /
  sum(rate(gm_offer_offers_created_total[5m]))

Condition: WHEN last() OF A IS BELOW 0.50

Evaluate every: 1m
For: 10m

Summary: Offer 成功率过低 ({{ $value | humanizePercentage }})
Description: |
  ⚠️ Offer 成功率仅为 {{ $value | humanizePercentage }}，低于 50% 阈值。

  请检查:
  1. 网络质量
  2. 目标网站可用性
  3. browser-exec 错误日志

Labels:
  severity: warning
  service: offer
  category: quality
```

---

## 📧 通知渠道配置

### Email (默认)

Grafana Cloud 免费版默认支持 Email 通知。

**配置步骤**:
1. **Alerting** → **Contact points**
2. 点击 **New contact point**
3. 填写:
   ```yaml
   Name: Google-Monetize Team Email
   Type: Email
   Addresses: your-team@example.com
   ```

### Slack (推荐)

**配置步骤**:
1. 创建 Slack Incoming Webhook:
   - 访问: https://api.slack.com/messaging/webhooks
   - 选择频道: `#gm-alerts`
   - 复制 Webhook URL

2. 在 Grafana Cloud 配置:
   ```yaml
   Name: Google-Monetize Slack
   Type: Slack
   Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL

   # 可选: 自定义消息模板
   Title: {{ .CommonLabels.alertname }}
   Text: {{ .CommonAnnotations.description }}
   ```

### PagerDuty (生产环境推荐)

仅当需要 24/7 on-call 支持时配置。

---

## 🎯 告警优先级建议

### Critical (立即响应)
- ✅ High Token Refund Rate (> 10%)
- ✅ High Offer Failure Rate (> 10%)
- ✅ Circuit Breaker Open

### Warning (1 小时内响应)
- ⚠️ High HTTP Error Rate (> 5%)
- ⚠️ High P99 Latency (> 2s)
- ⚠️ Low Offer Success Rate (< 50%)

### Info (监控即可)
- 📊 Token Consumption Spike
- 📊 Low Ad Creation Rate

---

## 🧪 测试告警规则

### 方法 1: 使用 Test 功能

在 Grafana Alert rule 编辑页面:
1. 点击 **Preview** 查看当前查询结果
2. 点击 **Test** 手动触发告警
3. 验证通知是否发送成功

### 方法 2: 手动触发业务事件

```bash
# 触发高退款率
for i in {1..100}; do
  curl -X POST https://billing-preview-XXX.a.run.app/api/v1/refund \
    -H "Authorization: Bearer TOKEN" \
    -d '{"user_id":"test","amount":100,"reason":"test"}'
done

# 等待 5 分钟后应收到告警
```

---

## 📊 告警仪表盘

### 创建 Alerts Overview Dashboard

1. 创建新 Dashboard
2. 添加以下面板:

**Panel 1: Active Alerts**
```yaml
Data source: Alerting
Visualization: Stat
Query: Show active alerts
```

**Panel 2: Alert Timeline**
```yaml
Data source: Alerting
Visualization: Timeline
Query: Show alert history (last 24h)
```

**Panel 3: Alerts by Severity**
```yaml
Data source: Alerting
Visualization: Pie chart
Query: Group by severity
```

---

## 🔍 告警调试

### 查看告警历史

1. **Alerting** → **Alert rules**
2. 点击告警名称
3. 查看 **State history** 标签

### 查看告警评估日志

1. 点击告警规则
2. 查看 **Evaluation** 标签
3. 查看最近的评估结果和查询值

### 调整告警敏感度

如果告警太频繁:
- 增加 `For` 时间 (如 5m → 10m)
- 提高阈值 (如 10% → 15%)
- 调整 `Evaluate every` (如 1m → 5m)

---

## 📚 最佳实践

### 1. 分阶段启用告警

**Week 1**: 仅启用 Critical 告警
- High Token Refund Rate
- High Offer Failure Rate

**Week 2**: 添加 Warning 告警
- HTTP Error Rate
- P99 Latency

**Week 3**: 添加 Info 告警
- Token Consumption Spike
- Low Creation Rate

### 2. 避免告警疲劳

- 不要一次性启用所有告警
- 先观察 1-2 周,调整阈值
- 确保每个告警都 actionable

### 3. 建立 Runbook

为每个 Critical 告警创建处理文档:
- 告警含义
- 排查步骤
- 解决方案
- 联系人

---

## 🚀 下一步行动

### 今天完成
- [ ] 配置 Email 通知渠道
- [ ] 创建 2 个 Critical 告警 (Token Refund, Offer Failure)
- [ ] 测试告警是否正常工作

### 本周内
- [ ] 配置 Slack 通知
- [ ] 创建 HTTP 和延迟告警
- [ ] 创建 Alerts Overview Dashboard

### 长期优化
- [ ] 根据真实数据调整阈值
- [ ] 添加更多细粒度告警 (per-user, per-operation)
- [ ] 集成 PagerDuty (生产环境)

---

**相关文档**:
- Grafana Alerting 官方文档: https://grafana.com/docs/grafana/latest/alerting/
- PromQL 查询参考: `monitoring/prometheus/promql-queries.md`
- Quick Start: `monitoring/GRAFANA-QUICKSTART.md`
