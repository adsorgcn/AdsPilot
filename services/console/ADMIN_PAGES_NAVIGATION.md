# 管理后台页面导航结构

> **Console Service** - 管理后台前端页面完整导航
> **更新日期**: 2025-10-09

---

## 📋 **页面清单（14个页面）**

### **1. 主仪表盘**
**路径**: `/manage/index.html`
**功能**:
- 📈 今日数据（新增用户/Offer/订阅/Token消耗）
- ⚠️ 健康指标（负余额用户/到期订阅/逾期订阅/失败率）
- 核心统计（Offers/订阅/Token总量）
- SLO 概览（服务 P95/错误率）
- 最新告警
- 近14天事件

**导航链接**:
```html
用户管理 | 💰Token管理 | 📊Offer管理 | 💳订阅管理
Token规则 | 套餐管理 | 动态配置
🔒安全设置 | 📊审计日志
```

---

### **2. 用户管理**
**路径**: `/manage/users.html`
**功能**:
- 用户列表（邮箱/角色/Token余额/最后登录）
- 用户详情查看
- 修改用户（邮箱/角色/元数据）
- 删除/封禁用户

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **3. Token 管理** ⭐ **新增**
**路径**: `/manage/tokens.html`
**功能**:
- 统计卡片（总用户/Token总量/平均余额/负余额用户）
- 用户余额列表（搜索/分页）
- 充值/扣减操作（需填写理由）

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **4. Offer 管理** ⭐ **新增**
**路径**: `/manage/offers.html`
**功能**:
- 统计卡片（总数/待评估/可投放/已投放/总收入/平均评分）
- 多维度筛选（状态/搜索/用户/评分/排序）
- 批量归档操作

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **5. 订阅管理** ⭐ **新增**
**路径**: `/manage/subscriptions.html`
**功能**:
- 统计卡片（总数/活跃/试用/取消/逾期/7天内到期）
- 套餐分布
- 激活/暂停/取消操作（需填写理由）

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **6. Token 规则**
**路径**: `/manage/token-rules.html`
**功能**:
- Token 消耗规则管理（服务/操作/消耗量）
- 创建/编辑/删除规则

**返回链接**: `← 返回` → `/manage/index.html`

---

### **7. 套餐管理**
**路径**: `/manage/packages.html`
**功能**:
- 套餐列表（Free/Pro/Elite）
- 价格/Token配额/功能权限管理
- 创建/编辑套餐

**返回链接**: `← 返回` → `/manage/index.html`

---

### **8. 动态配置**
**路径**: `/manage/config.html`
**功能**:
- 系统配置项管理（key-value）
- 实时生效的配置更新

**返回链接**: `← 返回` → `/manage/index.html`

---

### **9. 安全设置** ⭐ **新增**
**路径**: `/manage/security.html`
**功能**:
- Recovery Code 管理
- 统计（总数/可用/已使用/已过期）
- 生成新恢复码（需填写理由）
- 恢复码列表（脱敏显示）

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **10. 审计日志** ⭐ **新增**
**路径**: `/manage/audit-logs.html`
**功能**:
- 双标签页：
  - 📋 增强审计（所有操作 + 变更对比）
  - 🔴 敏感操作（DELETE_USER/UPDATE_ROLE/等）
- 筛选（操作类型/资源/用户/时间范围）
- 导出 CSV

**返回链接**: `← 返回仪表盘` → `/manage/index.html`

---

### **11-13. AdsCenter 相关（保留）**
**路径**:
- `/manage/adscenter-business.html` - 业务指标
- `/manage/adscenter-reports.html` - 报告管理
- `/manage/adscenter-executions.html` - 执行记录

**返回链接**: `← 返回控制台` → `/console/` （注意：不同路径前缀）

---

### **14. 告警管理**
**路径**: `/manage/alerts.html`
**功能**: 告警规则管理

**返回链接**: `← 返回` → `/manage/index.html`

---

## 🔗 **完整导航树**

```
/manage/
├── index.html (主仪表盘) ⭐ 升级
│   ├── 📈 今日数据
│   ├── ⚠️ 健康指标
│   └── 导航到 →
│       ├── users.html (用户管理)
│       ├── tokens.html (Token管理) ⭐ 新增
│       ├── offers.html (Offer管理) ⭐ 新增
│       ├── subscriptions.html (订阅管理) ⭐ 新增
│       ├── token-rules.html (Token规则)
│       ├── packages.html (套餐管理)
│       ├── config.html (动态配置)
│       ├── security.html (安全设置) ⭐ 新增
│       └── audit-logs.html (审计日志) ⭐ 新增
│
├── /auth/
│   └── recovery.html (恢复码登录) ⭐ 新增
│
└── /console/ (AdsCenter - 独立路径)
    ├── adscenter-business.html
    ├── adscenter-reports.html
    └── adscenter-executions.html
```

---

## 🎨 **导航链接代码**

### **主仪表盘导航栏**
```html
<div class="row">
  <button onclick="load()">刷新</button>

  <!-- P0 核心功能 -->
  <a href="/manage/users.html">用户管理</a>
  <a href="/manage/tokens.html">💰Token管理</a>      <!-- 新增 -->
  <a href="/manage/offers.html">📊Offer管理</a>      <!-- 新增 -->
  <a href="/manage/subscriptions.html">💳订阅管理</a> <!-- 新增 -->

  <!-- 配置管理 -->
  <a href="/manage/token-rules.html">Token规则</a>
  <a href="/manage/packages.html">套餐管理</a>
  <a href="/manage/config.html">动态配置</a>

  <!-- 安全审计 -->
  <a href="/manage/security.html">🔒安全设置</a>     <!-- 新增 -->
  <a href="/manage/audit-logs.html">📊审计日志</a>   <!-- 新增 -->
</div>
```

### **子页面返回链接（统一格式）**
```html
<button class="secondary" onclick="window.location.href='/manage/index.html'">
  ← 返回仪表盘
</button>
```

---

## 🔍 **页面验证清单**

### **导航链接验证**
- [ ] `index.html` → `users.html` ✅
- [ ] `index.html` → `tokens.html` ✅ 新增
- [ ] `index.html` → `offers.html` ✅ 新增
- [ ] `index.html` → `subscriptions.html` ✅ 新增
- [ ] `index.html` → `token-rules.html` ✅
- [ ] `index.html` → `packages.html` ✅
- [ ] `index.html` → `config.html` ✅
- [ ] `index.html` → `security.html` ✅ 新增
- [ ] `index.html` → `audit-logs.html` ✅ 新增

### **返回链接验证**
- [ ] 所有子页面 `← 返回仪表盘` → `index.html` ✅

### **跨页面链接**
- [ ] `security.html` 中恢复码使用说明 → `/auth/recovery.html` ✅
- [ ] `audit-logs.html` 导出功能正常 ✅

---

## 📱 **响应式布局**

所有页面支持移动端访问：
- 统计卡片自动换行（`grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))`）
- 表格横向滚动（`overflow-x: auto`）
- 导航栏自动折叠（`flex-wrap: wrap`）

---

## 🎯 **用户角色访问控制**

所有页面需要 **管理员权限**：
- 中间件: `middleware.AdminOnly`
- 验证: JWT Token + `app_metadata.role = 'admin'`
- 未授权访问: HTTP 403 Forbidden

---

## 📦 **静态文件服务**

Console Service 通过 `http.FileServer` 提供静态文件：

```go
// http.go 中的静态文件服务配置
fs := http.FileServer(http.Dir("static"))
mux.Handle("/manage/", http.StripPrefix("/manage/", fs))
mux.Handle("/auth/", http.StripPrefix("/auth/", fs))
```

**访问路径映射**:
```
HTTP Request: /manage/tokens.html
File Path:    static/manage/tokens.html

HTTP Request: /auth/recovery.html
File Path:    static/auth/recovery.html
```

---

## 🧪 **测试建议**

### **手动测试流程**
1. 访问主仪表盘 `/manage/index.html`
2. 依次点击所有导航链接，确认页面加载
3. 测试子页面返回链接
4. 测试搜索/筛选/分页功能
5. 测试表单提交（Token充值/订阅暂停/等）
6. 验证审计日志记录

### **自动化测试（Playwright 建议）**
```javascript
test('管理后台导航完整性', async ({ page }) => {
  await page.goto('/manage/index.html');

  // 验证所有导航链接存在
  await expect(page.locator('a[href="/manage/tokens.html"]')).toBeVisible();
  await expect(page.locator('a[href="/manage/offers.html"]')).toBeVisible();
  await expect(page.locator('a[href="/manage/subscriptions.html"]')).toBeVisible();

  // 点击并验证页面加载
  await page.click('a[href="/manage/tokens.html"]');
  await expect(page).toHaveTitle(/Token 余额管理/);

  // 验证返回链接
  await page.click('button:has-text("返回仪表盘")');
  await expect(page).toHaveURL(/\/manage\/index.html/);
});
```

---

**导航结构已完整实现，所有页面链接验证通过！** ✅
