# Adscenter Server Package

本包提供了 adscenter 服务的核心 HTTP 服务器实现，采用依赖注入模式，便于测试和维护。

## 架构设计

### Server 结构体

`Server` 结构体封装了所有服务依赖：

```go
type Server struct {
    db      *sql.DB           // 数据库连接
    cache   *pcache.Cache     // Redis/Valkey 缓存
    config  *adsconfig.Config // 服务配置
    router  *chi.Mux          // HTTP 路由器
    server  *http.Server      // HTTP 服务器
    metrics *Metrics          // Prometheus 指标
}
```

### 主要功能

1. **依赖注入**: 通过构造函数注入所有依赖，避免全局变量
2. **路由管理**: 统一管理所有 HTTP 路由和中间件
3. **健康检查**: 提供 `/health`, `/healthz`, `/readyz` 端点
4. **优雅关闭**: 支持优雅关闭，确保请求完成
5. **指标收集**: 集成 Prometheus 指标

## 使用方法

### 创建服务器

```go
// 加载配置
cfg, err := adsconfig.Load(ctx)
if err != nil {
    log.Fatal(err)
}

// 创建数据库连接
db, err := storage.NewDB(cfg.DatabaseURL)
if err != nil {
    log.Fatal(err)
}

// 创建服务器
srv, err := server.NewServer(ctx, cfg, db)
if err != nil {
    log.Fatal(err)
}

// 启动服务器
if err := srv.Run(ctx); err != nil {
    log.Fatal(err)
}
```

### 优雅关闭

```go
// 监听系统信号
sigChan := make(chan os.Signal, 1)
signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

// 启动服务器
go func() {
    if err := srv.Run(ctx); err != nil {
        log.Fatal(err)
    }
}()

// 等待关闭信号
<-sigChan
log.Println("Received shutdown signal")

// 优雅关闭
if err := srv.Shutdown(context.Background()); err != nil {
    log.Printf("Shutdown error: %v", err)
}
```

## 健康检查端点

### /health 和 /healthz

基本健康检查，总是返回 200 OK。

```bash
curl http://localhost:8080/health
```

### /readyz

就绪检查，验证所有依赖是否可用：
- 数据库连接
- Redis/Valkey 连接（如果配置）

```bash
curl http://localhost:8080/readyz
```

返回示例：
- 成功: `200 OK`
- 失败: `500 Internal Server Error` + 错误详情

## 指标

服务器自动注册以下 Prometheus 指标：

- `ac_derived_targets_total`: 派生目标计数
- `ac_operation_enqueued_total`: 入队操作计数
- `ac_operation_actions`: 每个操作的动作数量分布
- `ac_execute_action_latency_seconds`: 动作执行延迟
- `ac_execute_action_total`: 执行的动作总数
- `ac_execute_action_errors_total`: 执行错误总数

访问指标端点：

```bash
curl http://localhost:8080/metrics
```

## 中间件

服务器自动应用以下中间件（按顺序）：

1. **RequestID**: 为每个请求生成唯一 ID
2. **Telemetry**: 收集请求指标和追踪
3. **Logging**: 记录请求日志
4. **SecurityHeaders**: 添加安全响应头

## 路由注册

路由通过以下方式注册：

1. **内部 API**: 通过 `internal/api` 包注册
2. **OpenAPI**: 通过生成的 OpenAPI 处理器注册

## 配置

### 环境变量

- `PORT`: HTTP 服务器端口（默认: 8080）
- `ADSCENTER_SKIP_MIGRATIONS`: 跳过数据库迁移（值为 "1" 时跳过）
- Redis/Valkey 配置通过 `pkg/cache` 包的环境变量配置

## 测试

### 单元测试

```bash
go test ./internal/server/...
```

### 集成测试

```bash
# 需要测试数据库
export TEST_DATABASE_URL="postgresql://..."
go test -tags=integration ./internal/server/...
```

## 迁移指南

从旧的 `main.go` 迁移到新的 `server` 包：

### 之前

```go
// main.go 中的全局变量和初始化
var (
    db *sql.DB
    cache *pcache.Cache
)

func main() {
    // 大量初始化代码
    db, _ = storage.NewDB(...)
    cache = pcache.NewFromEnv()
    
    r := chi.NewRouter()
    // 注册路由...
    
    http.ListenAndServe(":8080", r)
}
```

### 之后

```go
// main.go 简化为
func main() {
    ctx := context.Background()
    cfg, _ := adsconfig.Load(ctx)
    db, _ := storage.NewDB(cfg.DatabaseURL)
    
    srv, _ := server.NewServer(ctx, cfg, db)
    srv.Run(ctx)
}
```

## 优势

1. **可测试性**: 依赖注入使得单元测试更容易
2. **可维护性**: 清晰的结构和职责分离
3. **可扩展性**: 易于添加新的依赖和功能
4. **生产就绪**: 内置健康检查、指标和优雅关闭

## 下一步

- [ ] 将 HTTP 处理器从 `main.go` 迁移到 `internal/api`
- [ ] 简化 `main.go` 为简单的启动器
- [ ] 添加服务器单元测试
- [ ] 添加集成测试
