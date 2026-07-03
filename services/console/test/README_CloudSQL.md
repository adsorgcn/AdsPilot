# Cloud SQL 集成测试指南

## 概述

Console服务使用**Cloud SQL PostgreSQL数据库**（而非Supabase）。本地集成测试需要通过Cloud SQL Proxy连接到预发环境的Cloud SQL实例。

## 数据库架构

### Cloud SQL 实例信息
- **实例名称**: `gm`
- **连接名**: `${GCP_PROJECT_ID}:asia-northeast1:gm`
- **数据库**: `gm_db`
- **内网IP**: `10.6.0.2:5432`
- **访问方式**: VPC Connector (cr-conn-default-ane1) 或 Cloud SQL Proxy

### 数据库用途
- **Cloud SQL**: Console服务主数据库（后台管理数据）
- **Supabase**: 前端认证、用户数据

## 前置条件

### 1. 安装 Cloud SQL Proxy

**macOS**:
```bash
brew install cloud-sql-proxy
```

**Linux/其他**:
```bash
curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/
```

### 2. 验证 GCP 认证

```bash
gcloud auth application-default login
# 或使用服务账号
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gm/secrets/gcp_codex_dev.json
```

### 3. 测试 Cloud SQL Proxy 连接

```bash
# 启动 Cloud SQL Proxy（前台运行）
cloud-sql-proxy ${GCP_PROJECT_ID}:asia-northeast1:gm --port 5432

# 或后台运行
cloud-sql-proxy ${GCP_PROJECT_ID}:asia-northeast1:gm --port 5432 &
```

成功输出示例：
```
Listening on 127.0.0.1:5432
Ready for new connections
```

### 4. 验证数据库连接

```bash
# 获取数据库密码
DB_PASSWORD=$(gcloud secrets versions access latest --secret="DATABASE_URL" \
  --project=${GCP_PROJECT_ID} | \
  sed -n 's/.*postgres:\([^@]*\)@.*/\1/p' | \
  python3 -c "import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read().strip()))")

# 使用 psql 连接
psql "postgresql://postgres:${DB_PASSWORD}@localhost:5432/gm_db"

# 或使用 URL 格式
psql "$(gcloud secrets versions access latest --secret="DATABASE_URL" \
  --project=${GCP_PROJECT_ID} | \
  sed 's/@10\.6\.0\.2/@localhost/')"
```

## 运行集成测试

### 方式1: 使用测试脚本（推荐）

```bash
cd services/console

# 运行所有 Cloud SQL 集成测试
./test/run_cloudsql_integration_tests.sh

# 生成覆盖率报告
./test/run_cloudsql_integration_tests.sh --coverage
```

**脚本自动处理**:
- ✅ 检查 Cloud SQL Proxy 是否已安装
- ✅ 从 Secret Manager 获取数据库密码
- ✅ 启动 Cloud SQL Proxy（如果未运行）
- ✅ 运行集成测试
- ✅ 测试完成后停止 Proxy

### 方式2: 手动运行

```bash
# 1. 手动启动 Cloud SQL Proxy
cloud-sql-proxy ${GCP_PROJECT_ID}:asia-northeast1:gm --port 5432 &

# 2. 设置数据库密码环境变量
export CLOUDSQL_DB_PASSWORD='$GL(~x]T2Q[M@uX4'

# 3. 运行测试
cd services/console
go test -v -count=1 -tags=cloudsql ./test/

# 4. 停止 Cloud SQL Proxy
pkill cloud-sql-proxy
```

## 测试文件说明

### 使用 Build Tags

所有 Cloud SQL 测试文件使用 `//go:build cloudsql` 标签：

```go
//go:build cloudsql
// +build cloudsql

package test
```

**优点**:
- 默认 `go test` 不运行这些测试
- 需要显式指定 `-tags=cloudsql` 才会运行
- 避免本地开发时误触发Cloud SQL连接

### 测试文件列表

| 文件 | 测试内容 | 测试数量 |
|------|---------|---------|
| `cloudsql_integration_test_config.go` | 数据库连接配置 | - |
| `cloudsql_export_center_test.go` | Export Center功能 | 3 |
| `cloudsql_feature_flags_test.go` | Feature Flags功能 | 4 |
| `cloudsql_notifications_test.go` | Notifications功能 | 4 |

## 测试数据管理

### 自动清理

每个测试使用唯一的用户ID前缀：
```go
testUserID := "cloudsql-test-" + time.Now().Format("20060102150405")
defer config.CleanupTestData(ctx, testUserID)
```

**清理范围**:
- export_history
- feature_flags
- feature_flag_history
- notification_templates
- notification_broadcasts
- nps_feedback

### 手动清理

如果测试异常中断，可手动清理：

```sql
-- 连接数据库
psql "postgresql://postgres:PASSWORD@localhost:5432/gm_db"

-- 查看测试数据
SELECT * FROM export_history WHERE created_by LIKE 'cloudsql-test-%';

-- 删除所有测试数据
DELETE FROM export_history WHERE created_by LIKE 'cloudsql-test-%';
DELETE FROM feature_flags WHERE updated_by LIKE 'cloudsql-test-%';
DELETE FROM feature_flag_history WHERE changed_by LIKE 'cloudsql-test-%';
DELETE FROM notification_templates WHERE created_by LIKE 'cloudsql-test-%';
DELETE FROM notification_broadcasts WHERE created_by LIKE 'cloudsql-test-%';
```

## 故障排查

### 问题1: Cloud SQL Proxy 连接失败

**错误**:
```
Error: failed to ping database (is Cloud SQL Proxy running?)
```

**解决方案**:
1. 检查 Cloud SQL Proxy 是否运行:
   ```bash
   lsof -i :5432
   ```

2. 检查 GCP 认证:
   ```bash
   gcloud auth application-default print-access-token
   ```

3. 验证实例连接名:
   ```bash
   gcloud sql instances describe gm --project=${GCP_PROJECT_ID}
   ```

### 问题2: 权限错误

**错误**:
```
ERROR: permission denied for table export_history
```

**解决方案**:
- 确认使用的是 `postgres` 用户（超级用户）
- 检查数据库密码是否正确

### 问题3: 端口被占用

**错误**:
```
Error: listen tcp 127.0.0.1:5432: bind: address already in use
```

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :5432

# 停止 Cloud SQL Proxy
pkill cloud-sql-proxy

# 或使用不同端口
cloud-sql-proxy INSTANCE --port 15432
# 然后修改连接字符串为 localhost:15432
```

### 问题4: 密码特殊字符问题

**错误**:
```
invalid port ":$GL" after host
```

**解决方案**:
密码已在代码中自动URL编码：
```go
encodedPassword := url.QueryEscape(dbPassword)
```

如果仍有问题，手动编码：
```bash
python3 -c "from urllib.parse import quote; print(quote('$GL(~x]T2Q[M@uX4', safe=''))"
```

## CI/CD 集成

### GitHub Actions 配置

```yaml
name: Cloud SQL Integration Tests

on:
  pull_request:
    paths:
      - 'services/console/**'

jobs:
  cloudsql-integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Setup Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          service_account_key: ${{ secrets.GCP_SA_KEY }}
          project_id: ${GCP_PROJECT_ID}

      - name: Install Cloud SQL Proxy
        run: |
          curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
          chmod +x cloud-sql-proxy

      - name: Start Cloud SQL Proxy
        run: |
          ./cloud-sql-proxy ${GCP_PROJECT_ID}:asia-northeast1:gm --port 5432 &
          sleep 5

      - name: Run Integration Tests
        run: |
          cd services/console
          export CLOUDSQL_DB_PASSWORD=$(gcloud secrets versions access latest --secret="DATABASE_URL" | sed -n 's/.*postgres:\([^@]*\)@.*/\1/p' | python3 -c "import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read().strip()))")
          go test -v -count=1 -tags=cloudsql ./test/
```

## 性能基准

| 测试套件 | 测试数 | 预期时间 |
|---------|-------|---------|
| Export Center | 3 | ~2秒 |
| Feature Flags | 4 | ~3秒 |
| Notifications | 4 | ~3秒 |
| **总计** | **11** | **~8秒** |

## 与 Supabase 测试的对比

| 特性 | Cloud SQL 测试 | Supabase 测试 |
|------|---------------|--------------|
| **数据库** | Cloud SQL PostgreSQL | Supabase PostgreSQL |
| **访问方式** | Cloud SQL Proxy | 直接连接（外网） |
| **用途** | Console服务主数据库 | 前端认证测试 |
| **Build Tag** | `-tags=cloudsql` | 无（默认） |
| **测试文件** | `cloudsql_*.go` | `*_integration_test.go` |
| **数据隔离** | `cloudsql-test-*` | `integration-test-*` |

## 最佳实践

1. **本地开发**: 保持 Cloud SQL Proxy 在后台运行
2. **测试隔离**: 使用唯一时间戳userID
3. **数据清理**: 始终使用 `defer config.CleanupTestData()`
4. **错误日志**: 测试失败时输出完整响应体
5. **CI/CD**: 使用 GitHub Actions Secret 管理凭证

## 参考资源

- [Cloud SQL Proxy 文档](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Console服务配置](../internal/config/config.go)
- [数据库架构文档](../../../docs/SupabaseGo/MustKnowV6.md)
