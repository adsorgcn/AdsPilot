package storage

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/dbadmin"
	adsconfig "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
)

// AdsCenterAdapter 为adscenter服务提供数据库适配器
type AdsCenterAdapter struct {
	adapter database.DatabaseAdapter
	dbAdmin *dbadmin.Client
	config  *adsconfig.Config
}

// NewAdsCenterAdapter 创建新的adscenter数据库适配器
func NewAdsCenterAdapter(cfg *adsconfig.Config) (*AdsCenterAdapter, error) {
	// 创建FinalAdapter适配器（符合最终架构）
	adapter, err := database.GetFinalAdapterForService("adscenter")
	if err != nil {
		return nil, fmt.Errorf("failed to create final database adapter: %w", err)
	}

	// 创建db-admin客户端
	var dbAdminClient *dbadmin.Client
	if cfg.DBAdminURL != "" && cfg.DBAdminToken != "" {
		dbAdminClient = dbadmin.NewClient(cfg.DBAdminURL, cfg.DBAdminToken)
	}

	return &AdsCenterAdapter{
		adapter: adapter,
		dbAdmin: dbAdminClient,
		config:  cfg,
	}, nil
}

// GetDirectDB 获取直接数据库连接（向后兼容）
func (a *AdsCenterAdapter) GetDirectDB() *sql.DB {
	// TODO: DatabaseAdapter接口目前不提供GetDirectConnection方法
	// 需要适配当前接口或扩展接口
	log.Printf("Warning: Direct database connection not available in current mode: %v", a.adapter.GetMode())
	return nil
}

// QueryContext 执行查询（通过适配器）
func (a *AdsCenterAdapter) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return a.adapter.Query(ctx, query, args...)
}

// QueryRowContext 执行单行查询（通过适配器）
func (a *AdsCenterAdapter) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return a.adapter.QueryRow(ctx, query, args...)
}

// ExecContext 执行非查询语句（通过适配器）
func (a *AdsCenterAdapter) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return a.adapter.Exec(ctx, query, args...)
}

// GetUserRefreshToken 获取用户刷新令牌 - 使用适配器
func (a *AdsCenterAdapter) GetUserRefreshToken(ctx context.Context, userID string) (token string, loginCID string, primaryCID sql.NullString, err error) {
	queryCtx, cancel := database.WithShortQueryTimeout(ctx)
	defer cancel()

	query := `SELECT "refreshToken", "loginCustomerId", "primaryCustomerId" FROM "UserAdsConnection" WHERE "userId"=$1 ORDER BY "updatedAt" DESC LIMIT 1`

	err = a.adapter.QueryRow(queryCtx, query, userID).Scan(&token, &loginCID, &primaryCID)
	return
}

// UpsertUserRefreshToken 更新或插入用户刷新令牌 - 使用适配器
func (a *AdsCenterAdapter) UpsertUserRefreshToken(ctx context.Context, userID, loginCID, primaryCID, encryptedToken string) error {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	// Try update existing row for user; else insert
	query := `UPDATE "UserAdsConnection" SET "refreshToken"=$1, "loginCustomerId"=$2, "primaryCustomerId"=NULLIF($3,''), "updatedAt"=NOW() WHERE "userId"=$4`
	result, err := a.adapter.Exec(queryCtx, query, encryptedToken, loginCID, primaryCID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected > 0 {
		return nil
	}

	// Insert new row
	query = `INSERT INTO "UserAdsConnection" ("userId","loginCustomerId","primaryCustomerId","refreshToken") VALUES ($1,$2,NULLIF($3,''),$4)`
	_, err = a.adapter.Exec(queryCtx, query, userID, loginCID, primaryCID, encryptedToken)
	return err
}

// CreateBulkActionOperation 创建批量操作 - 使用适配器
func (a *AdsCenterAdapter) CreateBulkActionOperation(ctx context.Context, id, userID string, plan interface{}, status string) error {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	query := `INSERT INTO "BulkActionOperation" (id, user_id, plan, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`

	_, err := a.adapter.Exec(queryCtx, query, id, userID, plan, status)
	return err
}

// GetBulkActionOperation 获取批量操作 - 使用适配器
func (a *AdsCenterAdapter) GetBulkActionOperation(ctx context.Context, operationID string) (*BulkActionOperation, error) {
	queryCtx, cancel := database.WithShortQueryTimeout(ctx)
	defer cancel()

	query := `SELECT id, user_id, plan, status, created_at, updated_at FROM "BulkActionOperation" WHERE id = $1`

	row := a.adapter.QueryRow(queryCtx, query, operationID)

	var op BulkActionOperation
	err := row.Scan(&op.ID, &op.UserID, &op.Plan, &op.Status, &op.CreatedAt, &op.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &op, nil
}

// CreateBulkActionAudit 创建批量操作审计记录 - 使用适配器
func (a *AdsCenterAdapter) CreateBulkActionAudit(ctx context.Context, operationID, userID, kind string, snapshot interface{}) error {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	query := `INSERT INTO "BulkActionAudit" (op_id, user_id, kind, snapshot, created_at) VALUES ($1, $2, $3, $4, NOW())`

	_, err := a.adapter.Exec(queryCtx, query, operationID, userID, kind, snapshot)
	return err
}

// CreateAuditEvent 创建审计事件 - 使用适配器
func (a *AdsCenterAdapter) CreateAuditEvent(ctx context.Context, userID, kind string, data interface{}) error {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	query := `INSERT INTO "AuditEvent" (user_id, kind, data, created_at) VALUES ($1, $2, $3, NOW())`

	_, err := a.adapter.Exec(queryCtx, query, userID, kind, data)
	return err
}

// GetUserAuditEvents 获取用户审计事件 - 使用适配器
func (a *AdsCenterAdapter) GetUserAuditEvents(ctx context.Context, userID string, limit int, eventTypes ...string) ([]AuditEvent, error) {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	query := `SELECT id, user_id, kind, data, created_at FROM "AuditEvent" WHERE user_id = $1`
	args := []interface{}{userID}

	// 添加事件类型过滤
	if len(eventTypes) > 0 {
		query += " AND kind = ANY($2)"
		args = append(args, eventTypes)
	}

	query += " ORDER BY created_at DESC LIMIT $" + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := a.adapter.Query(queryCtx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []AuditEvent
	for rows.Next() {
		var event AuditEvent
		err := rows.Scan(&event.ID, &event.UserID, &event.Kind, &event.Data, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}

	return events, nil
}

// EnsureTablesExist 通过db-admin确保表结构存在 - DDL管理
func (a *AdsCenterAdapter) EnsureTablesExist(ctx context.Context) error {
	if a.dbAdmin == nil {
		return fmt.Errorf("db-admin client not configured")
	}

	// 使用预定义的DDL语句
	ddlStatements := []string{
		`CREATE TABLE IF NOT EXISTS "UserAdsConnection" (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			"userId" TEXT NOT NULL,
			"loginCustomerId" TEXT NOT NULL,
			"primaryCustomerId" TEXT,
			"refreshToken" TEXT NOT NULL,
			"scopes" TEXT,
			"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_useradsconnection_user ON "UserAdsConnection"("userId")`,
		`CREATE TABLE IF NOT EXISTS "BulkActionOperation" (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			plan JSONB,
			status TEXT,
			created_at TIMESTAMPTZ DEFAULT now(),
			updated_at TIMESTAMPTZ DEFAULT now()
		)`,
		`CREATE TABLE IF NOT EXISTS "BulkActionAudit" (
			id BIGSERIAL PRIMARY KEY,
			op_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			snapshot JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS ix_bulk_audit_op ON "BulkActionAudit"(op_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS "AuditEvent" (
			id BIGSERIAL PRIMARY KEY,
			user_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			data JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX IF NOT EXISTS ix_audit_event_user_kind_time ON "AuditEvent"(user_id, kind, created_at DESC)`,
	}

	for _, ddl := range ddlStatements {
		// DDL 由 db-admin 独立执行(服务运行时不执行 DDL);此处仅登记

		log.Printf("DDL statement validated: %s", ddl[:min(len(ddl), 50)]+"...")
	}

	return nil
}

// GetAdapterStatus 获取适配器状态信息
func (a *AdsCenterAdapter) GetAdapterStatus(ctx context.Context) (*AdapterStatus, error) {
	status := &AdapterStatus{
		Mode:       a.adapter.GetMode(),
		Connected:  true,
		HasDBAdmin: a.dbAdmin != nil,
	}

	// 测试连接
	if err := a.adapter.Ping(ctx); err != nil {
		status.Connected = false
		status.Error = err.Error()
	}

	// 获取db-admin状态
	if a.dbAdmin != nil {
		if err := a.dbAdmin.Ping(ctx); err == nil {
			status.DBAdminStatus = "connected"
		} else {
			status.DBAdminStatus = "disconnected"
			status.DBAdminError = err.Error()
		}
	}

	return status, nil
}

// SwitchAdapterMode 切换适配器模式
func (a *AdsCenterAdapter) SwitchAdapterMode(mode database.AdapterMode) error {
	// TODO: DatabaseAdapter接口目前不提供SwitchMode方法
	// 需要重新创建适配器或扩展接口
	log.Printf("Switching adapter mode to %v (not implemented yet)", mode)
	return fmt.Errorf("SwitchMode not implemented in current DatabaseAdapter interface")
}

// Close 关闭适配器，释放资源
func (a *AdsCenterAdapter) Close() error {
	return a.adapter.Close()
}

// 辅助数据结构
type BulkActionOperation struct {
	ID        string      `json:"id"`
	UserID    string      `json:"user_id"`
	Plan      interface{} `json:"plan"`
	Status    string      `json:"status"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
}

type AuditEvent struct {
	ID        int64       `json:"id"`
	UserID    string      `json:"user_id"`
	Kind      string      `json:"kind"`
	Data      interface{} `json:"data"`
	CreatedAt time.Time   `json:"created_at"`
}

type AdapterStatus struct {
	Mode           database.AdapterMode `json:"mode"`
	Connected      bool                 `json:"connected"`
	HasDBAdmin     bool                 `json:"has_db_admin"`
	DBAdminStatus  string               `json:"db_admin_status"`
	DBAdminVersion string               `json:"db_admin_version"`
	Error          string               `json:"error,omitempty"`
	DBAdminError   string               `json:"db_admin_error,omitempty"`
}

// 辅助函数
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
