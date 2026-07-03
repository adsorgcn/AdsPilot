# 已下线的工作流 (Disabled Workflows)

## database-migration-cloudrun.yml

**下线日期**: 2025-10-23
**下线原因**: 实现了更高效的本地Cloud SQL公网访问方式

### 工作流历史
这个GitHub Actions工作流曾经用于：
- 自动构建db-migrator Docker镜像
- 通过Cloud Run Job执行数据库迁移
- 支持preview和production环境
- 提供数据库重置功能

### 替代方案
现在采用**本地Cloud SQL公网访问**方式：

1. **开发环境**：
   ```bash
   ./scripts/db/setup-local-db-access.sh
   psql "postgresql://postgres:PASSWORD@35.243.74.175:5432/gm_db?sslmode=require" \
       -f services/user/migrations/000001_create_user_domain_schema.up.sql
   ```

2. **生产环境**：
   - 使用相同的本地访问方式
   - 确保操作的可追溯性和安全性
   - 记录所有数据库变更操作

### 优势对比

| 方面 | Cloud Run Job方式 | 本地公网访问方式 |
|------|------------------|------------------|
| 执行时间 | 10-15分钟 | 30秒 |
| 调试难度 | 困难(容器内) | 简单(本地工具) |
| 迭代速度 | 慢(需重建镜像) | 快(直接修改) |
| 错误定位 | 复杂(查看日志) | 简单(实时反馈) |
| 资源消耗 | 高(Docker+Cloud Run) | 低(本地连接) |

### 备份文件
- `database-migration-cloudrun.yml.backup-20251023-021900`: 原始工作流配置备份

### 恢复步骤 (如需要)
如果未来需要恢复此工作流：
1. 从备份文件恢复到 `.github/workflows/`
2. 更新相关配置和权限
3. 验证Cloud Build和Cloud Run配置
4. 测试工作流执行

---

**注意**: 下线工作流的目的是为了提高开发效率和简化运维复杂度，同时保持数据库操作的安全性和可追溯性。