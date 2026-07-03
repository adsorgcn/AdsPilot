package database

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AdapterMode 适配器模式
type AdapterMode int

const (
	// CloudSQLMode Cloud SQL连接模式（业务数据）
	CloudSQLMode AdapterMode = iota
	// SupabaseMode Supabase连接模式（认证数据）
	SupabaseMode
)

// String returns the string representation of AdapterMode
func (m AdapterMode) String() string {
	switch m {
	case CloudSQLMode:
		return "CloudSQLMode"
	case SupabaseMode:
		return "SupabaseMode"
	default:
		return fmt.Sprintf("Unknown(%d)", m)
	}
}

// DatabaseAdapter 统一数据库适配器接口
type DatabaseAdapter interface {
	// 基础查询操作
	Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)

	// 事务操作
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)

	// 连接管理
	Ping(ctx context.Context) error
	Close() error

	// 模式和配置
	GetMode() AdapterMode
	GetServiceName() string

	// 健康检查
	IsHealthy(ctx context.Context) bool

	// 连接池管理
	GetCloudSQLPool() *pgxpool.Pool
	GetSupabaseDB() *sql.DB
}

// Config 适配器配置
type Config struct {
	ServiceName    string
	DatabaseURL    string
	ReadReplicaURL string
	Mode           AdapterMode
	SupabaseURL    string
	SupabaseKey    string
	Timeout        time.Duration
	MaxConnections int
}

// UniversalAdapter 统一数据库适配器实现
type UniversalAdapter struct {
	config       Config
	cloudSQLPool *pgxpool.Pool
	supabaseDB   *sql.DB
	mode         AdapterMode
}

// NewUniversalAdapter 创建统一数据库适配器
func NewUniversalAdapter(config Config) (*UniversalAdapter, error) {
	adapter := &UniversalAdapter{
		config: config,
		mode:   config.Mode,
	}

	// 根据模式初始化
	switch config.Mode {
	case CloudSQLMode:
		if err := adapter.initCloudSQLConnection(); err != nil {
			return nil, fmt.Errorf("failed to initialize Cloud SQL connection: %w", err)
		}
	case SupabaseMode:
		if err := adapter.initSupabaseConnection(); err != nil {
			return nil, fmt.Errorf("failed to initialize Supabase connection: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported adapter mode: %v", config.Mode)
	}

	return adapter, nil
}

// initCloudSQLConnection 初始化Cloud SQL连接
func (a *UniversalAdapter) initCloudSQLConnection() error {
	if a.config.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL not configured for Cloud SQL")
	}

	// 解析连接字符串并配置pgxpool
	config, err := pgxpool.ParseConfig(a.config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse Cloud SQL database config: %w", err)
	}

	// 配置连接池参数
	if a.config.MaxConnections > 0 {
		config.MaxConns = int32(a.config.MaxConnections)
		config.MinConns = int32(a.config.MaxConnections / 4)
	}
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	// 创建连接池
	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("failed to create Cloud SQL connection pool: %w", err)
	}

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("failed to ping Cloud SQL database: %w", err)
	}

	a.cloudSQLPool = pool
	return nil
}

// initSupabaseConnection 初始化Supabase连接
func (a *UniversalAdapter) initSupabaseConnection() error {
	// 构建Supabase数据库URL
	supabaseURL := a.buildSupabaseDatabaseURL()
	if supabaseURL == "" {
		return fmt.Errorf("Supabase URL or credentials not configured")
	}

	// 创建数据库连接
	db, err := sql.Open("postgres", supabaseURL)
	if err != nil {
		return fmt.Errorf("failed to open Supabase database: %w", err)
	}

	// 配置连接池
	if a.config.MaxConnections > 0 {
		db.SetMaxOpenConns(a.config.MaxConnections)
		db.SetMaxIdleConns(a.config.MaxConnections / 2)
	}
	db.SetConnMaxLifetime(time.Hour)
	db.SetConnMaxIdleTime(30 * time.Minute)

	// 测试连接
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return fmt.Errorf("failed to ping Supabase database: %w", err)
	}

	a.supabaseDB = db
	return nil
}

// buildSupabaseDatabaseURL 构建Supabase数据库连接URL
func (a *UniversalAdapter) buildSupabaseDatabaseURL() string {
	// 优先使用直接提供的Supabase URL
	if a.config.SupabaseURL != "" && a.config.SupabaseKey != "" {
		// 从Supabase URL中提取项目引用
		projectRef := a.extractProjectRefFromURL(a.config.SupabaseURL)
		if projectRef == "" {
			return ""
		}

		// 构建数据库连接URL
		return fmt.Sprintf("postgres://postgres.%s:%s@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
			projectRef, a.config.SupabaseKey)
	}

	// 从环境变量构建
	supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		return ""
	}

	projectRef := a.extractProjectRefFromURL(supabaseURL)
	if projectRef == "" {
		return ""
	}

	return fmt.Sprintf("postgres://postgres.%s:%s@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require",
		projectRef, supabaseKey)
}

// extractProjectRefFromURL 从Supabase URL中提取项目引用
func (a *UniversalAdapter) extractProjectRefFromURL(supabaseURL string) string {
	if supabaseURL == "" {
		return ""
	}

	// 解析URL
	u, err := url.Parse(supabaseURL)
	if err != nil {
		return ""
	}

	// 从hostname中提取项目引用
	hostname := u.Hostname()
	// Supabase项目URL格式: [project-ref].supabase.co
	parts := strings.Split(hostname, ".")
	if len(parts) >= 2 && parts[1] == "supabase" && parts[2] == "co" {
		return parts[0]
	}

	// 如果是其他格式，尝试从路径中提取
	if strings.HasPrefix(hostname, "api.supabase") {
		// API URL格式: api.supabase.com/v1/projects/[project-ref]
		pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
		for i, part := range pathParts {
			if part == "projects" && i+1 < len(pathParts) {
				return pathParts[i+1]
			}
		}
	}

	return ""
}

// GetAdapterForService 为服务创建适配器
func GetAdapterForService(serviceName string) (DatabaseAdapter, error) {
	// 🔧 修复：默认使用FinalAdapter，解决CloudSQL模式问题
	useFinalAdapter := os.Getenv("USE_FINAL_DATABASE_ADAPTER")

	// 默认使用FinalAdapter，除非明确禁用
	if useFinalAdapter != "false" {
		return GetFinalAdapterForService(serviceName)
	}

	// 向后兼容：检查是否使用PGX兼容适配器
	usePGXCompatible := os.Getenv("USE_PGX_COMPATIBLE_ADAPTER")

	if usePGXCompatible == "true" || usePGXCompatible == "1" {
		return GetPGXCompatibleAdapterForService(serviceName)
	}

	// ⚠️ 警告：传统模式已被废弃，建议使用FinalAdapter
	fmt.Printf("Warning: Using deprecated UniversalAdapter for service '%s'. Please consider using FinalAdapter instead.\n", serviceName)

	// 检查环境变量设置的模式
	modeStr := os.Getenv("DB_CONNECTION_MODE")
	var mode AdapterMode
	switch modeStr {
	case "cloudsql":
		mode = CloudSQLMode
	case "supabase":
		mode = SupabaseMode
	case "direct", "hybrid", "dbadmin", "":
		// 向后兼容：旧模式映射到新模式
		mode = CloudSQLMode // 默认使用Cloud SQL
	default:
		fmt.Printf("Warning: Invalid DB_CONNECTION_MODE '%s', defaulting to CloudSQL mode for service '%s'\n", modeStr, serviceName)
		mode = CloudSQLMode
	}

	config := Config{
		ServiceName:    serviceName,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Mode:           mode,
		Timeout:        30 * time.Second,
		MaxConnections: 20,
	}

	// 检查Supabase配置
	if supabaseURL := os.Getenv("NEXT_PUBLIC_SUPABASE_URL"); supabaseURL != "" {
		config.SupabaseURL = supabaseURL
	}
	if supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY"); supabaseKey != "" {
		config.SupabaseKey = supabaseKey
	}

	// 检查是否有只读副本URL
	if readURL := os.Getenv("DATABASE_READ_URL"); readURL != "" {
		config.ReadReplicaURL = readURL
	}

	// 🔧 修复：如果使用CloudSQL模式，直接创建FinalAdapter
	if mode == CloudSQLMode {
		return GetFinalAdapterForService(serviceName)
	}

	return NewUniversalAdapter(config)
}

// === 最终适配器导出 ===

// GetFinalAdapterForService 创建最终适配器（推荐使用）
func GetFinalAdapterForService(serviceName string) (DatabaseAdapter, error) {
	config := Config{
		ServiceName:    serviceName,
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		Mode:           CloudSQLMode, // 固定使用Cloud SQL模式
		Timeout:        30 * time.Second,
		MaxConnections: 20,
	}

	// 最终适配器不使用Supabase配置，完全基于Cloud SQL
	// 符合DATABASE_ARCHITECTURE_CURRENT.md的最终架构状态

	return NewFinalAdapter(config)
}

// 实现DatabaseAdapter接口的方法

// Query 执行查询
func (a *UniversalAdapter) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	switch a.mode {
	case CloudSQLMode:
		if a.cloudSQLPool == nil {
			return nil, fmt.Errorf("Cloud SQL pool not initialized")
		}
		// 注意：pgxpool.Query() 返回 pgx.Rows，不是 *sql.Rows
		// 为了保持接口兼容性，建议使用 GetCloudSQLPool() 直接操作
		return nil, fmt.Errorf("use GetCloudSQLPool() for CloudSQL queries - pgx and sql types are incompatible")
	case SupabaseMode:
		if a.supabaseDB == nil {
			return nil, fmt.Errorf("Supabase database not initialized")
		}
		return a.supabaseDB.QueryContext(ctx, query, args...)
	default:
		return nil, fmt.Errorf("unsupported mode: %v", a.mode)
	}
}

// QueryRow 执行查询并返回单行
func (a *UniversalAdapter) QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row {
	switch a.mode {
	case CloudSQLMode:
		if a.cloudSQLPool == nil {
			return &sql.Row{}
		}
		// pgx 和 sql 类型不兼容，使用 pgxpool 需要直接调用
		panic("use GetCloudSQLPool() for CloudSQL queries - pgx and sql types are incompatible")
	case SupabaseMode:
		if a.supabaseDB == nil {
			return &sql.Row{}
		}
		return a.supabaseDB.QueryRowContext(ctx, query, args...)
	default:
		return &sql.Row{}
	}
}

// Exec 执行语句
func (a *UniversalAdapter) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	switch a.mode {
	case CloudSQLMode:
		if a.cloudSQLPool == nil {
			return nil, fmt.Errorf("Cloud SQL pool not initialized")
		}
		// pgx 和 sql 类型不兼容，使用 pgxpool 需要直接调用
		return nil, fmt.Errorf("use GetCloudSQLPool() for CloudSQL queries - pgx and sql types are incompatible")
	case SupabaseMode:
		if a.supabaseDB == nil {
			return nil, fmt.Errorf("Supabase database not initialized")
		}
		return a.supabaseDB.ExecContext(ctx, query, args...)
	default:
		return nil, fmt.Errorf("unsupported mode: %v", a.mode)
	}
}

// BeginTx 开始事务
func (a *UniversalAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	switch a.mode {
	case CloudSQLMode:
		if a.cloudSQLPool == nil {
			return nil, fmt.Errorf("Cloud SQL pool not initialized")
		}
		// pgx 和 sql 类型不兼容，使用 pgxpool 需要直接调用
		return nil, fmt.Errorf("use GetCloudSQLPool() for CloudSQL transactions - pgx and sql types are incompatible")
	case SupabaseMode:
		if a.supabaseDB == nil {
			return nil, fmt.Errorf("Supabase database not initialized")
		}
		return a.supabaseDB.BeginTx(ctx, opts)
	default:
		return nil, fmt.Errorf("unsupported mode: %v", a.mode)
	}
}

// Ping 检查连接
func (a *UniversalAdapter) Ping(ctx context.Context) error {
	switch a.mode {
	case CloudSQLMode:
		if a.cloudSQLPool == nil {
			return fmt.Errorf("Cloud SQL pool not initialized")
		}
		return a.cloudSQLPool.Ping(ctx)
	case SupabaseMode:
		if a.supabaseDB == nil {
			return fmt.Errorf("Supabase database not initialized")
		}
		return a.supabaseDB.PingContext(ctx)
	default:
		return fmt.Errorf("unsupported mode: %v", a.mode)
	}
}

// Close 关闭连接
func (a *UniversalAdapter) Close() error {
	var errs []error

	if a.cloudSQLPool != nil {
		a.cloudSQLPool.Close()
	}

	if a.supabaseDB != nil {
		if err := a.supabaseDB.Close(); err != nil {
			errs = append(errs, fmt.Errorf("supabase db close failed: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors during close: %v", errs)
	}

	return nil
}

// GetMode 获取适配器模式
func (a *UniversalAdapter) GetMode() AdapterMode {
	return a.mode
}

// GetServiceName 获取服务名称
func (a *UniversalAdapter) GetServiceName() string {
	return a.config.ServiceName
}

// IsHealthy 检查适配器是否健康
func (a *UniversalAdapter) IsHealthy(ctx context.Context) bool {
	if err := a.Ping(ctx); err != nil {
		return false
	}
	return true
}

// GetCloudSQLPool 获取Cloud SQL连接池
func (a *UniversalAdapter) GetCloudSQLPool() *pgxpool.Pool {
	return a.cloudSQLPool
}

// GetSupabaseDB 获取Supabase数据库连接
func (a *UniversalAdapter) GetSupabaseDB() *sql.DB {
	return a.supabaseDB
}

// 辅助函数

func getAdapterMode(service string) AdapterMode {
	// 检查环境变量
	modeStr := os.Getenv(fmt.Sprintf("%s_DB_ADAPTER_MODE", service))

	switch modeStr {
	case "supabase":
		return SupabaseMode
	case "cloudsql":
		return CloudSQLMode
	default:
		// 默认使用Cloud SQL连接模式
		return CloudSQLMode
	}
}

// === PGX兼容适配器导出 ===

// PGXCompatibleAdapter PGX兼容适配器结构
type PGXCompatibleAdapter struct {
	adapter DatabaseAdapter
	service string
}

// BeginTx 实现DatabaseAdapter接口的事务方法
func (p *PGXCompatibleAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return p.adapter.BeginTx(ctx, opts)
}

// Query 实现DatabaseAdapter接口的查询方法
func (p *PGXCompatibleAdapter) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return p.adapter.Query(ctx, query, args...)
}

// QueryRow 实现DatabaseAdapter接口的单行查询方法
func (p *PGXCompatibleAdapter) QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return p.adapter.QueryRow(ctx, query, args...)
}

// Exec 实现DatabaseAdapter接口的执行方法
func (p *PGXCompatibleAdapter) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return p.adapter.Exec(ctx, query, args...)
}

// Ping 实现DatabaseAdapter接口的ping方法
func (p *PGXCompatibleAdapter) Ping(ctx context.Context) error {
	return p.adapter.Ping(ctx)
}

// Close 实现DatabaseAdapter接口的关闭方法
func (p *PGXCompatibleAdapter) Close() error {
	return p.adapter.Close()
}

// GetMode 实现DatabaseAdapter接口的模式获取方法
func (p *PGXCompatibleAdapter) GetMode() AdapterMode {
	return p.adapter.GetMode()
}

// GetServiceName 实现DatabaseAdapter接口的服务名获取方法
func (p *PGXCompatibleAdapter) GetServiceName() string {
	return p.service
}

// GetCloudSQLPool 实现DatabaseAdapter接口的连接池获取方法
func (p *PGXCompatibleAdapter) GetCloudSQLPool() *pgxpool.Pool {
	// 类型断言，如果底层的adapter支持GetCloudSQLPool方法
	if poolGetter, ok := p.adapter.(interface{ GetCloudSQLPool() *pgxpool.Pool }); ok {
		return poolGetter.GetCloudSQLPool()
	}
	return nil
}

// GetSupabaseDB 实现DatabaseAdapter接口的Supabase数据库获取方法
func (p *PGXCompatibleAdapter) GetSupabaseDB() *sql.DB {
	// 类型断言，如果底层的adapter支持GetSupabaseDB方法
	if dbGetter, ok := p.adapter.(interface{ GetSupabaseDB() *sql.DB }); ok {
		return dbGetter.GetSupabaseDB()
	}
	return nil
}

// IsHealthy 实现DatabaseAdapter接口的健康检查方法
func (p *PGXCompatibleAdapter) IsHealthy(ctx context.Context) bool {
	// 委托给底层adapter
	if healthChecker, ok := p.adapter.(interface{ IsHealthy(context.Context) bool }); ok {
		return healthChecker.IsHealthy(ctx)
	}
	return true // 默认健康
}

// GetPGXCompatibleAdapterForService 创建PGX兼容适配器
func GetPGXCompatibleAdapterForService(serviceName string) (*PGXCompatibleAdapter, error) {
	// 检查环境变量
	usePGXCompatible := os.Getenv("USE_PGX_COMPATIBLE_ADAPTER")

	if usePGXCompatible == "true" || usePGXCompatible == "1" {
		return NewPGXCompatibleAdapter(serviceName)
	}

	// 默认返回原有适配器（向后兼容）
	baseAdapter, err := GetAdapterForService(serviceName)
	if err != nil {
		return nil, err
	}

	// 将基础适配器包装为PGXCompatibleAdapter
	return &PGXCompatibleAdapter{
		adapter: baseAdapter,
		service: serviceName,
	}, nil
}

// NewPGXCompatibleAdapter 创建PGX兼容适配器
func NewPGXCompatibleAdapter(serviceName string) (*PGXCompatibleAdapter, error) {
	adapter, err := GetAdapterForService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("failed to create base adapter for PGX compatible adapter: %w", err)
	}

	// 转换为PGXCompatibleAdapter
	pgxAdapter, ok := adapter.(*UniversalAdapter)
	if !ok {
		return nil, fmt.Errorf("base adapter is not a UniversalAdapter")
	}

	// 包装为PGXCompatibleAdapter
	return &PGXCompatibleAdapter{
		adapter: pgxAdapter,
		service: serviceName,
	}, nil
}
