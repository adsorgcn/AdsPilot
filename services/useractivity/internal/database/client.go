package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// UserActivityDatabase 用户活动数据库客户端（使用FinalAdapter）
type UserActivityDatabase struct {
	adapter database.DatabaseAdapter
}

// NewUserActivityDatabase 创建用户活动数据库客户端
func NewUserActivityDatabase() (*UserActivityDatabase, error) {
	// 使用FinalAdapter工厂方法
	adapter, err := database.GetFinalAdapterForService("useractivity")
	if err != nil {
		return nil, fmt.Errorf("failed to create final database adapter for useractivity service: %w", err)
	}

	return &UserActivityDatabase{
		adapter: adapter,
	}, nil
}

// Close 关闭数据库连接
func (udb *UserActivityDatabase) Close() error {
	return udb.adapter.Close()
}

// Ping 检查数据库连接
func (udb *UserActivityDatabase) Ping(ctx context.Context) error {
	return udb.adapter.Ping(ctx)
}

// GetUserNotifications 获取用户通知
func (udb *UserActivityDatabase) GetUserNotifications(ctx context.Context, userID string, limit int) ([]map[string]interface{}, error) {
	// 使用FinalAdapter的QueryPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		SELECT id, user_id, type, title, message, created_at, read_at
		FROM activity_domain.user_notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get user notifications: %w", err)
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var id int64
		var uid, notificationType, title, message string
		var createdAt, readAt sql.NullTime

		err := rows.Scan(&id, &uid, &notificationType, &title, &message, &createdAt, &readAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan notification: %w", err)
		}

		notification := map[string]interface{}{
			"id":         id,
			"user_id":    uid,
			"type":       notificationType,
			"title":      title,
			"message":    message,
			"created_at": createdAt,
		}

		if readAt.Valid {
			notification["read_at"] = readAt.Time
		}

		notifications = append(notifications, notification)
	}

	return notifications, nil
}

// CreateUserNotification 创建用户通知
func (udb *UserActivityDatabase) CreateUserNotification(ctx context.Context, userID, notificationType, title, message string) error {
	// 使用FinalAdapter的ExecPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		INSERT INTO activity_domain.user_notifications (user_id, type, title, message, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`

	_, err := pool.Exec(ctx, query, userID, notificationType, title, message, time.Now())
	if err != nil {
		return fmt.Errorf("failed to create user notification: %w", err)
	}

	return nil
}

// MarkNotificationAsRead 标记通知为已读
func (udb *UserActivityDatabase) MarkNotificationAsRead(ctx context.Context, notificationID int64) error {
	// 使用FinalAdapter的ExecPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		UPDATE activity_domain.user_notifications
		SET read_at = $1
		WHERE id = $2
	`

	_, err := pool.Exec(ctx, query, time.Now(), notificationID)
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	return nil
}

// GetUnreadNotificationCount 获取未读通知数量
func (udb *UserActivityDatabase) GetUnreadNotificationCount(ctx context.Context, userID string) (int, error) {
	// 使用FinalAdapter的QueryRowPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return 0, fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		SELECT COUNT(*) as count
		FROM activity_domain.user_notifications
		WHERE user_id = $1 AND read_at IS NULL
	`

	var count int
	err := pool.QueryRow(ctx, query, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread notification count: %w", err)
	}

	return count, nil
}

// CreateCheckin 创建签到记录
func (udb *UserActivityDatabase) CreateCheckin(ctx context.Context, userID string, points int) error {
	// 使用FinalAdapter的ExecPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		INSERT INTO activity_domain.user_checkins (user_id, checkin_date, streak_days, points_earned, created_at)
		VALUES ($1, CURRENT_DATE, 1, $2, $3)
		ON CONFLICT (user_id, checkin_date)
		DO UPDATE SET points_earned = EXCLUDED.points_earned, created_at = EXCLUDED.created_at
	`

	_, err := pool.Exec(ctx, query, userID, points, time.Now())
	if err != nil {
		return fmt.Errorf("failed to create checkin: %w", err)
	}

	return nil
}

// GetUserCheckins 获取用户签到记录
func (udb *UserActivityDatabase) GetUserCheckins(ctx context.Context, userID string, days int) ([]map[string]interface{}, error) {
	// 使用FinalAdapter的QueryPGX方法以获得更好的性能
	pool := udb.adapter.GetCloudSQLPool()
	if pool == nil {
		return nil, fmt.Errorf("Cloud SQL pool not available")
	}

	query := `
		SELECT id, user_id, checkin_date, streak_days, points_earned, created_at
		FROM activity_domain.user_checkins
		WHERE user_id = $1
		  AND checkin_date >= CURRENT_DATE - INTERVAL '%d days'
		ORDER BY checkin_date DESC
	`

	rows, err := pool.Query(ctx, fmt.Sprintf(query, days), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user checkins: %w", err)
	}
	defer rows.Close()

	var checkins []map[string]interface{}
	for rows.Next() {
		var id int64
		var uid string
		var checkinDate time.Time
		var streakDays, pointsEarned int
		var createdAt time.Time

		err := rows.Scan(&id, &uid, &checkinDate, &streakDays, &pointsEarned, &createdAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan checkin: %w", err)
		}

		checkin := map[string]interface{}{
			"id":            id,
			"user_id":       uid,
			"checkin_date":  checkinDate,
			"streak_days":   streakDays,
			"points_earned": pointsEarned,
			"created_at":    createdAt,
		}

		checkins = append(checkins, checkin)
	}

	return checkins, nil
}

// GetDatabaseStatus 获取数据库状态
func (udb *UserActivityDatabase) GetDatabaseStatus(ctx context.Context) (map[string]interface{}, error) {
	// 使用FinalAdapter的性能指标方法
	if finalAdapter, ok := udb.adapter.(*database.FinalAdapter); ok {
		stats := finalAdapter.GetPerformanceMetrics()

		// 添加服务特定的状态信息
		stats["service"] = "useractivity-service"
		stats["database_type"] = "cloudsql"
		stats["last_updated"] = time.Now().UTC()

		return stats, nil
	}

	// 回退到基本状态信息
	return map[string]interface{}{
		"service":       "useractivity-service",
		"database_type": "cloudsql",
		"status":        "unknown",
		"last_updated":  time.Now().UTC(),
	}, nil
}
