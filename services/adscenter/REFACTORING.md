# Adscenter 重构说明

本文档说明 adscenter 服务的重构过程和变化。

## 重构目标

1. **简化 main.go**: 从 2612 行简化到 <200 行
2. **职责分离**: 将不同功能模块化到独立的包
3. **提高可测试性**: 使用依赖注入，便于单元测试
4. **改善可维护性**: 清晰的代码结构和文档

## 重构前后对比

### 代码行数

| 文件 | 重构前 | 重构后 | 减少 |
|------|--------|--------|------|
| main.go | 2612 行 | 90 行 | **-96.6%** |

### 文件结构

#### 重构前

```
services/adscenter/
├── main.go (2612 行)
│   ├── Server 结构体
│   ├── 所有 HTTP 处理器
│   ├── 辅助函数
│   ├── 全局变量
│   ├── 数据库迁移
│   └── 启动逻辑
└── internal/
    ├── config/
    ├── storage/
    └── oapi/
```

#### 重构后

```
services/adscenter/
├── main.go (90 行) ✨ 简化
│   └── 仅包含启动逻辑
├── main_old.go (备份)
└── internal/
    ├── server/          ✨ 新增
    │   ├── server.go    # Server 结构体和生命周期管理
    │   └── README.md    # 文档
    ├── api/             ✨ 重构
    │   ├── router.go    # 路由注册
    │   ├── openapi.go   # OpenAPI 实现
    │   ├── oauth.go     # OAuth 处理器
    │   ├── bulk.go      # 批量操作处理器
    │   ├── diagnose.go  # 诊断处理器
    │   ├── mcc.go       # MCC 处理器
    │   ├── keywords.go  # 关键词处理器
    │   ├── misc.go      # 杂项处理器
    │   └── README.md    # API 文档
    ├── migrations/      ✨ 新增
    │   └── migrations.go # 数据库迁移逻辑
    ├── config/
    ├── storage/
    └── oapi/
```

## 主要变化

### 1. main.go 简化

**重构前** (2612 行):
```go
func main() {
    // 大量初始化代码
    // 全局变量设置
    // 路由注册
    // 中间件配置
    // 处理器定义
    // ...
}

type Server struct {
    db *sql.DB
    // ...
}

func (s *Server) handler1(...) { ... }
func (s *Server) handler2(...) { ... }
// ... 数十个处理器方法
```

**重构后** (90 行):
```go
func main() {
    // 1. 设置 telemetry
    // 2. 加载配置
    // 3. 运行迁移
    // 4. 创建数据库连接
    // 5. 创建服务器
    // 6. 启动服务器
    // 7. 优雅关闭
}
```

### 2. Server 结构体模块化

**重构前**: Server 在 main.go 中，包含所有处理器方法

**重构后**: Server 在 `internal/server/` 包中

```go
// internal/server/server.go
type Server struct {
    db      *sql.DB
    cache   *pcache.Cache
    config  *adsconfig.Config
    router  *chi.Mux
    server  *http.Server
    metrics *Metrics
}

func NewServer(ctx context.Context, cfg *adsconfig.Config, db *sql.DB) (*Server, error)
func (s *Server) Run(ctx context.Context) error
func (s *Server) Shutdown(ctx context.Context) error
```

### 3. HTTP 处理器提取

**重构前**: 所有处理器在 main.go 中作为 Server 的方法

**重构后**: 处理器在 `internal/api/` 包中，按功能分组

```go
// internal/api/oauth.go
type OAuthHandler struct {
    DB *sql.DB
}

func NewOAuthHandler(db *sql.DB) *OAuthHandler
func (h *OAuthHandler) HandleOAuthURL(w http.ResponseWriter, r *http.Request)
func (h *OAuthHandler) HandleOAuthCallback(w http.ResponseWriter, r *http.Request)
```

### 4. 数据库迁移模块化

**重构前**: `runMigrations` 函数在 main.go 中

**重构后**: 迁移逻辑在 `internal/migrations/` 包中

```go
// internal/migrations/migrations.go
func Run(databaseURL string) error
```

### 5. 路由注册集中化

**重构前**: 路由在 main.go 中逐个注册

**重构后**: 路由通过 `RegisterRoutes` 函数集中注册

```go
// internal/api/router.go
func RegisterRoutes(r chi.Router, db *sql.DB, rc *pcache.Cache) {
    // 初始化所有处理器
    // 注册所有路由
}
```

## 优势

### 1. 可读性

- ✅ main.go 只有 90 行，一目了然
- ✅ 每个包有明确的职责
- ✅ 完整的文档说明

### 2. 可测试性

- ✅ 依赖注入，便于 mock
- ✅ 处理器独立，易于单元测试
- ✅ 清晰的接口定义

### 3. 可维护性

- ✅ 模块化设计，易于修改
- ✅ 代码复用性高
- ✅ 易于添加新功能

### 4. 可扩展性

- ✅ 新处理器只需添加到 `internal/api/`
- ✅ 新路由在 `router.go` 中注册
- ✅ 不影响其他模块

## 迁移步骤

### 步骤 1: 备份原文件

```bash
cp services/adscenter/main.go services/adscenter/main_old.go
```

### 步骤 2: 替换 main.go

```bash
mv services/adscenter/main_new.go services/adscenter/main.go
```

### 步骤 3: 验证构建

```bash
cd services/adscenter
go build
```

### 步骤 4: 运行测试

```bash
go test ./...
```

### 步骤 5: 部署验证

```bash
# 在测试环境部署
# 验证所有端点正常工作
# 检查日志和指标
```

## 兼容性

### 保持不变的部分

- ✅ 所有 API 端点路径
- ✅ 请求/响应格式
- ✅ 环境变量配置
- ✅ 数据库 schema
- ✅ 外部依赖

### 内部变化

- ⚠️ 代码结构重组
- ⚠️ 包导入路径变化
- ⚠️ 函数签名可能调整

## 测试清单

### 功能测试

- [ ] OAuth 认证流程
- [ ] 批量操作提交
- [ ] 预检查功能
- [ ] 诊断功能
- [ ] A/B 测试
- [ ] MCC 管理
- [ ] 关键词扩展
- [ ] 账户管理

### 非功能测试

- [ ] 健康检查端点 (/health, /healthz, /readyz)
- [ ] 指标端点 (/metrics)
- [ ] 优雅关闭
- [ ] 数据库连接池
- [ ] Redis 缓存
- [ ] 日志输出
- [ ] 错误处理

### 性能测试

- [ ] 响应时间
- [ ] 并发处理
- [ ] 内存使用
- [ ] CPU 使用

## 回滚计划

如果重构后出现问题，可以快速回滚：

```bash
# 1. 恢复旧的 main.go
cp services/adscenter/main_old.go services/adscenter/main.go

# 2. 重新构建
go build

# 3. 重新部署
# 使用之前的部署流程
```

## 后续工作

### 短期 (1-2 周)

- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 完善错误处理
- [ ] 添加更多日志

### 中期 (1-2 月)

- [ ] 性能优化
- [ ] 添加更多指标
- [ ] 改进缓存策略
- [ ] 优化数据库查询

### 长期 (3-6 月)

- [ ] 微服务拆分
- [ ] 事件驱动架构
- [ ] 服务网格集成
- [ ] 自动扩缩容

## 参考文档

- [Server Package README](internal/server/README.md)
- [API Package README](internal/api/README.md)
- [Architecture Review](../../docs/ArchitectureReviewV1/)

## 贡献者

- 架构设计: 开发团队
- 实施: 开发团队
- 审查: 技术负责人

## 更新日志

- 2025-10-08: 完成重构，main.go 从 2612 行简化到 90 行
- 2025-10-08: 创建 server 和 migrations 包
- 2025-10-08: 完善 API 处理器文档

---

**重构状态**: ✅ 完成  
**代码审查**: 待审查  
**测试状态**: 待测试  
**部署状态**: 待部署
