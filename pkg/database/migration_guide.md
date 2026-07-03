# 数据库适配器统一迁移指南

## 概述

本指南帮助各服务迁移到统一的数据库适配器架构，支持从DirectMode到DBAdminMode的平滑过渡。

## 迁移步骤

### 1. 替换适配器初始化

**之前的代码**:
```go
// 旧的适配器初始化方式
adapter, err := NewAdapter("service-name", databaseURL)
if err != nil {
    log.Fatal(err)
}
```

**新的代码**:
```go
// 新的统一适配器初始化方式
adapter, err := database.GetAdapterForService("service-name")
if err != nil {
    log.Fatal(err)
}
```

### 2. 更新接口调用

**之前的代码**:
```go
// 直接使用底层连接
rows, err := adapter.GetDB().QueryContext(ctx, query, args...)
```

**新的代码**:
```go
// 使用统一接口
rows, err := adapter.Query(ctx, query, args...)
```

### 3. 处理DBAdmin模式的查询结果

由于DBAdmin模式返回的结果类型不同，需要在服务中进行适配：

```go
// 根据适配器模式处理查询结果
switch adapter.GetMode() {
case database.DirectMode, database.HybridMode:
    // 标准database/sql.Rows处理
    rows, err := adapter.Query(ctx, query, args...)
    if err != nil {
        return err
    }
    defer rows.Close()

    for rows.Next() {
        // 处理结果
    }

case database.DBAdminMode:
    // 使用DBAdminRows处理
    result, err := dbAdminClient.ExecuteQuery(ctx, serviceName, query, args...)
    if err != nil {
        return err
    }

    dbRows := database.NewDBAdminRows(result)
    defer dbRows.Close()

    for dbRows.Next() {
        // 处理结果（与标准Rows相同的Scan接口）
    }
}
```

### 4. 环境变量配置

各服务需要配置以下环境变量：

```bash
# 数据库连接模式 (direct|hybrid|dbadmin)
DB_CONNECTION_MODE=dbadmin

# 数据库连接URL
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# 只读副本URL（可选）
DATABASE_READ_URL=postgres://user:pass@localhost:5432/replica

# db-admin服务URL
DB_ADMIN_URL=http://db-admin:8080

# 服务间认证token
SERVICE_AUTH_TOKEN=your-service-token
```

## 服务迁移清单

### ✅ 已完成迁移的服务
- recommendations (部分迁移，需要完善DBAdmin模式)
- console (已创建适配器，需要迁移到统一接口)

### 🔄 待迁移的服务
- [ ] adscenter
- [ ] useractivity
- [ ] billing
- [ ] user
- [ ] projector
- [ ] batchopen

## 迁移示例

### Console服务迁移示例

```go
// cmd/server/main.go
package main

import (
    "context"
    "log"
    "github.com/ScientificInternet/Google-Monetize/pkg/database"
    "github.com/ScientificInternet/Google-Monetize/services/console/internal/handlers"
)

func main() {
    ctx := context.Background()

    // 使用统一适配器
    adapter, err := database.GetAdapterForService("console")
    if err != nil {
        log.Fatalf("Failed to create adapter: %v", err)
    }
    defer adapter.Close()

    // 检查连接
    if err := adapter.Ping(ctx); err != nil {
        log.Fatalf("Failed to ping database: %v", err)
    }

    // 创建处理器
    handler := handlers.NewHandler(adapter)

    // 启动服务...
}
```

### 处理器层适配

```go
// internal/handlers/users_handlers.go
package handlers

import (
    "context"
    "database/sql"
    "github.com/ScientificInternet/Google-Monetize/pkg/database"
)

type Handler struct {
    DB database.DatabaseAdapter
}

func NewHandler(adapter database.DatabaseAdapter) *Handler {
    return &Handler{
        DB: adapter,
    }
}

func (h *Handler) getUsers(w http.ResponseWriter, r *http.Request) {
    // 使用统一接口
    switch h.DB.GetMode() {
    case database.DirectMode, database.HybridMode:
        rows, err := h.DB.Query(r.Context(), query, args...)
        // 标准处理逻辑

    case database.DBAdminMode:
        // DBAdmin模式处理逻辑
        // 注意：这里需要根据实际实现调整
        rows, err := h.DB.Query(r.Context(), query, args...)
        // 处理逻辑
    }
}
```

## 最佳实践

1. **渐进式迁移**: 先支持DirectMode，再逐步添加DBAdminMode支持
2. **错误处理**: 为不同模式提供适当的错误处理
3. **测试覆盖**: 确保所有模式都有相应的测试
4. **监控**: 添加适配器模式和性能指标的监控
5. **文档更新**: 及时更新服务文档和配置说明

## 注意事项

1. **事务处理**: DBAdmin模式的事务处理需要服务端支持
2. **性能考虑**: DBAdmin模式可能有额外的网络延迟
3. **错误映射**: 确保db-admin的错误正确映射到应用层错误
4. **连接池管理**: 不同模式的连接池管理策略不同