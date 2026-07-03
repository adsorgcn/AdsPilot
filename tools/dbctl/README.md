# dbctl - 数据库管理CLI工具

dbctl 是用于管理Google-Monetize数据库的命令行工具，通过 db-admin 服务提供统一的数据库操作接口。

## 功能特性

- ✅ **统一数据库管理**: 通过 db-admin 服务统一管理所有数据库操作
- ✅ **DDL 迁移管理**: 完整的数据库迁移和DDL变更管理
- ✅ **备份恢复**: 自动化备份和恢复操作
- ✅ **审计日志**: 完整的操作审计和历史记录
- ✅ **Schema 验证**: 自动化Schema验证和完整性检查
- ✅ **批量操作**: 支持批量服务和数据库操作

## 安装

```bash
cd tools/dbctl
go build -o dbctl main.go
sudo mv dbctl /usr/local/bin/
```

## 配置

### 环境变量
```bash
export DB_ADMIN_URL="https://db-admin-preview-xxxxx.a.run.app"
export DB_ADMIN_TOKEN="your-jwt-token"
```

### 配置文件
在 `~/.dbctl.yaml` 中创建配置：
```yaml
admin_url: "https://db-admin-preview-xxxxx.a.run.app"
token: "your-jwt-token"
```

## 使用方法

### 基本命令

```bash
# 检查所有数据库状态
dbctl status

# 连接到特定服务的数据库
dbctl connect useractivity

# 查看数据库schema
dbctl schema useractivity

# 执行SQL查询
dbctl sql useractivity "SELECT * FROM user_notifications LIMIT 10"

# 执行SQL脚本
dbctl script useractivity scripts/init-data.sql

# 查看迁移历史
dbctl history useractivity

# 创建备份
dbctl backup useractivity

# 恢复备份
dbctl restore useractivity backup_123456

# 验证schema
dbctl validate useractivity

# 查看审计日志
dbctl logs

# 部署所有schema变更
dbctl deploy-schemas
```

### DDL 管理

```bash
# 创建新的DDL迁移文件
dbctl ddl create useractivity 001 --author "admin@scientificinternet.com"

# 验证DDL迁移文件
dbctl ddl validate useractivity 001

# 列出服务的所有迁移
dbctl ddl list useractivity

# 应用DDL迁移（预览环境）
dbctl ddl apply useractivity 001 --env=preview

# 回滚DDL迁移
dbctl ddl rollback useractivity 001 --confirm

# 查看DDL状态
dbctl ddl status useractivity

# 查看执行计划
dbctl ddl plan useractivity 001

# 从代码中提取DDL
dbctl ddl extract useractivity

# 初始化服务的DDL管理
dbctl ddl init useractivity

# 部署DDL变更
dbctl ddl deploy useractivity --env=production
```

### 服务列表

支持的服务：
- `useractivity` - 用户活动和通知
- `billing` - 计费和订阅
- `offer` - Offer管理
- `siterank` - 网站排名
- `adscenter` - 广告中心
- `frontend` - 前端认证（Supabase）
- `auth` - 认证服务（Supabase）

## 示例用法

### 开发环境设置
```bash
# 1. 设置环境变量
export DB_ADMIN_URL="http://localhost:8080"  # 本地开发
export DB_ADMIN_TOKEN="dev-token"

# 2. 检查状态
dbctl status

# 3. 初始化useractivity数据库
dbctl script useractivity ../../scripts/db/init-useractivity.sql

# 4. 验证schema
dbctl validate useractivity
```

### CI/CD集成
```bash
#!/bin/bash
# ci-deploy-schemas.sh

# 设置环境变量
export DB_ADMIN_URL="${DB_ADMIN_URL}"
export DB_ADMIN_TOKEN="${DB_ADMIN_TOKEN}"

# 验证所有schema
echo "Validating all schemas..."
dbctl deploy-schemas

if [ $? -eq 0 ]; then
    echo "✅ All schemas validated successfully"
else
    echo "❌ Schema validation failed"
    exit 1
fi
```

### 备份和恢复
```bash
# 创建备份
dbctl backup useractivity

# 查看备份历史
dbctl connect useractivity | jq '.backups'

# 执行数据恢复（通过db-admin Web界面或API）
```

## 高级用法

### 批量操作
```bash
# 对所有Cloud SQL服务执��操作
for service in useractivity billing offer siterank adscenter; do
    echo "Processing $service..."
    dbctl validate $service
done
```

### 监控和健康检查
```bash
# 定期检查脚本
#!/bin/bash
# monitor-databases.sh

while true; do
    dbctl status | jq '.services[] | select(.status != "active")'
    sleep 60
done
```

### 开发工作流
```bash
# 1. 开发新功能
echo "ALTER TABLE user_notifications ADD COLUMN priority INTEGER;" > migration.sql

# 2. 测试schema变更
dbctl script useractivity migration.sql

# 3. 验证结果
dbctl sql useractivity "SELECT column_name FROM information_schema.columns WHERE table_name='user_notifications'"

# 4. 清理
rm migration.sql
```

## 故障排查

### 连接问题
```bash
# 检查db-admin服务状态
curl -H "Authorization: $DB_ADMIN_TOKEN" \
     "$DB_ADMIN_URL/api/v1/health"

# 检查网络连接
ping db-admin-preview-xxxxx.a.run.app
```

### 认证问题
```bash
# 验证token
curl -H "Authorization: $DB_ADMIN_TOKEN" \
     "$DB_ADMIN_URL/api/v1/services"
```

### 权限问题
确保JWT token包含admin权限，或使用有效的服务账号token。

## 配置选项

| 选项 | 环境变量 | 配置文件 | 默认值 |
|------|----------|----------|--------|
| Admin URL | `DB_ADMIN_URL` | `admin_url` | `http://localhost:8080` |
| Token | `DB_ADMIN_TOKEN` | `token` | 无 |

## 贡献

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 许可证

MIT License