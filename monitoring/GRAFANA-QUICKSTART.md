# Grafana Cloud 快速配置 Checklist

**目标**: 30 分钟内完成 Grafana Cloud 免费版配置

---

## ✅ 准备工作

在开始之前,确保:

- [ ] 已有 Google/GitHub/Email 账号用于注册
- [ ] 浏览器已登录 Google Cloud Console
- [ ] 至少一个 Cloud Run 服务已部署 (billing/offer/adscenter)

**检查服务部署状态**:
```bash
./scripts/get-metrics-urls.sh
```

如果所有服务都显示 "NOT DEPLOYED",请先部署至少一个服务:
```bash
# 部署 billing 服务 (示例)
gcloud builds submit --config services/billing/cloudbuild.yaml
```

---

## 📋 配置步骤 (30 分钟)

### Step 1: 注册 Grafana Cloud (5 分钟)

1. **访问注册页面**: https://grafana.com/auth/sign-up/create-user

2. **填写注册信息**:
   - [ ] Email: _____________ (你的工作邮箱)
   - [ ] Stack name: `gm` (或 `gm-preview`)
   - [ ] Company: Kiro / Google-Monetize
   - [ ] Role: Developer

3. **选择 Free Plan**:
   - [ ] 点击 "Start Free Trial" → 选择 "Free Forever"
   - [ ] 确认免费额度:
     - 10,000 active series ✅
     - 50 GB logs/month ✅
     - 14 days retention ✅

4. **验证邮箱**:
   - [ ] 检查邮箱收到的验证邮件
   - [ ] 点击验证链接

5. **登录到你的 Grafana 实例**:
   - URL 格式: `https://gm.grafana.net` (根据你的 stack name)
   - [ ] 记录这个 URL: _________________________

---

### Step 2: 获取 Cloud Run 服务 URL (3 分钟)

运行脚本获取所有服务的 /metrics 端点:

```bash
cd /Users/jason/Documents/Kiro/gm
./scripts/get-metrics-urls.sh
```

**记录下面的 URL (稍后配置数据源时需要)**:

- [ ] billing-preview: _________________________/metrics
- [ ] offer-preview: _________________________/metrics
- [ ] adscenter-preview: _________________________/metrics

**如果服务未部署,先部署再继续:**
```bash
# 使用 Github Actions 自动部署所有服务
gh workflow run deploy-services.yml

# 或手动部署单个服务
gcloud run deploy billing-preview \
  --source ./services/billing \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

---

### Step 3: 配置 Prometheus 数据源 (10 分钟)

#### 3.1 添加 Billing 数据源

1. **进入数据源配置**:
   - [ ] 登录 Grafana Cloud: `https://gm.grafana.net`
   - [ ] 点击左侧菜单 **⚙️ Configuration → Data sources**
   - [ ] 点击 **Add data source**

2. **选择 Prometheus**:
   - [ ] 在搜索框输入 "Prometheus"
   - [ ] 点击 **Prometheus** 卡片

3. **配置 Billing 数据源**:
   ```yaml
   Name: Google-Monetize Billing
   URL: <billing-preview URL from Step 2>
   # 例如: https://billing-preview-xxx-an.a.run.app/metrics

   HTTP Method: GET
   Access: Server (default)
   Timeout: 30s

   # Auth 部分留空 (如果服务设置了 --allow-unauthenticated)
   ```

4. **测试连接**:
   - [ ] 点击底部的 **Save & Test**
   - [ ] 期望看到: ✅ "Data source is working"

**如果失败,排查:**
- 检查 Cloud Run URL 是否正确
- 确认服务允许未认证访问: `gcloud run services describe billing-preview --format="value(status.url)"`
- 测试端点可访问性: `curl https://billing-preview-XXX.a.run.app/metrics`

#### 3.2 添加 Offer 数据源

- [ ] 重复步骤 3.1,使用:
  ```yaml
  Name: Google-Monetize Offer
  URL: <offer-preview URL>/metrics
  ```

#### 3.3 添加 Adscenter 数据源

- [ ] 重复步骤 3.1,使用:
  ```yaml
  Name: Google-Monetize Adscenter
  URL: <adscenter-preview URL>/metrics
  ```

---

### Step 4: 验证 Metrics 数据 (5 分钟)

使用 Grafana Explore 功能测试 metrics:

1. **打开 Explore**:
   - [ ] 点击左侧菜单 **🔍 Explore** (放大镜图标)

2. **选择数据源**:
   - [ ] 在顶部下拉菜单选择 **Google-Monetize Billing**

3. **运行测试查询**:
   - [ ] 在查询框输入: `gm_billing_tokens_consumed_total`
   - [ ] 点击 **Run query** (或按 Shift+Enter)

4. **验证结果**:
   - [ ] 应该看到时间序列数据 (如果有业务活动)
   - [ ] 或看到 "No data" (正常,表示还没有 Token 消耗记录)

**测试其他 metrics**:
```promql
# Offer metrics
gm_offer_offers_created_total

# Ad metrics
gm_adscenter_ads_created_total

# HTTP metrics
gm_billing_http_requests_total
```

**如果看不到数据**:
- 可能服务刚部署,还没有业务活动
- 手动触发一些操作 (创建 Offer、预留 Token 等)
- 或继续配置 Dashboard,等待真实数据产生

---

### Step 5: 导入预制 Dashboard (7 分钟)

#### 5.1 导入 Billing Overview Dashboard

1. **进入 Import 页面**:
   - [ ] 点击左侧菜单 **+ → Import**

2. **上传 JSON 文件**:
   - [ ] 点击 **Upload JSON file**
   - [ ] 选择文件: `monitoring/prometheus/dashboards/billing-overview.json`

3. **配置 Dashboard**:
   ```yaml
   Name: Google-Monetize Billing Overview (可自定义)
   Folder: General (或创建新文件夹 "Google-Monetize")

   Data Source for Billing: Google-Monetize Billing
   ```

4. **导入**:
   - [ ] 点击 **Import**
   - [ ] Dashboard 应该立即显示 (可能部分面板显示 "No data")

#### 5.2 导入 Ad Performance Dashboard

- [ ] 重复步骤 5.1,使用:
  - 文件: `monitoring/prometheus/dashboards/ad-performance.json`
  - Data Source: **Google-Monetize Adscenter**

#### 5.3 创建 Home Dashboard (可选)

如果想要一个总览 Dashboard:

1. - [ ] 点击 **+ → Dashboard**
2. - [ ] 点击 **Add new panel**
3. - [ ] 添加以下面板:

**Panel 1: Token 消耗速率**
```yaml
Data source: Google-Monetize Billing
Query: sum(rate(gm_billing_tokens_consumed_total[5m]))
Visualization: Stat
Title: Token 消耗速率 (tokens/sec)
```

**Panel 2: Offer 成功率**
```yaml
Data source: Google-Monetize Offer
Query:
  sum(rate(gm_offer_offers_completed_total[5m]))
  /
  sum(rate(gm_offer_offers_created_total[5m]))
Visualization: Stat
Unit: Percent (0-1)
Title: Offer 成功率
```

**Panel 3: Token 消耗趋势**
```yaml
Data source: Google-Monetize Billing
Query: sum(rate(gm_billing_tokens_consumed_total[5m])) by (operation)
Visualization: Time series
Title: Token 消耗 by Operation
```

4. - [ ] 点击 **Save dashboard**
5. - [ ] 输入名称: "Google-Monetize Overview"
6. - [ ] 点击 **Save**

---

## 🎯 完成验证

配置完成后,你应该看到:

- [ ] ✅ 3 个 Prometheus data sources (billing, offer, adscenter)
- [ ] ✅ 2-3 个 Dashboards (Billing Overview, Ad Performance, [Optional] Home)
- [ ] ✅ Explore 可以查询到 metrics (即使是 "No data")

---

## 🔔 可选配置: 告警规则 (15 分钟)

**推荐告警**:
- ✅ High Token Refund Rate (> 10%)
- ✅ High Offer Failure Rate (> 10%)
- ⚠️ High HTTP Error Rate (> 5%)
- ⚠️ High P99 Latency (> 2s)

**快速配置指南**:
- 📋 15 分钟快速配置: `monitoring/grafana/alerts/ALERTS-QUICKSTART.md`
- 📚 完整告警配置文档: `monitoring/grafana/alerts/README.md`

**最简配置** (5 分钟):

1. **配置 Email 通知**:
   - [ ] **Alerting** → **Contact points**
   - [ ] 验证默认邮箱地址

2. **创建第一个告警**:
   - [ ] **Alerting** → **Alert rules** → **New alert rule**
   - [ ] Rule name: `High Token Refund Rate`
   - [ ] Data source: `Google-Monetize Billing`
   - [ ] Query A:
     ```promql
     sum(rate(gm_billing_tokens_refunded_total[5m]))
     /
     sum(rate(gm_billing_tokens_consumed_total[5m]))
     ```
   - [ ] Condition: `WHEN last() OF A IS ABOVE 0.10`
   - [ ] Evaluate every: `1m`, For: `5m`
   - [ ] 点击 **Save rule and exit**

**详细步骤请参考**: `monitoring/grafana/alerts/ALERTS-QUICKSTART.md`

---

## 🚀 下一步行动

### 今天完成

- [ ] ✅ 完成上述所有步骤
- [ ] 📸 截图 Dashboard 并分享

### 本周内

- [ ] 配置更多告警规则:
  - Offer 失败率 > 10%
  - HTTP 错误率 > 5%
  - P99 延迟 > 2s

- [ ] 创建团队访问权限:
  - 邀请团队成员到 Grafana Cloud
  - 设置只读 / 编辑权限

### 长期优化

- [ ] 当用户增长后,考虑部署 Prometheus 聚合器
- [ ] 集成 Cloud Logging → Grafana Loki
- [ ] 添加 adscenter 完整指标 (impressions, clicks, conversions)

---

## 📞 获取帮助

**遇到问题?**

1. **数据源连接失败**:
   - 检查文档: `monitoring/grafana-cloud-setup.md` FAQ 部分

2. **Metrics 查询返回空数据**:
   - 确认服务已部署最新代码
   - 手动访问 /metrics 端点验证指标存在
   - 触发一些业务操作产生数据

3. **Dashboard 显示异常**:
   - 检查 data source 配置是否正确
   - 尝试在 Explore 中运行相同的 query

**文档资源**:
- 详细指南: `monitoring/grafana-cloud-setup.md`
- PromQL 查询: `monitoring/prometheus/promql-queries.md`
- 架构说明: `monitoring/prometheus/README.md`

---

## 🎉 配置完成!

当你看到第一个 Dashboard 显示真实数据时,监控系统就正式上线了!

**别忘了**:
- 📸 截图分享你的 Dashboard
- 🔔 测试告警是否工作 (可以手动触发)
- 📊 定期查看业务 KPI

Good luck! 🚀
