package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Adapter 数据库适配器，使用新的统一数据库适配器
type Adapter struct {
	adapter database.DatabaseAdapter
	service string
}

// NewAdapter 创建数据库适配器
func NewAdapter(databaseURL string) (*Adapter, error) {
	// 🔧 修复：使用FinalAdapter替代旧的GetAdapterForService
	adapter, err := database.GetFinalAdapterForService("useractivity")
	if err != nil {
		return nil, fmt.Errorf("failed to create database adapter for useractivity service: %w", err)
	}

	return &Adapter{
		adapter: adapter,
		service: "useractivity",
	}, nil
}

// NewAdapterWithMode 使用指定模式创建数据库适配器（向后兼容）
func NewAdapterWithMode(mode database.AdapterMode, databaseURL string) (*Adapter, error) {
	config := database.Config{
		ServiceName:    "useractivity",
		DatabaseURL:    databaseURL,
		Mode:           mode,
		MaxConnections: 20,
	}

	adapter, err := database.NewUniversalAdapter(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create database adapter: %w", err)
	}

	return &Adapter{
		adapter: adapter,
		service: "useractivity",
	}, nil
}

// GetDB 获取数据库连接（向后兼容）
func (a *Adapter) GetDB() *sql.DB {
	switch a.adapter.GetMode() {
	case database.CloudSQLMode:
		// CloudSQL模式使用pgxpool，不直接转换到*sql.DB
		return nil
	case database.SupabaseMode:
		return a.adapter.GetSupabaseDB()
	}
	return nil
}

// GetCloudSQLPool 获取Cloud SQL连接池
func (a *Adapter) GetCloudSQLPool() *pgxpool.Pool {
	return a.adapter.GetCloudSQLPool()
}

// GetSupabaseDB 获取Supabase数据库连接
func (a *Adapter) GetSupabaseDB() *sql.DB {
	return a.adapter.GetSupabaseDB()
}

// Close 关闭所有数据库连接
func (a *Adapter) Close() error {
	return a.adapter.Close()
}

// Ping 测试连接
func (a *Adapter) Ping(ctx context.Context) error {
	return a.adapter.Ping(ctx)
}

// IsHealthy 检查适配器是否健康
func (a *Adapter) IsHealthy(ctx context.Context) bool {
	return a.adapter.IsHealthy(ctx)
}

// QueryContext 执行查询
func (a *Adapter) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return a.adapter.Query(ctx, query, args...)
}

// ExecContext 执行写操作
func (a *Adapter) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return a.adapter.Exec(ctx, query, args...)
}

// QueryRowContext 执行单行查询
func (a *Adapter) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return a.adapter.QueryRow(ctx, query, args...)
}

// BeginTx 开始事务
func (a *Adapter) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return a.adapter.BeginTx(ctx, opts)
}

// GetMode 获取当前模式
func (a *Adapter) GetMode() database.AdapterMode {
	return a.adapter.GetMode()
}

// GetServiceName 获取服务名称
func (a *Adapter) GetServiceName() string {
	return a.adapter.GetServiceName()
}

// EnsureDDL 已移除 - MustKnowV7规范要求通过db-admin统一管理DDL
// 所有表结构应通过 YAML 迁移文件定义并通过 db-admin 服务执行
// 如遇到表缺失错误，请检查并执行 migrations/useractivity/ 中的迁移文件
