package storage

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// Adapter 数据库适配器，支持从直接数据库连接逐步迁移到db-admin
type Adapter struct {
	db      *sql.DB
	mode    database.AdapterMode
	service string
}

// NewAdapter 创建数据库适配器
func NewAdapter(databaseURL string) (*Adapter, error) {
	// 检查环境变量设置的模式
	modeStr := os.Getenv("DB_CONNECTION_MODE")
	var mode database.AdapterMode
	switch modeStr {
	case "cloudsql", "direct", "hybrid", "dbadmin", "":
		mode = database.CloudSQLMode // Default to Cloud SQL mode for projector service
	case "supabase":
		mode = database.SupabaseMode
	default:
		fmt.Printf("Warning: Invalid DB_CONNECTION_MODE '%s', defaulting to CloudSQL mode for service '%s'\n", modeStr, "projector")
		mode = database.CloudSQLMode
	}

	adapter := &Adapter{
		mode:    mode,
		service: "projector",
	}

	// 根据模式初始化连接
	switch mode {
	case database.CloudSQLMode:
		// 初始化Cloud SQL数据库连接
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to Cloud SQL database: %w", err)
		}
		adapter.db = db

	case database.SupabaseMode:
		// 初始化Supabase数据库连接
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to Supabase database: %w", err)
		}
		adapter.db = db

	default:
		// 默认使用Cloud SQL模式
		fmt.Printf("Warning: Unknown mode %v, defaulting to CloudSQL mode for service '%s'\n", mode, adapter.service)
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to database: %w", err)
		}
		adapter.db = db
		adapter.mode = database.CloudSQLMode
	}

	return adapter, nil
}

// GetDB 获取数据库连接
func (a *Adapter) GetDB() *sql.DB {
	return a.db
}

// Close 关闭所有数据库连接
func (a *Adapter) Close() error {
	if a.db != nil {
		if err := a.db.Close(); err != nil {
			return err
		}
	}
	return nil
}

// Ping 测试连接
func (a *Adapter) Ping(ctx context.Context) error {
	if a.db != nil {
		return a.db.PingContext(ctx)
	}
	return fmt.Errorf("database connection not initialized")
}

// GetMode 获取当前模式
func (a *Adapter) GetMode() database.AdapterMode {
	return a.mode
}

// RecordEventProjection 记录事件投影
func (a *Adapter) RecordEventProjection(ctx context.Context, eventID, eventName, aggregateType, aggregateID string) error {
	if a.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	query := `INSERT INTO event_projection(event_id, event_name, aggregate_type, aggregate_id, processed_at)
	          VALUES ($1,$2,$3,$4,NOW())
	          ON CONFLICT (event_id) DO NOTHING`

	_, err := a.db.ExecContext(ctx, query, eventID, eventName, aggregateType, aggregateID)
	return err
}

// InsertOffer 插入Offer记录
func (a *Adapter) InsertOffer(ctx context.Context, offerID, userID, name, originalURL, status string) error {
	if a.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	// Try camelCase userId first
	query := `INSERT INTO "Offer"(id, "userId", name, "originalUrl", status, created_at, updated_at)
	          VALUES ($1,$2,$3,$4,COALESCE(NULLIF($5,''),'evaluating'), NOW(), NOW())
	          ON CONFLICT (id) DO NOTHING`

	_, err := a.db.ExecContext(ctx, query, offerID, userID, name, originalURL, status)
	if err != nil {
		// Fallback to legacy lowercase userid
		legacyQuery := `INSERT INTO "Offer"(id, userid, name, originalurl, status, created_at, updated_at)
		               VALUES ($1,$2,$3,$4,COALESCE(NULLIF($5,''),'evaluating'), NOW(), NOW())
		               ON CONFLICT (id) DO NOTHING`
		_, err = a.db.ExecContext(ctx, legacyQuery, offerID, userID, name, originalURL, status)
	}
	return err
}

// UpdateOfferStatus 更新Offer状态
func (a *Adapter) UpdateOfferStatus(ctx context.Context, offerID, userID string, score *float64) error {
	if a.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	var err error
	if score != nil {
		_, err = a.db.ExecContext(ctx,
			`UPDATE "Offer" SET status='evaluated', "siterankScore"=$1, updated_at=NOW() WHERE id=$2 AND "userId"=$3`,
			*score, offerID, userID)
	} else {
		_, err = a.db.ExecContext(ctx,
			`UPDATE "Offer" SET status='evaluated', updated_at=NOW() WHERE id=$1 AND "userId"=$2`,
			offerID, userID)
	}
	return err
}

// EnsureDDL 确保DDL表存在
func (a *Adapter) EnsureDDL(ctx context.Context) error {
	if a.db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	ddl := `
	CREATE TABLE IF NOT EXISTS event_projection (
	  event_id TEXT PRIMARY KEY,
	  event_name TEXT NOT NULL,
	  aggregate_type TEXT NOT NULL,
	  aggregate_id TEXT NOT NULL,
	  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
	);`

	_, err := a.db.ExecContext(ctx, ddl)
	return err
}
