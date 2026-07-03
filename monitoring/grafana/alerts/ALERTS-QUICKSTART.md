# Grafana Cloud 告警快速配置 (15 分钟)

**前提**: 已完成 Grafana Cloud 注册和数据源配置

---

## ✅ Step 1: 配置通知渠道 (5 分钟)

### Email 通知 (默认已启用)

1. 登录 Grafana Cloud: `https://gm.grafana.net`
2. 点击 **⚙️ → Alerting → Contact points**
3. 默认已有 **grafana-default-email** (使用注册邮箱)
4. - [ ] 验证邮箱地址正确

### 可选: Slack 通知

1. 创建 Slack Webhook:
   - [ ] 访问: https://api.slack.com/messaging/webhooks
   - [ ] 选择频道: `#gm-alerts`
   - [ ] 复制 Webhook URL: _________________________

2. 在 Grafana 添加 Slack:
   - [ ] **Contact points** → **New contact point**
   - [ ] Name: `Google-Monetize Slack`
   - [ ] Type: `Slack`
   - [ ] Webhook URL: (粘贴上面的 URL)
   - [ ] 点击 **Test** → 应收到测试消息
   - [ ] 点击 **Save contact point**

---

## ✅ Step 2: 创建第一个告警 - High Token Refund Rate (5 分钟)

1. **进入 Alert rules 页面**:
   - [ ] 点击 **⚙️ → Alerting → Alert rules**
   - [ ] 点击 **New alert rule**

2. **配置告警规则**:

   **Rule name**: `High Token Refund Rate`

   **Section 1: Set query and alert condition**
   - [ ] Data source: `Google-Monetize Billing`
   - [ ] 在 Query A 输入框粘贴:
     ```promql
     sum(rate(gm_billing_tokens_refunded_total[5m]))
     /
     sum(rate(gm_billing_tokens_consumed_total[5m]))
     ```
   - [ ] 点击 **Run queries** 验证查询正常
   - [ ] Expression: `WHEN last() OF A IS ABOVE 0.10`

   **Section 2: Alert evaluation**
   - [ ] Folder: `Google-Monetize Alerts` (首次需创建)
   - [ ] Evaluation group: `token-alerts` (或使用默认)
   - [ ] Evaluate every: `1m`
   - [ ] For: `5m`

   **Section 3: Add details for your alert**
   - [ ] Summary: `Token 退款率过高`
   - [ ] Description:
     ```
     过去 5 分钟 Token 退款率为 {{ $value | humanizePercentage }}，超过阈值 10%。
     请检查系统质量问题。
     ```
   - [ ] 添加 Labels:
     - `severity`: `critical`
     - `service`: `billing`

   **Section 4: Notifications**
   - [ ] Contact point: `grafana-default-email` (或选择 Slack)

3. **保存并测试**:
   - [ ] 点击 **Save rule and exit**
   - [ ] 等待 1-2 分钟
   - [ ] 查看告警状态: 应显示 **Normal** (绿色) 或 **Pending** (黄色)

---

## ✅ Step 3: 创建第二个告警 - High Offer Failure Rate (5 分钟)

重复 Step 2,使用以下配置:

**Rule name**: `High Offer Failure Rate`

**Query A**:
```promql
sum(rate(gm_offer_offers_failed_total[5m]))
/
sum(rate(gm_offer_offers_created_total[5m]))
```

**Expression**: `WHEN last() OF A IS ABOVE 0.10`

**Evaluation**:
- Folder: `Google-Monetize Alerts`
- Evaluate every: `1m`
- For: `5m`

**Details**:
- Summary: `Offer 失败率过高`
- Description:
  ```
  过去 5 分钟 Offer 失败率为 {{ $value | humanizePercentage }}，超过阈值 10%。
  请立即检查系统健康状况。
  ```
- Labels:
  - `severity`: `critical`
  - `service`: `offer`

**Notifications**: 同上

---

## 🧪 测试告警 (可选)

### 方法 1: 查看告警评估

1. - [ ] **Alerting** → **Alert rules**
2. - [ ] 点击刚创建的告警
3. - [ ] 查看 **Query** 标签,应该看到当前查询值
4. - [ ] 如果值 < 0.10,告警应该是 **Normal** 状态

### 方法 2: 手动触发告警 (仅测试环境)

如果想验证告警通知是否工作,可以:

1. 临时降低阈值:
   - [ ] 编辑告警规则
   - [ ] 将 `IS ABOVE 0.10` 改为 `IS ABOVE 0.01` (1%)
   - [ ] 保存

2. 等待 5-10 分钟,应该收到告警邮件/Slack 消息

3. 验证后恢复阈值:
   - [ ] 将阈值改回 `0.10`

---

## 📊 可选: 创建 Alerts Overview Dashboard

1. - [ ] **+ → Dashboard**
2. - [ ] **Add visualization**
3. - [ ] Data source: `Alerting`
4. - [ ] Visualization: `Stat`
5. - [ ] Title: `Active Alerts`
6. - [ ] 点击 **Apply**
7. - [ ] 保存 Dashboard: `Google-Monetize Alerts Overview`

---

## ✅ 验证清单

配置完成后,你应该看到:

- [ ] ✅ 至少 1 个 Contact point (Email 或 Slack)
- [ ] ✅ 2 个 Alert rules (Token Refund, Offer Failure)
- [ ] ✅ 所有告警状态为 **Normal** (绿色)
- [ ] ✅ (可选) 收到测试告警通知

---

## 🚀 下一步

### 今天完成
- [ ] 按照上述步骤配置 2 个 Critical 告警
- [ ] 测试 Email/Slack 通知

### 本周内
- [ ] 添加 HTTP Error Rate 告警
- [ ] 添加 P99 Latency 告警
- [ ] 参考: `monitoring/grafana/alerts/README.md`

### 长期优化
- [ ] 根据真实数据调整阈值
- [ ] 创建更多细粒度告警
- [ ] 建立告警处理 Runbook

---

**遇到问题?** 参考完整文档: `monitoring/grafana/alerts/README.md`

**需要更多告警规则?** 参考: `monitoring/prometheus/alerts/business-alerts.yml` (PromQL 示例)
