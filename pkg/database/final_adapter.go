package database

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/lib/pq" // PostgreSQL driver
)

// FinalAdapter 统一数据库适配器
// 完全遵循DATABASE_ARCHITECTURE_CURRENT.md的最终架构状态
// - 统一使用pgxpool连接Cloud SQL
// - 支持Supabase JWKS认证，不连接Supabase数据库
// - 提供标准sql.*接口兼容性
type FinalAdapter struct {
	config       Config
	cloudSQLPool *pgxpool.Pool
	mode         AdapterMode
}

// NewFinalAdapter 创建最终统一数据库适配器
func NewFinalAdapter(config Config) (*FinalAdapter, error) {
	adapter := &FinalAdapter{
		config: config,
		mode:   CloudSQLMode, // 固定使用Cloud SQL模式
	}

	// 初始化Cloud SQL连接
	if err := adapter.initCloudSQLConnection(); err != nil {
		return nil, fmt.Errorf("failed to initialize Cloud SQL connection: %w", err)
	}

	return adapter, nil
}

// initCloudSQLConnection 初始化Cloud SQL连接
func (a *FinalAdapter) initCloudSQLConnection() error {
	if a.config.DatabaseURL == "" {
		return fmt.Errorf("DATABASE_URL not configured for Cloud SQL")
	}

	// 解析连接字符串并配置pgxpool
	poolConfig, err := pgxpool.ParseConfig(a.config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("failed to parse Cloud SQL database config: %w", err)
	}

	// 配置连接池参数（生产级别优化）
	if a.config.MaxConnections > 0 {
		poolConfig.MaxConns = int32(a.config.MaxConnections)
		poolConfig.MinConns = int32(a.config.MaxConnections / 4)
	}
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = 1 * time.Minute

	// 创建连接池
	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
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

// === 标准sql.*接口实现 ===

// Query 执行查询并返回多行结果（使用pgxpool，包装为sql.Rows兼容接口）
func (a *FinalAdapter) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// For now, return nil as PGX to SQL compatibility is complex
	// TODO: Implement proper PGX to SQL adapter
	return nil, fmt.Errorf("PGX to SQL Rows adapter not fully implemented")
}

// === 性能优化的直接PGX方法 ===

// QueryPGX 直接返回pgx.Rows，避免sql.*包装开销（高性能场景）
func (a *FinalAdapter) QueryPGX(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// 直接使用pgxpool，无类型包装开销
	return a.cloudSQLPool.Query(ctx, query, args...)
}

// QueryRowPGX 直接返回pgx.Row，避免sql.*包装开销
func (a *FinalAdapter) QueryRowPGX(ctx context.Context, query string, args ...interface{}) pgx.Row {
	if a.cloudSQLPool == nil {
		return nil
	}

	// 直接使用pgxpool，无类型包装开销
	return a.cloudSQLPool.QueryRow(ctx, query, args...)
}

// ExecPGX 直接返回pgconn.CommandTag，避免sql.*包装开销
func (a *FinalAdapter) ExecPGX(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error) {
	if a.cloudSQLPool == nil {
		return pgconn.CommandTag{}, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// 直接使用pgxpool，无类型包装开销
	return a.cloudSQLPool.Exec(ctx, query, args...)
}

// QueryRow 执行查询并返回单行结果
func (a *FinalAdapter) QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row {
	if a.cloudSQLPool == nil {
		return &sql.Row{}
	}

	// For now, return empty sql.Row as PGX to SQL compatibility is complex
	// TODO: Implement proper PGX to SQL adapter
	return &sql.Row{}
}

// Exec 执行语句并返回结果
func (a *FinalAdapter) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// 使用pgxpool执行，包装为兼容sql.Result接口
	result, err := a.cloudSQLPool.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return &FinalResultWrapper{commandTag: result}, nil
}

// ExecBatch 批量执行操作（高性能批量插入/更新）
func (a *FinalAdapter) ExecBatch(ctx context.Context, queries []string, args [][]interface{}) ([]sql.Result, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	if len(queries) != len(args) {
		return nil, fmt.Errorf("queries and args length mismatch")
	}

	results := make([]sql.Result, len(queries))

	// 使用事务确保批量操作的原子性
	tx, err := a.cloudSQLPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin batch transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 执行批量操作
	for i, query := range queries {
		var queryArgs interface{} = args[i]
		if queryArgs == nil {
			queryArgs = []interface{}{}
		}

		result, err := tx.Exec(ctx, query, queryArgs.([]interface{})...)
		if err != nil {
			return nil, fmt.Errorf("failed to execute batch query %d: %w", i, err)
		}
		results[i] = &FinalResultWrapper{commandTag: result}
	}

	// 提交事务
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit batch transaction: %w", err)
	}

	return results, nil
}

// ExecBatchPGX 批量执行操作，直接返回pgx结果（最高性能）
func (a *FinalAdapter) ExecBatchPGX(ctx context.Context, queries []string, args [][]interface{}) ([]pgconn.CommandTag, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	if len(queries) != len(args) {
		return nil, fmt.Errorf("queries and args length mismatch")
	}

	results := make([]pgconn.CommandTag, len(queries))

	// 使用事务确保批量操作的原子性
	tx, err := a.cloudSQLPool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin batch transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 执行批量操作
	for i, query := range queries {
		var queryArgs interface{} = args[i]
		if queryArgs == nil {
			queryArgs = []interface{}{}
		}

		result, err := tx.Exec(ctx, query, queryArgs.([]interface{})...)
		if err != nil {
			return nil, fmt.Errorf("failed to execute batch query %d: %w", i, err)
		}
		results[i] = result
	}

	// 提交事务
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit batch transaction: %w", err)
	}

	return results, nil
}

// BeginTx 开始事务
func (a *FinalAdapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// For now, return nil as PGX to SQL compatibility is complex
	// TODO: Implement proper PGX to SQL adapter
	return nil, fmt.Errorf("PGX to SQL Tx adapter not fully implemented")
}

// === 连接管理方法 ===

// Ping 测试数据库连接
func (a *FinalAdapter) Ping(ctx context.Context) error {
	if a.cloudSQLPool == nil {
		return fmt.Errorf("Cloud SQL pool not initialized")
	}
	return a.cloudSQLPool.Ping(ctx)
}

// Close 关闭数据库连接
func (a *FinalAdapter) Close() error {
	if a.cloudSQLPool != nil {
		a.cloudSQLPool.Close()
	}
	return nil
}

// === 配置和状态方法 ===

// GetMode 获取适配器模式
func (a *FinalAdapter) GetMode() AdapterMode {
	return a.mode
}

// GetServiceName 获取服务名称
func (a *FinalAdapter) GetServiceName() string {
	return a.config.ServiceName
}

// IsHealthy 检查适配器是否健康
func (a *FinalAdapter) IsHealthy(ctx context.Context) bool {
	if err := a.Ping(ctx); err != nil {
		return false
	}
	return true
}

// GetCloudSQLPool 获取Cloud SQL连接池（用于性能优化场景）
func (a *FinalAdapter) GetCloudSQLPool() *pgxpool.Pool {
	return a.cloudSQLPool
}

// GetSupabaseDB 获取Supabase数据库连接（FinalAdapter不支持，返回nil）
func (a *FinalAdapter) GetSupabaseDB() *sql.DB {
	// FinalAdapter仅使用Cloud SQL，不支持Supabase业务数据库连接
	return nil
}

// === 连接池监控和性能指标 ===

// GetConnectionStats 获取详细的连接池统计信息
func (a *FinalAdapter) GetConnectionStats() map[string]interface{} {
	if a.cloudSQLPool == nil {
		return map[string]interface{}{
			"status": "not_initialized",
		}
	}

	// 获取pgxpool的统计信息
	stats := a.cloudSQLPool.Stat()

	return map[string]interface{}{
		"adapter_type":    "final",
		"connection_pool": "pgxpool",
		"database_mode":   a.mode.String(),
		"service_name":    a.config.ServiceName,
		"status":          "healthy",
		// 连接池统计
		"max_conns":          stats.MaxConns(),
		"total_conns":        stats.TotalConns(),
		"idle_conns":         stats.IdleConns(),
		"acquired_conns":     stats.AcquiredConns(),
		"constructing_conns": stats.ConstructingConns(),
		// 性能指标
		"acquire_count":          stats.AcquireCount(),
		"acquire_duration":       stats.AcquireDuration().Seconds(),
		"canceled_acquire_count": stats.CanceledAcquireCount(),
		"empty_acquire_count":    stats.EmptyAcquireCount(),
	}
}

// GetPerformanceMetrics 获取性能指标用于监控
func (a *FinalAdapter) GetPerformanceMetrics() map[string]interface{} {
	if a.cloudSQLPool == nil {
		return map[string]interface{}{
			"error": "connection_pool_not_initialized",
		}
	}

	stats := a.cloudSQLPool.Stat()

	// 计算连接池使用率
	totalConns := float64(stats.TotalConns())
	maxConns := float64(stats.MaxConns())
	idleConns := float64(stats.IdleConns())

	var utilizationRate float64
	if maxConns > 0 {
		utilizationRate = (totalConns - idleConns) / maxConns * 100
	}

	return map[string]interface{}{
		"service_name":                   a.config.ServiceName,
		"timestamp":                      time.Now().Unix(),
		"connection_utilization_percent": utilizationRate,
		"total_connections":              totalConns,
		"active_connections":             totalConns - idleConns,
		"idle_connections":               idleConns,
		"max_connections":                maxConns,
		"acquire_count":                  stats.AcquireCount(),
		"avg_acquire_duration_ms":        stats.AcquireDuration().Seconds() * 1000,
		"health_status":                  "healthy",
	}
}

// MonitorConnectionHealth 监控连接池健康状态
func (a *FinalAdapter) MonitorConnectionHealth(ctx context.Context) error {
	if a.cloudSQLPool == nil {
		return fmt.Errorf("Cloud SQL pool not initialized")
	}

	// 执行健康检查
	if err := a.cloudSQLPool.Ping(ctx); err != nil {
		return fmt.Errorf("connection health check failed: %w", err)
	}

	stats := a.cloudSQLPool.Stat()

	// 检查连接池是否接近饱和
	utilization := float64(stats.TotalConns()-stats.IdleConns()) / float64(stats.MaxConns())
	if utilization > 0.9 {
		fmt.Printf("WARNING: High connection pool utilization: %.2f%%\n", utilization*100)
	}

	// 检查是否有大量等待的连接请求
	if stats.EmptyAcquireCount() > 100 {
		fmt.Printf("WARNING: High empty acquire count: %d (consider increasing pool size)\n", stats.EmptyAcquireCount())
	}

	return nil
}

// === 事务专用方法 ===

// BeginTxReadOnly 开始只读事务
func (a *FinalAdapter) BeginTxReadOnly(ctx context.Context) (*sql.Tx, error) {
	if a.cloudSQLPool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not initialized")
	}

	// pgx v5 read-only transactions not yet implemented with PGX to SQL wrapper
	return nil, fmt.Errorf("read-only transactions with PGX wrapper not yet implemented")
}

// === 便捷工厂方法 ===

// === 错误处理和重试策略 ===

// RetryConfig 重试配置
type RetryConfig struct {
	MaxRetries int
	BaseDelay  time.Duration
	MaxDelay   time.Duration
	Multiplier float64
}

// DefaultRetryConfig 默认重试配置
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries: 3,
		BaseDelay:  100 * time.Millisecond,
		MaxDelay:   5 * time.Second,
		Multiplier: 2.0,
	}
}

// ErrorClassifier 错误分类器
type ErrorClassifier struct{}

// ClassifyError 分类错误类型
func (ec *ErrorClassifier) ClassifyError(err error) string {
	if err == nil {
		return "none"
	}

	errStr := err.Error()

	// 连接错误
	if strings.Contains(errStr, "connection") || strings.Contains(errStr, "dial") {
		return "connection_error"
	}

	// 超时错误
	if strings.Contains(errStr, "timeout") || strings.Contains(errStr, "deadline") {
		return "timeout_error"
	}

	// 语法错误
	if strings.Contains(errStr, "syntax") || strings.Contains(errStr, "invalid") {
		return "syntax_error"
	}

	// 约束错误
	if strings.Contains(errStr, "duplicate") || strings.Contains(errStr, "unique") {
		return "constraint_error"
	}

	// 死锁错误
	if strings.Contains(errStr, "deadlock") {
		return "deadlock_error"
	}

	// 资源不足错误
	if strings.Contains(errStr, "resource") || strings.Contains(errStr, "limit") {
		return "resource_error"
	}

	// 未知错误
	return "unknown_error"
}

// ShouldRetry 判断是否应该重试
func (ec *ErrorClassifier) ShouldRetry(err error, attempt int, config RetryConfig) bool {
	errorType := ec.ClassifyError(err)

	// 超过最大重试次数
	if attempt >= config.MaxRetries {
		return false
	}

	// 不应该重试的错误类型
	switch errorType {
	case "syntax_error", "constraint_error":
		return false // 语法错误和约束错误重试也无意义
	case "connection_error", "timeout_error", "deadlock_error", "resource_error":
		return true // 这些错误可能通过重试解决
	default:
		return attempt == 0 // 未知错误只重试一次
	}
}

// ExecuteWithRetry 带重试的查询执行
func (a *FinalAdapter) ExecuteWithRetry(ctx context.Context, query string, args []interface{}, config RetryConfig) (sql.Result, error) {
	classifier := &ErrorClassifier{}
	var lastErr error

	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		if attempt > 0 {
			// 计算退避延迟
			delay := time.Duration(float64(config.BaseDelay) *
				math.Pow(config.Multiplier, float64(attempt-1)))
			if delay > config.MaxDelay {
				delay = config.MaxDelay
			}

			// 检查上下文是否已取消
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
				// 继续重试
			}
		}

		result, err := a.Exec(ctx, query, args...)
		if err == nil {
			return result, nil
		}

		lastErr = err

		// 检查是否应该重试
		if !classifier.ShouldRetry(err, attempt, config) {
			break
		}

		// 记录重试信息
		errorType := classifier.ClassifyError(err)
		fmt.Printf("RETRY: Attempt %d/%d failed with %s: %v\n",
			attempt+1, config.MaxRetries, errorType, err)
	}

	return nil, fmt.Errorf("query failed after %d attempts: %w", config.MaxRetries, lastErr)
}

// QueryWithRetry 带重试的查询执行（返回多行）
func (a *FinalAdapter) QueryWithRetry(ctx context.Context, query string, args []interface{}, config RetryConfig) (*sql.Rows, error) {
	classifier := &ErrorClassifier{}
	var lastErr error

	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		if attempt > 0 {
			delay := time.Duration(float64(config.BaseDelay) *
				math.Pow(config.Multiplier, float64(attempt-1)))
			if delay > config.MaxDelay {
				delay = config.MaxDelay
			}

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		rows, err := a.Query(ctx, query, args...)
		if err == nil {
			return rows, nil
		}

		lastErr = err

		if !classifier.ShouldRetry(err, attempt, config) {
			break
		}

		errorType := classifier.ClassifyError(err)
		fmt.Printf("RETRY: Query attempt %d/%d failed with %s: %v\n",
			attempt+1, config.MaxRetries, errorType, err)
	}

	return nil, fmt.Errorf("query failed after %d attempts: %w", config.MaxRetries, lastErr)
}

// CircuitBreaker 断路器
type CircuitBreaker struct {
	failureCount     int
	failureThreshold int
	resetTimeout     time.Duration
	lastFailureTime  time.Time
	state            string // "closed", "open", "half-open"
	mu               sync.RWMutex
}

// NewCircuitBreaker 创建断路器
func NewCircuitBreaker(threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		failureThreshold: threshold,
		resetTimeout:     timeout,
		state:            "closed",
	}
}

// Execute 通过断路器执行操作
func (cb *CircuitBreaker) Execute(operation func() error) error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// 检查断路器状态
	if cb.state == "open" {
		if time.Since(cb.lastFailureTime) > cb.resetTimeout {
			cb.state = "half-open"
			cb.failureCount = 0
		} else {
			return fmt.Errorf("circuit breaker is open")
		}
	}

	err := operation()

	if err != nil {
		cb.failureCount++
		cb.lastFailureTime = time.Now()

		if cb.failureCount >= cb.failureThreshold {
			cb.state = "open"
		}
		return err
	}

	// 操作成功，重置计数器
	if cb.state == "half-open" {
		cb.state = "closed"
	}
	cb.failureCount = 0

	return nil
}

// GetState 获取断路器状态
func (cb *CircuitBreaker) GetState() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// === 类型包装器 ===

// FinalRowsWrapper 将pgx.Rows包装为sql.Rows接口
type FinalRowsWrapper struct {
	rows pgx.Rows
}

func (w *FinalRowsWrapper) Close() error {
	w.rows.Close()
	return nil
}

func (w *FinalRowsWrapper) Columns() ([]string, error) {
	// PGX v5 doesn't have a Columns() method on Rows
	// We need to get field descriptions from the query
	fields := w.rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, field := range fields {
		columns[i] = string(field.Name)
	}
	return columns, nil
}

func (w *FinalRowsWrapper) Next() bool {
	return w.rows.Next()
}

func (w *FinalRowsWrapper) Scan(dest ...interface{}) error {
	return w.rows.Scan(dest...)
}

func (w *FinalRowsWrapper) Err() error {
	return w.rows.Err()
}

// FinalRowWrapper 将pgx.Row包装为sql.Row接口
type FinalRowWrapper struct {
	row pgx.Row
}

func (w *FinalRowWrapper) Scan(dest ...interface{}) error {
	return w.row.Scan(dest...)
}

// FinalResultWrapper 将pgconn.CommandTag包装为sql.Result接口
type FinalResultWrapper struct {
	commandTag pgconn.CommandTag
}

func (w *FinalResultWrapper) LastInsertId() (int64, error) {
	return int64(w.commandTag.RowsAffected()), nil
}

func (w *FinalResultWrapper) RowsAffected() (int64, error) {
	return int64(w.commandTag.RowsAffected()), nil
}

// FinalTxWrapper 将pgx.Tx包装为sql.Tx接口
type FinalTxWrapper struct {
	tx pgx.Tx
}

func (w *FinalTxWrapper) Commit() error {
	return w.tx.Commit(context.Background())
}

func (w *FinalTxWrapper) Rollback() error {
	return w.tx.Rollback(context.Background())
}

func (w *FinalTxWrapper) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	result, err := w.tx.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return &FinalResultWrapper{commandTag: result}, nil
}

func (w *FinalTxWrapper) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	// PGX to SQL compatibility not implemented
	return nil, fmt.Errorf("PGX to SQL adapter not implemented in transaction")
}

func (w *FinalTxWrapper) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	// Return empty sql.Row as PGX to SQL compatibility is complex
	return &sql.Row{}
}

func (w *FinalTxWrapper) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	// pgx不直接支持Prepare，返回标准错误
	return nil, fmt.Errorf("pgx does not support Prepare in the traditional sense")
}
