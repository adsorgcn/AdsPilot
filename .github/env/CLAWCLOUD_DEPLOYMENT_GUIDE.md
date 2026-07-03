# ClawCloud 部署配置模板

## Preview 环境配置

### 基础设置
- **应用名称**: gm-preview
- **镜像**: ghcr.io/ScientificInternet/url-batch-checker:preview-latest
- **端口**: 3000

### 资源配置
- **CPU**: 500m
- **内存**: 1Gi
- **实例数**: 1

### 环境变量
```bash
# 应用配置
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# 域名配置
NEXT_PUBLIC_DOMAIN=your-preview-domain.clawcloud.run
NEXT_PUBLIC_BASE_URL=https://your-preview-domain.clawcloud.run

# Google Ads API (Preview)
NEXT_PUBLIC_GOOGLE_ADS_API_VERSION=v14
NEXT_PUBLIC_GOOGLE_ADS_SCOPE=https://www.googleapis.com/auth/adwords
GOOGLE_CLIENT_ID=your_preview_client_id
GOOGLE_CLIENT_SECRET=your_preview_client_secret
GOOGLE_DEVELOPER_TOKEN=your_preview_dev_token
GOOGLE_REFRESH_TOKEN=your_preview_refresh_token

# SimilarWeb API (Preview)
SIMILARWEB_API_KEY=your_preview_similarweb_key

# 数据库 (Preview)
DATABASE_URL=your_preview_database_url

# 其他服务
NEXT_PUBLIC_GA_TRACKING_ID=your_preview_ga_id
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### 高级配置
- **健康检查**: /api/health
- **存储**: 无需持久化存储
- **域名**: 绑定自定义域名（可选）

---

## Production 环境配置

### 基础设置
- **应用名称**: gm-prod
- **镜像**: ghcr.io/ScientificInternet/url-batch-checker:prod-latest
- **端口**: 3000

### 资源配置
- **CPU**: 1000m
- **内存**: 2Gi
- **实例数**: 2
- **自动扩缩容**: 启用 (最大 5 实例)

### 环境变量
```bash
# 应用配置
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
PORT=3000
HOSTNAME=0.0.0.0

# 域名配置
NEXT_PUBLIC_DOMAIN=your-prod-domain.com
NEXT_PUBLIC_BASE_URL=https://your-prod-domain.com

# Google Ads API (Production)
NEXT_PUBLIC_GOOGLE_ADS_API_VERSION=v14
NEXT_PUBLIC_GOOGLE_ADS_SCOPE=https://www.googleapis.com/auth/adwords
GOOGLE_CLIENT_ID=your_prod_client_id
GOOGLE_CLIENT_SECRET=your_prod_client_secret
GOOGLE_DEVELOPER_TOKEN=your_prod_dev_token
GOOGLE_REFRESH_TOKEN=your_prod_refresh_token

# SimilarWeb API (Production)
SIMILARWEB_API_KEY=your_prod_similarweb_key

# 数据库 (Production)
DATABASE_URL=your_prod_database_url

# 其他服务
NEXT_PUBLIC_GA_TRACKING_ID=your_prod_ga_id
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

### 高级配置
- **健康检查**: /api/health
- **存储**: 无需持久化存储
- **域名**: 绑定自定义域名
- **HTTPS**: 自动启用
- **CDN**: 启用（可选）

---

## 部署步骤

### 1. 登录 ClawCloud 控制台
访问：https://console.run.claw.cloud

### 2. 创建新应用
1. 点击 "App Launchpad"
2. 选择 "Deploy from Docker Image"
3. 填写应用信息

### 3. 配置应用
1. **基础设置**
   - 输入应用名称
   - 粘贴 Docker 镜像 URL
   - 设置端口为 3000

2. **资源配置**
   - 根据环境选择合适的 CPU/内存
   - 设置实例数

3. **环境变量**
   - 点击 "Environment Variables"
   - 批量粘贴对应环境的变量
   - 确保所有敏感信息已正确配置

4. **高级设置**
   - 配置健康检查路径
   - 绑定自定义域名（如需要）

### 4. 部署应用
1. 点击 "Deploy"
2. 等待部署完成
3. 检查应用状态和日志

### 5. 验证部署
1. 访问应用 URL
2. 测试主要功能
3. 检查日志确保无错误

---

## 更新部署

### 更新镜像版本
1. GitHub Actions 会自动构建新镜像
2. 复制新镜像标签（包含 commit hash）
3. 在 ClawCloud 控制台：
   - 进入应用设置
   - 更新镜像标签
   - 点击 "Redeploy"

### 回滚版本
1. 在应用历史记录中选择之前的版本
2. 点击 "Rollback"
3. 确认回滚操作

---

## 监控和维护

### 查看应用状态
- **实时监控**: CPU、内存使用率
- **日志查看**: 实时应用日志
- **事件记录**: 部署和配置变更历史

### 性能优化
- **自动扩缩容**: 根据负载自动调整实例数
- **资源调整**: 根据需要调整 CPU/内存限制
- **CDN 配置**: 启用 CDN 加速静态资源

### 备份和恢复
- **配置备份**: 定期导出环境变量配置
- **数据备份**: 确保数据库定期备份
- **灾难恢复**: 准备回滚和恢复方案