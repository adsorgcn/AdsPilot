# Adscenter API 测试指南

本文档说明如何运行和编写 adscenter API 处理器的测试。

## 测试结构

```
internal/api/
├── oauth_test.go              # OAuth 处理器测试
├── bulk_test.go               # 批量操作处理器测试
├── diagnose_test.go           # 诊断处理器测试
├── test_helpers.go            # 测试辅助函数
└── README_TESTING.md          # 本文档
```

## 运行测试

### 运行所有测试

```bash
# 从项目根目录
go test ./services/adscenter/internal/api/... -v

# 只运行单元测试（跳过集成测试）
go test ./services/adscenter/internal/api/... -v -short
```

### 运行特定测试

```bash
# OAuth 测试
go test ./services/adscenter/internal/api/... -run TestOAuth -v

# 批量操作测试
go test ./services/adscenter/internal/api/... -run TestBulkActions -v

# 诊断测试
go test ./services/adscenter/internal/api/... -run TestDiagnose -v
```

### 生成覆盖率报告

```bash
go test ./services/adscenter/internal/api/... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

## 测试类型

### 1. 单元测试

测试单个处理器的行为，不依赖外部服务：

```go
func TestOAuthHandler_HandleOAuthURL(t *testing.T) {
    handler := NewOAuthHandler(nil)
    req := httptest.NewRequest("GET", "/oauth/url", nil)
    w := httptest.NewRecorder()
    
    handler.HandleOAuthURL(w, req)
    
    assert.Equal(t, http.StatusUnauthorized, w.Code)
}
```

### 2. 集成测试

测试与数据库、外部服务的集成（使用 `-short` 标志跳过）：

```go
func TestHandler_Integration(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping integration test")
    }
    // 测试代码
}
```

## 测试辅助函数

### withUserContext

为请求添加用户上下文：

```go
req := httptest.NewRequest("GET", "/endpoint", nil)
req = withUserContext(req, "test-user-1")
```

### skipIfShort

跳过集成测试：

```go
func TestIntegration(t *testing.T) {
    skipIfShort(t)
    // 测试代码
}
```

## 测试模式

### 表驱动测试

```go
tests := []struct {
    name           string
    userID         string
    wantStatusCode int
}{
    {
        name:           "missing user context",
        userID:         "",
        wantStatusCode: http.StatusUnauthorized,
    },
    {
        name:           "valid request",
        userID:         "test-user-1",
        wantStatusCode: http.StatusOK,
    },
}

for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        // 测试代码
    })
}
```

### HTTP 处理器测试

```go
// 创建请求
req := httptest.NewRequest("POST", "/endpoint", bytes.NewReader(body))
req.Header.Set("Content-Type", "application/json")
req = withUserContext(req, "test-user-1")

// 创建响应记录器
w := httptest.NewRecorder()

// 调用处理器
handler.HandleEndpoint(w, req)

// 验证响应
assert.Equal(t, http.StatusOK, w.Code)

// 解析 JSON 响应
var response map[string]interface{}
err := json.Unmarshal(w.Body.Bytes(), &response)
require.NoError(t, err)
assert.Contains(t, response, "expectedField")
```

## 当前测试覆盖

### OAuth 处理器 (oauth_test.go)

- ✅ 缺少用户上下文
- ✅ 有效用户上下文（无环境配置）
- ⏭️ OAuth 回调处理（集成测试）

### 批量操作处理器 (bulk_test.go)

- ✅ 错误的 HTTP 方法
- ✅ 空操作数组（验证模式）
- ✅ 验证模式返回摘要

### 诊断处理器 (diagnose_test.go)

- ✅ 缺少用户上下文
- ✅ 错误的 HTTP 方法
- ✅ 无效的 JSON 负载
- ✅ 有效请求与指标
- ✅ 基于指标生成诊断规则
- ✅ 空请求体

## 扩展测试

### 添加新的测试用例

1. 在相应的 `*_test.go` 文件中添加新的测试函数
2. 使用表驱动测试模式
3. 使用 `t.Run()` 创建子测试
4. 遵循 Arrange-Act-Assert 模式

### 添加新的处理器测试

1. 创建新的 `handler_name_test.go` 文件
2. 导入必要的包
3. 创建测试函数
4. 使用 `test_helpers.go` 中的辅助函数

示例：

```go
package api

import (
    "net/http"
    "net/http/httptest"
    "testing"
    
    "github.com/stretchr/testify/assert"
)

func TestNewHandler_HandleEndpoint(t *testing.T) {
    tests := []struct {
        name           string
        userID         string
        wantStatusCode int
    }{
        {
            name:           "valid request",
            userID:         "test-user-1",
            wantStatusCode: http.StatusOK,
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            handler := NewHandler(nil)
            req := httptest.NewRequest("GET", "/endpoint", nil)
            req = withUserContext(req, tt.userID)
            w := httptest.NewRecorder()
            
            handler.HandleEndpoint(w, req)
            
            assert.Equal(t, tt.wantStatusCode, w.Code)
        })
    }
}
```

## 最佳实践

1. **使用描述性的测试名称**：清楚地说明测试的内容
2. **一个测试一个断言**：每个测试应该验证一个特定的行为
3. **使用表驱动测试**：便于添加新的测试用例
4. **清理测试数据**：确保测试之间不会相互影响
5. **使用 testify/assert**：提供更好的错误消息
6. **跳过集成测试**：使用 `-short` 标志快速运行单元测试

## 持续集成

在 CI 环境中运行测试：

```bash
# 运行所有测试
go test ./services/adscenter/internal/api/... -v -race

# 只运行单元测试
go test ./services/adscenter/internal/api/... -v -short -race

# 生成覆盖率报告
go test ./services/adscenter/internal/api/... -coverprofile=coverage.out -covermode=atomic
```

## 故障排查

### 测试失败

1. 检查错误消息
2. 使用 `-v` 标志查看详细输出
3. 检查测试数据是否正确
4. 验证环境变量是否设置

### 测试超时

```bash
# 增加超时时间
go test ./services/adscenter/internal/api/... -timeout 30s
```

### 并发问题

```bash
# 禁用并发测试
go test ./services/adscenter/internal/api/... -p 1
```

---

**文档版本**: 1.0  
**创建日期**: 2025-10-08  
**维护者**: 开发团队
