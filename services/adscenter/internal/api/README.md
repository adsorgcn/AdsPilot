# Adscenter API Handlers

本目录包含 adscenter 服务的所有 HTTP 处理器实现，已从 `main.go` 中提取出来，便于维护和测试。

## 目录结构

```
internal/api/
├── README.md              # 本文档
├── router.go              # 路由注册
├── openapi.go             # OpenAPI 实现包装器
├── oauth.go               # OAuth 认证处理器
├── bulk.go                # 批量操作处理器
├── bulk_rollback.go       # 批量操作回滚处理器
├── preflight_handler.go   # 预检查处理器
├── diagnose.go            # 诊断处理器
├── abtest.go              # A/B 测试处理器
├── mcc.go                 # MCC (Manager Customer Center) 处理器
├── keywords.go            # 关键词扩展处理器
├── misc.go                # 其他杂项处理器
└── hashutil.go            # 哈希工具函数
```

## 处理器说明

### OAuth 处理器 (oauth.go)

处理 Google Ads OAuth 认证流程。

**端点**:
- `GET /api/v1/adscenter/oauth/url` - 生成 OAuth 授权 URL
- `GET /api/v1/adscenter/oauth/callback` - OAuth 回调处理

**功能**:
- 生成带签名的 OAuth state
- 处理 OAuth 回调
- 存储和加密 refresh token
- 支持 token 轮换

### 批量操作处理器 (bulk.go)

处理批量广告操作的提交和执行。

**端点**:
- `POST /api/v1/adscenter/bulk-actions` - 提交批量操作计划

**功能**:
- 验证批量操作计划
- 分片处理大批量操作
- 支持幂等性
- Token 预留和提交
- 速率限制

**操作类型**:
- `ROTATE_LINK` - 轮换广告链接
- `ADJUST_CPC` - 调整 CPC 出价
- `ADJUST_BUDGET` - 调整预算
- `PAUSE_CAMPAIGN` - 暂停广告系列
- `ENABLE_CAMPAIGN` - 启用广告系列

### 批量操作回滚处理器 (bulk_rollback.go)

处理批量操作的回滚和审计。

**端点**:
- `POST /api/v1/adscenter/bulk-actions/{id}/rollback` - 回滚批量操作
- `GET /api/v1/adscenter/bulk-actions/{id}/audits` - 获取操作审计日志

**功能**:
- 回滚已执行的操作
- 记录回滚审计
- 恢复原始状态

### 预检查处理器 (preflight_handler.go)

在执行操作前进行预检查。

**端点**:
- `POST /api/v1/adscenter/preflight` - 执行预检查

**功能**:
- 验证账户状态
- 检查 landing URL 可达性
- 验证预算和配额
- 缓存预检查结果

### 诊断处理器 (diagnose.go)

提供广告账户诊断和优化建议。

**端点**:
- `POST /api/v1/adscenter/diagnose` - 诊断账户
- `POST /api/v1/adscenter/diagnose/plan` - 生成优化计划
- `POST /api/v1/adscenter/diagnose/execute` - 执行优化计划
- `GET /api/v1/adscenter/diagnose/metrics` - 获取诊断指标

**功能**:
- 分析账户性能
- 生成优化建议
- 自动生成操作计划
- 执行优化操作

### A/B 测试处理器 (abtest.go)

管理广告 A/B 测试。

**端点**:
- `POST /api/v1/adscenter/ab-tests` - 创建 A/B 测试
- `GET /api/v1/adscenter/ab-tests` - 列出 A/B 测试
- `GET /api/v1/adscenter/ab-tests/{id}` - 获取测试详情
- `POST /api/v1/adscenter/ab-tests/{id}/metrics` - 提交测试指标
- `POST /api/v1/adscenter/ab-tests/{id}/refresh-metrics` - 刷新指标
- `POST /api/v1/adscenter/ab-tests/{id}/graduate` - 结束测试
- `POST /api/v1/adscenter/ab-tests/{id}/apply-winner-plan` - 应用获胜方案

**功能**:
- 创建和管理 A/B 测试
- 收集和分析测试指标
- 统计显著性检验
- 自动推荐获胜方案

### MCC 处理器 (mcc.go)

管理 Google Ads Manager Customer Center (MCC) 账户关联。

**端点**:
- `POST /api/v1/adscenter/mcc/link` - 关联 MCC 账户
- `GET /api/v1/adscenter/mcc/status` - 获取关联状态
- `POST /api/v1/adscenter/mcc/unlink` - 取消关联
- `POST /api/v1/adscenter/mcc/refresh` - 刷新关联状态

**功能**:
- MCC 账户关联请求
- 关联状态跟踪
- 批量账户管理

### 关键词处理器 (keywords.go)

关键词扩展和建议。

**端点**:
- `POST /api/v1/adscenter/keywords/expand` - 扩展关键词

**功能**:
- 基于域名生成关键词
- 基于种子关键词扩展
- 关键词评分和排序
- 支持多国家/地区

### 杂项处理器 (misc.go)

其他辅助功能。

**端点**:
- `GET /api/v1/adscenter/accounts` - 列出广告账户
- `GET /api/v1/adscenter/accounts/{id}` - 获取账户详情
- `POST /api/v1/adscenter/accounts/sync-all` - 同步所有账户
- `POST /api/v1/adscenter/accounts/{id}/sync` - 同步单个账户
- `POST /api/v1/adscenter/accounts/{id}/disconnect` - 断开账户
- `GET /api/v1/adscenter/strategies` - 获取优化策略列表
- `GET /api/v1/adscenter/reports/basic` - 获取基础报告
- `POST /api/v1/adscenter/transfer-budget` - 转移预算

**功能**:
- 账户管理
- 数据同步
- 报告生成
- 预算管理

## 路由注册

所有路由通过 `router.go` 中的 `RegisterRoutes` 函数统一注册：

```go
func RegisterRoutes(r chi.Router, db *sql.DB, rc *pcache.Cache) {
    // 初始化处理器
    oauthHandler := NewOAuthHandler(db)
    bulkHandler := NewBulkActionsHandler(db)
    // ... 其他处理器
    
    // 注册路由
    r.Handle("/api/v1/adscenter/oauth/url", ...)
    // ... 其他路由
}
```

## 中间件

所有处理器都应用以下中间件：

1. **AuthMiddleware**: 验证用户身份
2. **IdempotencyMiddleware**: 确保操作幂等性（批量操作）
3. **RequestID**: 为每个请求生成唯一 ID
4. **Logging**: 记录请求日志
5. **Telemetry**: 收集指标和追踪

## 错误处理

所有处理器使用统一的错误处理：

```go
apperr.Write(w, r, statusCode, errorCode, message, details)
```

错误响应格式：

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {
      "field": "additional info"
    }
  }
}
```

## 测试

每个处理器都应该有对应的测试文件：

```
internal/api/
├── oauth_test.go
├── bulk_test.go
├── diagnose_test.go
└── ...
```

测试示例：

```go
func TestOAuthHandler_HandleOAuthURL(t *testing.T) {
    db := setupTestDB(t)
    defer db.Close()
    
    handler := NewOAuthHandler(db)
    
    req := httptest.NewRequest("GET", "/api/v1/adscenter/oauth/url", nil)
    req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "test-user"))
    
    w := httptest.NewRecorder()
    handler.HandleOAuthURL(w, req)
    
    assert.Equal(t, http.StatusOK, w.Code)
}
```

## 依赖

- `database/sql`: 数据库访问
- `pkg/cache`: Redis/Valkey 缓存
- `pkg/middleware`: 中间件
- `pkg/errors`: 错误处理
- `internal/oapi`: OpenAPI 生成的类型

## 迁移状态

### ✅ 已迁移

- OAuth 处理器
- 批量操作处理器
- 批量回滚处理器
- 预检查处理器
- 诊断处理器
- A/B 测试处理器
- MCC 处理器
- 关键词处理器
- 杂项处理器

### 🔄 待迁移

目前所有主要处理器已迁移完成。`main.go` 中剩余的是：
- 辅助函数（如 `loadAdscenterTokenCost`, `billingAction`）
- 幂等性辅助函数（`idemLookup`, `idemUpsert`）
- 全局变量和初始化代码

这些将在后续任务中处理。

## 最佳实践

1. **处理器结构**: 每个处理器都是一个结构体，包含必要的依赖
2. **构造函数**: 使用 `New*Handler` 函数创建处理器实例
3. **方法命名**: 使用 `Handle*` 前缀命名处理器方法
4. **错误处理**: 使用 `apperr.Write` 统一错误响应
5. **上下文**: 从请求上下文中提取用户 ID 和其他信息
6. **日志**: 使用结构化日志记录重要操作
7. **指标**: 记录关键操作的 Prometheus 指标

## 下一步

- [ ] 添加处理器单元测试
- [ ] 添加集成测试
- [ ] 完善错误处理
- [ ] 添加更多指标
- [ ] 优化性能
