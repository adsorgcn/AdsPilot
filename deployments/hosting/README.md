# 前端多站点托管与 Cloud Run 重写（执行指南）

本指南配合仓库已提交的配置，完成“两端前端（用户端/后台端）→ Firebase Hosting 多站点 → Cloud Run SSR/BFF”的部署。

## 1. 前置条件
- GCP/Firebase 项目：`${GCP_PROJECT_ID}`
- 区域：`asia-northeast1`
- Cloud Run 已开启；API Gateway 已发布；Secret Manager 可用
- 本地或 Cloud Build 环境具备 firebase CLI、gcloud

## 2. Hosting 多站点
仓库根目录 `firebase.json` 已包含 4 个站点：
- 用户端：`gm-preview` → 重写到 `frontend-preview`
- 用户端：`gm-prod` → 重写到 `frontend-prod`
- 后台端：`gm-console-preview` → 重写到 `console-frontend-preview`
- 后台端：`gm-console-prod` → 重写到 `console-frontend-prod`

如需首次创建站点（一次性）：
```
firebase hosting:sites:create gm-preview --project ${GCP_PROJECT_ID}
firebase hosting:sites:create gm-prod --project ${GCP_PROJECT_ID}
firebase hosting:sites:create gm-console-preview --project ${GCP_PROJECT_ID}
firebase hosting:sites:create gm-console-prod --project ${GCP_PROJECT_ID}
```

部署：
```
# 预发用户端
firebase deploy --only hosting:gm-preview --project ${GCP_PROJECT_ID}
# 预发后台
firebase deploy --only hosting:gm-console-preview --project ${GCP_PROJECT_ID}
```

## 3. Cloud Run 服务
创建或更新服务：
```
gcloud run deploy frontend-preview \
  --image=gcr.io/PROJECT_ID/frontend:preview-latest \
  --region=asia-northeast1 --platform=managed \
  --allow-unauthenticated

gcloud run deploy console-frontend-preview \
  --image=gcr.io/PROJECT_ID/console-frontend:preview-latest \
  --region=asia-northeast1 --platform=managed \
  --allow-unauthenticated
```

说明：后台若需更强周界防护，可不经 Hosting，直接使用 Cloud Run + IAP/Cloud Armor；此时可保留 Hosting 站点以便将来切换。

## 4. 域名绑定
- 生产：
  - `www.${APP_DOMAIN}` → `gm-prod`
  - `console.${APP_DOMAIN}` → `gm-console-prod`（或直连 Cloud Run）
- 预发：
  - `www.urlchecker.dev` → `gm-preview`
  - `console.urlchecker.dev` → `gm-console-preview`

## 5. 环境变量
两端共用新增变量（已写入模板）：
- `STACK=preview|prod`
- `REGION=asia-northeast1`
- `BACKEND_URL=https://<gateway-host>`（API 统一走 Gateway）

模板位置：`.env.preview.template`、`.env.production.template`

## 6. CI/CD 建议
- 保留现有 `cloudbuild.frontend.yaml` 用于构建镜像（不强制改动）。
- 需要一体化时，可新增 Cloud Build 流水线：
  1) 构建 Docker 镜像 → 2) `gcloud run deploy` → 3) `firebase deploy --only hosting:<site>`。

## 7. 验收
- 预发用户端从首页走通“创建并评估→仿真（≤10次）→关联 Ads（只读）→诊断（validate-only）”。
- 后台只读视图可访问（用户/套餐/Token/配置/监控/审计）。
- UI SLO：评估 P95≤10s、Pre-flight P95≤800ms、入队 P95≤1s、首屏 LCP≤2.5s。

