package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// DualDatabaseAdapter 支持主从数据库的适配器
type DualDatabaseAdapter struct {
	primary   *SingleDatabaseAdapter
	secondary *SingleDatabaseAdapter // read replica
}

// SingleDatabaseAdapter 单数据库适配器
type SingleDatabaseAdapter struct {
	db   *sql.DB
	mode database.AdapterMode
	name string // 数据库名称，用于日志
}

// NewDualDatabaseAdapter 创建主从数据库适配器
func NewDualDatabaseAdapter(primaryURL, secondaryURL string) (*DualDatabaseAdapter, error) {
	// 检查环境变量设置的模式
	modeStr := os.Getenv("DB_CONNECTION_MODE")
	var mode database.AdapterMode
	switch modeStr {
	case "cloudsql", "direct", "hybrid", "dbadmin", "":
		mode = database.CloudSQLMode // Default to Cloud SQL mode for recommendations service
	case "supabase":
		mode = database.SupabaseMode
	default:
		fmt.Printf("Warning: Invalid DB_CONNECTION_MODE '%s', defaulting to CloudSQL mode for recommendations service\n", modeStr)
		mode = database.CloudSQLMode
	}

	// 创建主数据库适配器
	primary, err := createSingleAdapter(primaryURL, mode, "Primary")
	if err != nil {
		return nil, fmt.Errorf("failed to create primary adapter: %w", err)
	}

	// 创建从数据库适配器（读副本）
	var secondary *SingleDatabaseAdapter
	if secondaryURL != "" {
		secondary, err = createSingleAdapter(secondaryURL, mode, "ReadReplica")
		if err != nil {
			primary.Close()
			return nil, fmt.Errorf("failed to create secondary adapter: %w", err)
		}
	} else {
		// 如果没有配置从数据库，使用主数据库作为从
		secondary = primary
	}

	return &DualDatabaseAdapter{
		primary:   primary,
		secondary: secondary,
	}, nil
}

// createSingleAdapter 创建单数据库适配器
func createSingleAdapter(databaseURL string, mode database.AdapterMode, name string) (*SingleDatabaseAdapter, error) {
	adapter := &SingleDatabaseAdapter{
		mode: mode,
		name: name,
	}

	// 根据模式初始化连接
	switch mode {
	case database.CloudSQLMode:
		// 初始化Cloud SQL数据库连接
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to %s database: %w", name, err)
		}
		adapter.db = db

	case database.SupabaseMode:
		// 初始化Supabase数据库连接
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to %s database: %w", name, err)
		}
		adapter.db = db

	default:
		// 默认使用Cloud SQL模式
		fmt.Printf("Warning: Unknown mode %v, defaulting to CloudSQL mode for %s database\n", mode, name)
		db, err := sql.Open("postgres", databaseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to connect to %s database: %w", name, err)
		}
		adapter.db = db
		adapter.mode = database.CloudSQLMode
	}

	return adapter, nil
}

// Primary 返回主数据库适配器
func (a *DualDatabaseAdapter) Primary() *SingleDatabaseAdapter {
	return a.primary
}

// Secondary 返回从数据库适配器
func (a *DualDatabaseAdapter) Secondary() *SingleDatabaseAdapter {
	return a.secondary
}

// Close 关闭所有数据库连接
func (a *DualDatabaseAdapter) Close() error {
	var firstErr error

	if err := a.primary.Close(); err != nil && firstErr == nil {
		firstErr = err
	}

	// 只有当从数据库不是主数据库时才关闭
	if a.secondary != a.primary {
		if err := a.secondary.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}

// GetMode 获取当前模式
func (a *DualDatabaseAdapter) GetMode() database.AdapterMode {
	return a.primary.mode
}

// Ping 测试所有数据库连接
func (a *DualDatabaseAdapter) Ping(ctx context.Context) error {
	if err := a.primary.Ping(ctx); err != nil {
		return fmt.Errorf("Primary database ping failed: %w", err)
	}

	if a.secondary != a.primary {
		if err := a.secondary.Ping(ctx); err != nil {
			return fmt.Errorf("Secondary database ping failed: %w", err)
		}
	}

	return nil
}

// SingleDatabaseAdapter methods

// Close 关闭单数据库连接
func (a *SingleDatabaseAdapter) Close() error {
	if a.db != nil {
		return a.db.Close()
	}
	return nil
}

// Ping 测试单数据库连接
func (a *SingleDatabaseAdapter) Ping(ctx context.Context) error {
	if a.db != nil {
		return a.db.PingContext(ctx)
	}
	return fmt.Errorf("database connection not initialized")
}

// GetDB 获取sql.DB连接
func (a *SingleDatabaseAdapter) GetDB() *sql.DB {
	return a.db
}

// GetMode 获取当前模式
func (a *SingleDatabaseAdapter) GetMode() database.AdapterMode {
	return a.mode
}

// Recommendations specific methods

// EnsureDDL has been removed - use db-admin migrations instead
// VerifyTablesExist checks if required tables exist but does not create them
func (a *DualDatabaseAdapter) VerifyTablesExist(ctx context.Context) error {
	if a.primary.db == nil {
		return fmt.Errorf("primary database connection not initialized")
	}

	// Check if brand_profile table exists
	var brandProfileExists bool
	err := a.primary.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'brand_profile')`).Scan(&brandProfileExists)
	if err != nil {
		return fmt.Errorf("failed to check brand_profile table: %w", err)
	}

	// Check if keyword_risk_results table exists
	var keywordRiskResultsExists bool
	err = a.primary.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'keyword_risk_results')`).Scan(&keywordRiskResultsExists)
	if err != nil {
		return fmt.Errorf("failed to check keyword_risk_results table: %w", err)
	}

	if !brandProfileExists || !keywordRiskResultsExists {
		return fmt.Errorf("required tables missing - brand_profile: %v, keyword_risk_results: %v. Please run db-admin migrations", brandProfileExists, keywordRiskResultsExists)
	}

	return nil
}

// EnsureOpportunitiesDDL has been removed - use db-admin migrations instead
// VerifyOpportunitiesTableExists checks if opportunities table exists but does not create it
func (a *DualDatabaseAdapter) VerifyOpportunitiesTableExists(ctx context.Context) error {
	if a.primary.db == nil {
		return fmt.Errorf("primary database connection not initialized")
	}

	// Check if opportunities table exists
	var opportunitiesExists bool
	err := a.primary.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'opportunities')`).Scan(&opportunitiesExists)
	if err != nil {
		return fmt.Errorf("failed to check opportunities table: %w", err)
	}

	if !opportunitiesExists {
		return fmt.Errorf("opportunities table missing. Please run db-admin migrations")
	}

	return nil
}

// CreateOpportunity 创建机会记录
func (a *DualDatabaseAdapter) CreateOpportunity(ctx context.Context, userID, seedDomain, country string, seedKeywords, topKeywords, topDomains, metadata, summary string) (int64, error) {
	if a.primary.db == nil {
		return 0, fmt.Errorf("primary database connection not initialized")
	}

	var id int64
	err := a.primary.db.QueryRowContext(ctx, `
        INSERT INTO opportunities(user_id, seed_domain, country, seed_keywords, top_keywords, top_domains, metadata, summary)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8)
        RETURNING id
    `, userID, seedDomain, country, seedKeywords, topKeywords, topDomains, metadata, summary).Scan(&id)

	return id, err
}

// ListOpportunities 列出机会记录
func (a *DualDatabaseAdapter) ListOpportunities(ctx context.Context, userID string, limit int, cursor int64) ([]map[string]interface{}, int64, error) {
	db := a.secondary.db // 使用从数据库读取
	if db == nil {
		return nil, 0, fmt.Errorf("secondary database connection not initialized")
	}

	where := "user_id=$1"
	args := []any{userID}
	idx := 2

	if cursor > 0 {
		where += " AND id < $" + fmt.Sprint(idx)
		args = append(args, cursor)
		idx++
	}

	query := "SELECT id, seed_domain, country, COALESCE(top_keywords::text,'[]'), COALESCE(top_domains::text,'[]'), created_at FROM opportunities WHERE " + where + " ORDER BY id DESC LIMIT $" + fmt.Sprint(idx)
	args = append(args, limit)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0, limit)
	var lastID int64

	for rows.Next() {
		var id int64
		var seed, country, kwj, dj string
		var created time.Time

		if err := rows.Scan(&id, &seed, &country, &kwj, &dj, &created); err != nil {
			continue
		}

		var topKw, topDom any
		_ = json.Unmarshal([]byte(kwj), &topKw)
		_ = json.Unmarshal([]byte(dj), &topDom)

		// 获取summary
		var summary sql.NullString
		_ = db.QueryRowContext(ctx, `SELECT summary FROM opportunities WHERE id=$1`, id).Scan(&summary)

		item := map[string]interface{}{
			"id":          id,
			"seedDomain":  seed,
			"country":     country,
			"topKeywords": topKw,
			"topDomains":  topDom,
			"createdAt":   created,
		}
		if summary.Valid {
			item["summary"] = summary.String
		}

		items = append(items, item)
		lastID = id
	}

	return items, lastID, nil
}
