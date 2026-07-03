# 端到端测试（Playwright）

## 先决条件
- Node 18+，已全局安装 Playwright 或使用 npx 运行
- 可用的预发网关与鉴权令牌（Firebase ID Token）

## 运行
```
GATEWAY=https://www.urlchecker.dev AUTH="Bearer <id_token>" \
  npx playwright test -c scripts/e2e/playwright.config.ts
```

## 测试内容
- Offer 创建 → Siterank 分析（触发）→ Adscenter 诊断 → 计划 → 校验

> 注：本用例只调用 API，不依赖浏览器页面；用于验证后端端到端链路。

