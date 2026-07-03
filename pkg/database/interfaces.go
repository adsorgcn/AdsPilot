package database

import (
	"context"
	"database/sql"
)

// RowScanner defines the interface for scanning database rows
type RowScanner interface {
	Scan(dest ...interface{}) error
}

// RowsScanner defines the interface for database result sets
type RowsScanner interface {
	RowScanner
	Next() bool
	Close() error
	Columns() ([]string, error)
	Err() error
}

// DatabaseResult defines interface for database execution results
type DatabaseResult interface {
	LastInsertId() (int64, error)
	RowsAffected() (int64, error)
}

// CompatibleDatabaseAdapter maintains the original interface for backward compatibility
type CompatibleDatabaseAdapter interface {
	Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(ctx context.Context, query string, args ...interface{}) *sql.Row
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error)
	Ping(ctx context.Context) error
	Close() error
	GetMode() AdapterMode
	GetServiceName() string
	IsHealthy(ctx context.Context) bool
	GetStats() map[string]interface{}
	ResetConnections() error
}
