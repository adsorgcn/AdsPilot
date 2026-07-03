# Google-Monetize 告警系统配置指南

## 概述

本文档说明如何配置Google-Monetize监控告警系统的通知渠道。

## 告警架构

```
Prometheus → Grafana → Alert Notification Channels
                ↓
         [Slack, Email, PagerDuty]
```

## 告警级别

| 级别 | 说明 | 响应时间 | 通知渠道 |
|------|------|----------|----------|
| **Critical** | 严重影响核心业务功能 | 立即 (5分钟内) | Slack + PagerDuty + Email |
| **Warning** | 可能影响用户体验 | 30分钟内 | Slack + Email |
| **Info** | 信息通知，无需立即处理 | 按需查看 | Slack |

## 已配置的告警规则

### 断路器告警 (5个规则)
文件: `circuit-breaker-alerts.yaml`

1. **CircuitBreakerOpen** (critical) - 断路器打开
2. **CircuitBreakerHalfOpen** (warning) - 断路器半开状态
3. **CircuitBreakerHighFailureRate** (warning) - 失败率>30%
4. **CircuitBreakerConsecutiveFailures** (warning) - 连续失败>5次
5. **CircuitBreakerFlapping** (info) - 状态频繁切换

### 业务指标告警 (13个规则)
文件: `business-alerts.yaml`

1. **EvaluationSuccessRateLow** (critical) - 评估成功率<90%
2. **EvaluationSuccessRateWarning** (warning) - 评估成功率<95%
3. **SystemErrorRateHigh** (critical) - 系统错误率>5%
4. **SystemErrorRateWarning** (warning) - 系统错误率>1%
5. **TokenReserveFailureHigh** (critical) - Token预留失败率>10%
6. **EvaluationLatencyP95High** (warning) - 评估P95延迟>60s
7. **SimilarWebCacheHitRateLow** (warning) - 缓存命中率<70%
8. **BrowserExecErrorRateHigh** (warning) - Browser-exec错误率高
9. **GeminiAPIErrorRateHigh** (critical) - Gemini API错误率高
10. **TokenConsumptionRateHigh** (warning) - Token消耗速率>1000/min
11. **GeminiAPICostHigh** (warning) - 小时成本>$5
12. **EvaluationRequestSpike** (info) - 请求量突增3x
13. **PubSubProcessingDelayHigh** (warning) - 消息处理延迟>2min

## 通知渠道配置

### 1. Slack 通知

#### 创建Slack App和Webhook

```bash
# 1. 访问 https://api.slack.com/apps
# 2. 创建新App "Google-Monetize Monitoring"
# 3. 启用 Incoming Webhooks
# 4. 添加Webhook到以下频道：
#    - #ops-critical (Critical alerts)
#    - #ops-warnings (Warning alerts)
#    - #ops-info (Info alerts)
```

#### 在Grafana中配置Slack

1. 进入 **Grafana → Alerting → Contact points**
2. 添加新的Contact Point:

```yaml
Name: ops-critical-slack
Type: Slack
Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Channel: #ops-critical
Username: Google-Monetize Monitoring
Icon: :rotating_light:
```

3. 重复以上步骤配置 `ops-warnings-slack` 和 `ops-info-slack`

#### Slack消息模板

```json
{
  "text": "🚨 {{ .GroupLabels.alertname }}",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Summary*: {{ .CommonAnnotations.summary }}\n*Description*: {{ .CommonAnnotations.description }}"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Service*: {{ .GroupLabels.service }}"
        },
        {
          "type": "mrkdwn",
          "text": "*Severity*: {{ .GroupLabels.severity }}"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Action*: {{ .CommonAnnotations.action }}"
      }
    }
  ]
}
```

### 2. Email 通知

#### 配置SMTP服务器

在Grafana中配置SMTP：

```ini
# grafana.ini or environment variables
[smtp]
enabled = true
host = smtp.gmail.com:587
user = ops@gm.com
password = your_app_password
from_address = alerts@gm.com
from_name = Google-Monetize Monitoring
```

#### 添加Email Contact Point

1. 进入 **Grafana → Alerting → Contact points**
2. 添加Email通知:

```yaml
Name: ops-email
Type: Email
Addresses: ops-team@gm.com, tech-lead@gm.com
Single Email: false (发送单独邮件给每个收件人)
```

#### Email模板

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .critical { color: #e74c3c; }
    .warning { color: #f39c12; }
    .info { color: #3498db; }
  </style>
</head>
<body>
  <h2 class="{{ .GroupLabels.severity }}">{{ .GroupLabels.alertname }}</h2>
  <p><strong>Summary:</strong> {{ .CommonAnnotations.summary }}</p>
  <p><strong>Description:</strong> {{ .CommonAnnotations.description }}</p>
  <p><strong>Service:</strong> {{ .GroupLabels.service }}</p>
  <p><strong>Action:</strong> {{ .CommonAnnotations.action }}</p>
  <p><strong>Impact:</strong> {{ .CommonAnnotations.impact }}</p>
  <hr>
  <p><small>Time: {{ .StartsAt }}</small></p>
</body>
</html>
```

### 3. PagerDuty 集成 (可选)

#### 创建PagerDuty集成

```bash
# 1. 登录 PagerDuty
# 2. 创建新Service "Google-Monetize Production"
# 3. 添加Grafana集成
# 4. 复制Integration Key
```

#### 在Grafana中配置PagerDuty

1. 进入 **Grafana → Alerting → Contact points**
2. 添加PagerDuty Contact Point:

```yaml
Name: pagerduty-critical
Type: PagerDuty
Integration Key: your_integration_key_here
Severity: critical
Auto Resolve: true
```

#### PagerDuty On-Call 轮换

```yaml
# 建议的On-Call排班
Schedule: ops-team-rotation
Escalation Policy:
  Level 1: Primary On-Call (立即通知)
  Level 2: Secondary On-Call (15分钟后)
  Level 3: Tech Lead (30分钟后)
```

## 告警路由配置

### Grafana Notification Policies

在 **Grafana → Alerting → Notification policies** 配置路由规则：

```yaml
# Root policy
- matchers:
    - alertname =~ .+
  receiver: default
  group_by: [alertname, service]
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 4h

  # Critical alerts
  routes:
    - matchers:
        - severity = critical
      receiver: critical-alerts
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 1h
      continue: false

    # Warning alerts
    - matchers:
        - severity = warning
      receiver: warning-alerts
      group_wait: 30s
      group_interval: 10m
      repeat_interval: 4h
      continue: false

    # Info alerts
    - matchers:
        - severity = info
      receiver: info-alerts
      group_wait: 1m
      group_interval: 15m
      repeat_interval: 12h
      continue: false
```

### Contact Point Groups

```yaml
# critical-alerts
contact_points:
  - ops-critical-slack
  - pagerduty-critical
  - ops-email

# warning-alerts
contact_points:
  - ops-warnings-slack
  - ops-email

# info-alerts
contact_points:
  - ops-info-slack
```

## 告警抑制规则

配置告警抑制，避免告警风暴：

```yaml
# Mute rules
- matchers:
    - alertname = CircuitBreakerOpen
    - service = billing
  # 当billing断路器打开时，抑制所有Token相关告警
  mute_timings:
    - business_hours  # 仅在工作时间外抑制
```

## 静音时段配置

```yaml
# Mute timings
- name: business_hours
  time_intervals:
    - weekdays: ['monday:friday']
      times:
        - start_time: '09:00'
          end_time: '18:00'
      location: 'Asia/Shanghai'

- name: maintenance_window
  time_intervals:
    - weekdays: ['saturday']
      times:
        - start_time: '02:00'
          end_time: '04:00'
      location: 'Asia/Shanghai'
```

## 验证配置

### 测试告警

```bash
# 1. 触发测试告警
curl -X POST http://localhost:9090/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "labels": {
        "alertname": "TestAlert",
        "severity": "warning",
        "service": "test"
      },
      "annotations": {
        "summary": "This is a test alert",
        "description": "Testing alert configuration"
      }
    }]
  }'

# 2. 检查Grafana Alert History
# 访问 Grafana → Alerting → Alert History

# 3. 验证通知渠道
# - 检查Slack频道是否收到消息
# - 检查Email收件箱
# - 检查PagerDuty事件
```

### 监控告警系统健康

```yaml
# Alertmanager健康检查
- name: alertmanager_health
  rules:
    - alert: AlertmanagerDown
      expr: up{job="alertmanager"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Alertmanager is down"

    # 告警通知失败
    - alert: AlertNotificationFailures
      expr: rate(grafana_alerting_notifications_failed_total[5m]) > 0.1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "告警通知发送失败率过高"
```

## 运维SOP

### 收到Critical告警后的处理流程

1. **确认告警** (1分钟内)
   - 在Slack/PagerDuty确认收到告警
   - 快速评估影响范围

2. **初步诊断** (5分钟内)
   - 查看Grafana Dashboard
   - 查看服务日志: `gcloud run logs read <service-name> --limit=100`
   - 检查断路器状态

3. **应急响应** (15分钟内)
   - 如果是服务故障：重启服务或扩容
   - 如果是依赖故障：启用降级策略
   - 如果是流量激增：临时扩容

4. **根因分析** (1小时内)
   - 导出完整日志
   - 分析错误趋势
   - 确定根本原因

5. **长期修复** (1-3天内)
   - 修复代码或配置
   - 添加自动化测试
   - 更新文档

### 值班排班建议

```yaml
Schedule:
  - Primary: 工作日 9:00-18:00
  - Secondary: 24/7 (轮换)
  - Escalation: Tech Lead (紧急情况)

Rotation: 每周轮换
Handoff: 每周一上午10:00
```

## 成本估算

| 服务 | 月费用 | 说明 |
|------|--------|------|
| Slack | 免费 | 使用Webhook |
| Email (Gmail) | 免费 | 使用Gmail SMTP |
| PagerDuty | $19/user/月 | Professional plan |
| **总计** | ~$38/月 | 2个on-call人员 |

## 相关文档

- [断路器监控Dashboard](../dashboards/circuit-breaker-dashboard.json)
- [业务监控Dashboard](../dashboards/business-metrics-dashboard.json)
- [完整优化方案](../../docs/ArchitectureOpV1/COMPLETE-OPTIMIZATION-PLAN.md)

## 常见问题

### Q: 告警太多，如何减少噪音？
A:
1. 调整告警阈值（如success rate从95%降至90%）
2. 增加`for`持续时间（如从5m改为10m）
3. 配置抑制规则（suppress dependent alerts）
4. 使用静音时段（mute timings）

### Q: 如何测试告警是否正常工作？
A:
1. 使用Grafana的"Test"按钮发送测试通知
2. 临时降低阈值触发真实告警
3. 检查Alert History和通知渠道

### Q: 如何添加新的通知渠道？
A:
1. 在Grafana → Alerting → Contact points添加新渠道
2. 在Notification policies中添加路由规则
3. 发送测试通知验证

---

**更新日期**: 2025-10-16
**维护者**: DevOps Team
