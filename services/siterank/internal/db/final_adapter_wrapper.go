package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// FinalAdapterWrapper 包装FinalAdapter以提供sql.DB兼容接口
type FinalAdapterWrapper struct {
	adapter database.DatabaseAdapter
}

// NewFinalAdapterWrapper 创建FinalAdapter包装器
func NewFinalAdapterWrapper() (*FinalAdapterWrapper, error) {
	adapter, err := database.GetFinalAdapterForService("siterank")
	if err != nil {
		return nil, fmt.Errorf("failed to create final database adapter for siterank service: %w", err)
	}

	return &FinalAdapterWrapper{
		adapter: adapter,
	}, nil
}

// Close 关闭数据库连接
func (w *FinalAdapterWrapper) Close() error {
	if closer, ok := w.adapter.(interface{ Close() error }); ok {
		return closer.Close()
	}
	return nil
}

// Ping 检查数据库连接
func (w *FinalAdapterWrapper) Ping(ctx context.Context) error {
	return w.adapter.Ping(ctx)
}

// Query 执行查询并返回多行结果
func (w *FinalAdapterWrapper) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return w.adapter.Query(context.Background(), query, args...)
}

// QueryContext 执行查询并返回多行结果
func (w *FinalAdapterWrapper) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return w.adapter.Query(ctx, query, args...)
}

// QueryRow 执行查询并返回单行结果
func (w *FinalAdapterWrapper) QueryRow(query string, args ...interface{}) *sql.Row {
	return w.adapter.QueryRow(context.Background(), query, args...)
}

// QueryRowContext 执行查询并返回单行结果
func (w *FinalAdapterWrapper) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return w.adapter.QueryRow(ctx, query, args...)
}

// Exec 执行非查询操作
func (w *FinalAdapterWrapper) Exec(query string, args ...interface{}) (sql.Result, error) {
	return w.adapter.Exec(context.Background(), query, args...)
}

// ExecContext 执行非查询操作
func (w *FinalAdapterWrapper) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return w.adapter.Exec(ctx, query, args...)
}

// Prepare 准备SQL语句
func (w *FinalAdapterWrapper) Prepare(query string) (*sql.Stmt, error) {
	return w.PrepareContext(context.Background(), query)
}

// PrepareContext 准备SQL语句
func (w *FinalAdapterWrapper) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	if preparer, ok := w.adapter.(interface {
		PrepareContext(context.Context, string) (*sql.Stmt, error)
	}); ok {
		return preparer.PrepareContext(ctx, query)
	}
	// 如果不支持prepare，则使用其他方式
	return nil, fmt.Errorf("PrepareContext not supported by current adapter")
}

// Begin 开始事务
func (w *FinalAdapterWrapper) Begin() (*sql.Tx, error) {
	return w.BeginTx(context.Background(), nil)
}

// BeginTx 开始事务
func (w *FinalAdapterWrapper) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return w.adapter.BeginTx(ctx, opts)
}

// SetMaxOpenConns 设置最大打开连接数
func (w *FinalAdapterWrapper) SetMaxOpenConns(n int) {
	if setter, ok := w.adapter.(interface{ SetMaxOpenConns(int) }); ok {
		setter.SetMaxOpenConns(n)
	}
}

// SetMaxIdleConns 设置最大空闲连接数
func (w *FinalAdapterWrapper) SetMaxIdleConns(n int) {
	if setter, ok := w.adapter.(interface{ SetMaxIdleConns(int) }); ok {
		setter.SetMaxIdleConns(n)
	}
}

// SetConnMaxLifetime 设置连接最大生存时间
func (w *FinalAdapterWrapper) SetConnMaxLifetime(d time.Duration) {
	if setter, ok := w.adapter.(interface{ SetConnMaxLifetime(time.Duration) }); ok {
		setter.SetConnMaxLifetime(d)
	}
}

// SetConnMaxIdleTime 设置连接最大空闲时间
func (w *FinalAdapterWrapper) SetConnMaxIdleTime(d time.Duration) {
	if setter, ok := w.adapter.(interface{ SetConnMaxIdleTime(time.Duration) }); ok {
		setter.SetConnMaxIdleTime(d)
	}
}

// Stats 获取数据库统计信息
func (w *FinalAdapterWrapper) Stats() sql.DBStats {
	// 返回默认的统计信息
	return sql.DBStats{}
}

// GetAdapter 获取内部的DatabaseAdapter（如果需要特殊操作时使用）
func (w *FinalAdapterWrapper) GetAdapter() database.DatabaseAdapter {
	return w.adapter
}
