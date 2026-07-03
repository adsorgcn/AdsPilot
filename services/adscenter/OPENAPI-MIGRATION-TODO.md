# OpenAPI 迁移待办事项

## 状态
✅ **已完成** - OpenAPI 处理器已迁移并挂载

## 背景

在简化 main.go 的过程中，我们成功地将代码从 2612 行减少到 90 行。主要的 API 端点已经通过 `internal/api/router.go` 注册并正常工作。

然而，OpenAPI 生成的处理器实现（oasImpl）仍然在 `main_old.go.bak` 中，需要迁移到 `internal/api/` 包。

## 当前状态

### ✅ 已完成
- 主要 API 端点通过 `internal/api/router.go` 注册
- 所有核心功能正常工作
- 服务可以正常构建和运行

### ⏳ 待完成
- OpenAPI 生成的处理器实现（oasImpl）迁移
- OpenAPI 处理器在 server.go 中挂载

## oasImpl 需要实现的方法

根据 `main_old.go.bak` 中的实现，oasImpl 需要实现以下方法：

### OAuth 相关
- [x] `ListAccounts` - 已通过 router.go 注册
- [x] `GetOAuthUrl` - 已通过 router.go 注册
- [x] `OauthCallback` - 已通过 router.go 注册
- [ ] `OauthRevoke` - 需要迁移

### 批量操作相关
- [x] `SubmitBulkActions` - 已通过 router.go 注册
- [ ] `ListBulkActions` - 需要迁移
- [ ] `GetBulkAction` - 需要迁移
- [ ] `GetBulkActionPlan` - 需要迁移
- [ ] `ValidateBulkActions` - 需要迁移

### 回滚相关
- [x] `GetBulkActionAudits` - 已通过 router.go 注册
- [x] `RollbackBulkAction` - 已通过 router.go 注册
- [ ] `GetRollbackPlan` - 需要迁移
- [ ] `RollbackExecute` - 需要迁移
- [ ] `GetRollbackReport` - 需要迁移

### MCC 相关
- [x] `MccLink` - 已通过 router.go 注册
- [x] `MccStatus` - 已通过 router.go 注册
- [x] `MccUnlink` - 已通过 router.go 注册
- [x] `MccRefresh` - 已通过 router.go 注册
- [ ] `ListMccLinks` - 需要迁移

### 诊断相关
- [x] `Diagnose` - 已通过 router.go 注册
- [x] `DiagnosePlan` - 已通过 router.go 注册
- [x] `DiagnoseExecute` - 已通过 router.go 注册
- [x] `GetDiagnoseMetrics` - 已通过 router.go 注册

### 关键词相关
- [x] `ExpandKeywords` - 已通过 router.go 注册

### 预检查相关
- [x] `RunPreflight` - 已通过 router.go 注册

### 设置相关
- [ ] `GetLinkRotationSettings` - 需要迁移
- [ ] `UpdateLinkRotationSettings` - 需要迁移

### 审计相关
- [ ] `ListAuditEvents` - 需要迁移

### 连接相关
- [ ] `ListAdsConnections` - 需要迁移

### 其他
- [ ] `GetLimitsMe` - 需要迁移（当前返回 not implemented）

## 迁移计划

### 阶段 1: 准备工作
- [ ] 创建 `internal/api/openapi_impl.go`
- [ ] 定义 OASImpl 结构体
- [ ] 添加必要的辅助函数

### 阶段 2: 迁移简单方法
这些方法只是简单地委托给现有的处理器：
- [ ] OAuth 相关方法
- [ ] MCC 相关方法
- [ ] 诊断相关方法
- [ ] 关键词相关方法
- [ ] 预检查相关方法

### 阶段 3: 迁移复杂方法
这些方法包含复杂的业务逻辑：
- [ ] `ListBulkActions` - 包含 offerId 过滤逻辑
- [ ] `GetRollbackPlan` - 包含回滚计划生成逻辑
- [ ] `ValidateBulkActions` - 包含验证逻辑
- [ ] `RollbackExecute` - 包含回滚执行逻辑
- [ ] `GetRollbackReport` - 包含报告生成逻辑

### 阶段 4: 迁移设置和审计
- [ ] `GetLinkRotationSettings`
- [ ] `UpdateLinkRotationSettings`
- [ ] `ListAuditEvents`
- [ ] `ListMccLinks`
- [ ] `ListAdsConnections`

### 阶段 5: 集成和测试
- [ ] 在 `server.go` 中挂载 OpenAPI 处理器
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 验证所有端点

## 实施建议

### 1. 创建 openapi_impl.go

```go
package api

import (
    "database/sql"
    "net/http"
    
    pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
    api "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
)

// OASImpl implements the OpenAPI server interface
type OASImpl struct {
    DB    *sql.DB
    Cache *pcache.Cache
}

// NewOASImpl creates a new OpenAPI implementation
func NewOASImpl(db *sql.DB, cache *pcache.Cache) *OASImpl {
    return &OASImpl{
        DB:    db,
        Cache: cache,
    }
}

// 实现所有 OpenAPI 接口方法...
```

### 2. 迁移策略

对于每个方法：

1. **简单委托**: 如果方法只是委托给现有处理器，直接复制
2. **复杂逻辑**: 如果包含复杂逻辑，考虑：
   - 提取到独立的处理器
   - 或者保留在 openapi_impl.go 中，但添加详细注释

### 3. 辅助函数

需要迁移的辅助函数：
- `writeJSON` - JSON 响应写入
- `openDB` - 数据库连接
- `toString` - 类型转换
- `toMap` - 类型转换
- `int64From` - 类型转换

这些可以放在 `internal/api/helpers.go` 中。

## 优先级

### 高优先级（核心功能）
1. `ListBulkActions` - 列出批量操作
2. `GetBulkAction` - 获取批量操作详情
3. `ValidateBulkActions` - 验证批量操作
4. `GetRollbackPlan` - 获取回滚计划
5. `RollbackExecute` - 执行回滚

### 中优先级（常用功能）
6. `ListAuditEvents` - 审计日志
7. `ListMccLinks` - MCC 链接列表
8. `GetLinkRotationSettings` - 链接轮换设置
9. `UpdateLinkRotationSettings` - 更新设置

### 低优先级（辅助功能）
10. `OauthRevoke` - OAuth 撤销
11. `ListAdsConnections` - 连接列表
12. `GetLimitsMe` - 限制信息
13. `GetRollbackReport` - 回滚报告

## 测试计划

### 单元测试
- [ ] 测试每个 OpenAPI 方法
- [ ] 测试错误处理
- [ ] 测试边界条件

### 集成测试
- [ ] 测试完整的请求/响应流程
- [ ] 测试与数据库的交互
- [ ] 测试与缓存的交互

### 端到端测试
- [ ] 测试真实的 API 调用
- [ ] 测试认证和授权
- [ ] 测试速率限制

## 估算

- **阶段 1-2**: 2-3 小时（简单方法迁移）
- **阶段 3**: 4-6 小时（复杂方法迁移）
- **阶段 4**: 2-3 小时（设置和审计）
- **阶段 5**: 3-4 小时（集成和测试）

**总计**: 11-16 小时

## 风险和缓解

### 风险 1: 复杂业务逻辑
**缓解**: 
- 保持原有逻辑不变
- 添加详细注释
- 进行充分测试

### 风险 2: 破坏现有功能
**缓解**:
- 保留 main_old.go.bak 作为参考
- 逐步迁移，每次迁移后测试
- 使用特性开关控制新旧实现

### 风险 3: 测试覆盖不足
**缓解**:
- 编写全面的单元测试
- 进行集成测试
- 在测试环境充分验证

## 参考资料

- `main_old.go.bak` - 原始实现
- `internal/api/router.go` - 现有路由注册
- `internal/oapi/` - OpenAPI 生成的类型
- OpenAPI 规范文件

## 下一步

1. 创建 `internal/api/openapi_impl.go`
2. 创建 `internal/api/helpers.go`
3. 开始迁移简单方法
4. 逐步迁移复杂方法
5. 添加测试
6. 在 server.go 中挂载

---

**注意**: 这是一个独立的任务，不影响当前服务的正常运行。主要 API 端点已经通过 `internal/api/router.go` 注册并正常工作。
