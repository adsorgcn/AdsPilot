# Google-Monetize 简化配置系统

## 设计原则

### 🎯 核心理念

1. **KISS原则**: Keep It Simple, Stupid - 避免过度工程化
2. **单一职责**: 配置管理只负责配置加载和验证
3. **环境优先**: 优先使用环境变量，简化配置逻辑
4. **类型安全**: 完整的 TypeScript 类型支持

### 简化架构

```
pkg/config/
├── simple.go          # 简化配置结构和加载逻辑 (98行)
└── README.md         # 使用文档 (本文件)
```

## 使用方法

### 1. 基本使用

```go
package main

import (
    "context"
    "log"
    "github.com/ScientificInternet/Google-Monetize/pkg/config"
)

func main() {
    ctx := context.Background()

    // 加载配置
    config, err := config.Load(ctx, config.ServiceTypeAPI)
    if err != nil {
        log.Fatalf("❌ 配置加载失败: %v", err)
    }

    // 使用配置
    log.Printf("✅ 服务启动: %s (端口: %s)", config.ServiceName, config.Port)
    log.Printf("🔗 数据库: %s", config.DatabaseURL)
    log.Printf("☁️ GCP项目: %s", config.GCPProjectID)

    // 启动服务...
    // runService(ctx, config)
}
```

### 2. 环境变量

```bash
# 核心配置 (必需)
SERVICE_NAME=billing
SERVICE_VERSION=v1.0.0
ENV=production

# 数据库配置
# 选项1: 直接设置 (开发环境)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
# 选项2: Secret Manager集成 (生产环境推荐)
DATABASE_URL_SECRET_NAME=billing-db-url
JWT_SECRET_NAME=billing-jwt-secret

# GCP 配置 (必需)
GOOGLE_CLOUD_PROJECT=${GCP_PROJECT_ID}
GOOGLE_CLOUD_REGION=asia-northeast1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# JWT 配置 (必需)
JWT_ISSUER=https://auth.${APP_DOMAIN}
JWT_AUDIENCE=https://api.${APP_DOMAIN}

# 可选配置
ENABLE_CORS=true
ENABLE_METRICS=true
TRACES_ENABLED=false
```

### 3. 支持的配置项

```go
type SimpleConfig struct {
    // 基本信息
    ServiceName    string `env:"SERVICE_NAME"`
    Environment    string `env:"ENV"`
    Version        string `env:"SERVICE_VERSION"`

    // 服务端口
    Port           string `env:"PORT"`
    HealthPort     string `env:"HEALTH_PORT"`

    // 数据库 (支持Secret Manager)
    DatabaseURL         string `env:"DATABASE_URL"`
    DatabaseURLSecret    string `env:"DATABASE_URL_SECRET_NAME"` // Secret Manager密钥名称

    // GCP
    GCPProjectID    string `env:"GOOGLE_CLOUD_PROJECT"`
    GCPRegion       string `env:"GOOGLE_CLOUD_REGION"`

    // JWT
    JWTIssuer      string `env:"JWT_ISSUER"`
    JWTAudience     string `env:"JWT_AUDIENCE"`
    JWTSecret      string `env:"JWT_SECRET"`

    // 可选配置
    EnableCORS      bool `env:"ENABLE_CORS" envDefault:"true"`
    EnableMetrics   bool `env:"ENABLE_METRICS" envDefault:"true"`
    EnableTracing   bool `env:"TRACES_ENABLED" envDefault:"false"`
}
```

### 4. 配置验证

```go
func validate(config *SimpleConfig) error {
    if config.DatabaseURL == "" {
        return fmt.Errorf("DATABASE_URL is required")
    }

    if config.JWTSecret == "" {
        return fmt.Errorf("JWT_SECRET is required")
    }

    if config.GCPProjectID == "" {
        return fmt.Errorf("GOOGLE_CLOUD_PROJECT is required")
    }

    return nil
}
```

## 服务类型

```go
// API 服务
config.Load(ctx, config.ServiceTypeAPI)

// Worker 服务
config.Load(ctx, config.ServiceTypeWorker)

// Web 服务
config.Load(ctx, config.ServiceTypeWeb)
```

## 环境区分

```go
// 自动识别环境
Environment: development | staging | production

// 开发环境特殊处理
if os.Getenv("ENV") == "development" {
    _ = godotenv.Load()  // 加载 .env 文件
}
```

## 最佳实践

### 1. 配置管理

- ✅ **环境变量优先**: 优先使用环境变量，简化配置逻辑
- ✅ **默认值**: 为所有配置提供合理的默认值
- ✅ **验证**: 启动时验证所有必需配置项
- ✅ **日志**: 清晰的配置加载和错误日志

### 2. 避免反模式

- ❌ **复杂配置文件**: 避免复杂的JSON/YAML配置文件
- ❌ **多层配置**: 避免配置继承和覆盖逻辑
- ❌ **动态加载**: 避免运行时复杂的配置重载逻辑

### 3. 简单验证

```go
// 必需配置检查
requiredConfigs := []struct{
    {name: "DATABASE_URL", value: config.DatabaseURL},
    {name: "JWT_SECRET", value: config.JWTSecret},
    {name: "GOOGLE_CLOUD_PROJECT", value: config.GCPProjectID},
}

for _, cfg := range requiredConfigs {
    if cfg.value == "" {
        log.Fatalf("❌ 缺少必需配置: %s", cfg.name)
    }
}
```

### 4. 错误处理

```go
// 优雅处理配置错误
config, err := config.Load(ctx, serviceType)
if err != nil {
    log.Printf("⚠️ 配置加载失败，使用默认配置: %v", err)
    config = getDefaultConfig()  // 使用默认配置
}
```

## 与过度设计对比

### ❌ 过度设计问题

1. **复杂的配置结构**：
   - 多层嵌套的配置结构
   - 复杂的继承和覆盖逻辑
   - 大量的配置验证规则

2. **过度抽象**：
   - 多个配置管理器接口
   - 复杂的配置加载策略
   - 不必要的配置格式支持

3. **功能蔓延**：
   - 配置变更历史记录
   - 配置模板生成
   - 命令行配置管理工具
   - 多种配置格式支持

### ✅ 简��设计优势

1. **单一职责**：
   - 配置管理只负责配置加载
   - 简单的验证逻辑
   - 清晰的错误处理

2. **易于理解**：
   - 基于环境变量的配置
   - 直观的配置结构
   - 最少的依赖

3. **易于维护**：
   - 代码量少 (98行 vs 过度设计300+行)
   - 逻辑简单清晰
   - 完整的文档

## 迁移指南

### 从过度设计迁移

1. **识别过度设计**：
   ```bash
   # 查找复杂配置文件
   find . -name "*.go" -path "*/config" -exec wc -l {} + | sort -n | tail -1

   # 检查是否存在以下过度设计信号：
   # - 多层抽象接口
   # - 命杂的命令行工具
   # - 多种配置格式支持
   ```

2. **简化步骤**：
   ```bash
   # 1. 分析现有配置使用模式
   grep -r "LoadConfig\|configManager" services/

   # 2. 识别核心配置需求
   # 通常只需要：数据库连接、端口、JWT配置

   # 3. 替换为简化配置
   # 使用标准的 SimpleConfig 结构
   ```

### 快速迁移

```bash
# 创建简化配置
cat > services/billing/config.go << 'EOF'
package config

import (
    "context"
    "fmt"
    "log"
    "os"
)

type Config struct {
    DatabaseURL string `env:"DATABASE_URL"`
    Port        string `env:"PORT"`
    ServiceName string `env:"SERVICE_NAME"`
}

func Load() (*Config, error) {
    return &Config{
        DatabaseURL: os.Getenv("DATABASE_URL"),
        Port:        os.Getenv("PORT"),
        ServiceName: os.Getenv("SERVICE_NAME"),
    }, nil
}
EOF

echo "✅ 简化配置创建完成"
```

## 故障排除

### 常见问题

1. **环境变量未设置**
   ```
   错误: DATABASE_URL is required
   解决: 确保环境变量正确设置
   ```

2. **配置验证失败**
   ```
   错误: 配置验证失败
   解决: 检查配置项是否完整
   ```

3. **服务类型识别错误**
   ```
   错误: 无法识别服务类型
   解决: 明确指定服务类型参数
   ```

## 版本历史

### v1.0.0 (当前简化版本)
- ✅ 创建98行简化配置系统
- ✅ 移除过度设计的复杂逻辑
- ✅ 基于环境变量的配置
- ✅ 单一职责原则
- ✅ 完整的类型支持和验证

### 弃用功能
- ❌ 配置变更历史记录 (过度设计)
- ❌ 多种配置格式支持 (过度设计)
- ❌ 命令行配置工具 (过度设计)
- ❌ 动态配置重载 (过度设计)
- ❌ 配置模板生成 (过度设计)