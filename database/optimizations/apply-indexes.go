package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

func main() {
	ctx := context.Background()

	// 获取DATABASE_URL
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL环境变量未设置")
	}

	// 连接数据库
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("打开数据库连接失败: %v", err)
	}
	defer db.Close()

	// 验证连接
	ctx2, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx2); err != nil {
		log.Fatalf("数据库连接验证失败: %v", err)
	}
	log.Println("✅ 数据库连接成功")

	// 执行迁移
	migrations := []struct {
		name string
		sql  string
	}{
		{"Offer表索引 - userId+status", `CREATE INDEX IF NOT EXISTS idx_offer_user_status ON "Offer"("userId", "status")`},
		{"Offer表索引 - userId+createdAt", `CREATE INDEX IF NOT EXISTS idx_offer_user_created ON "Offer"("userId", "createdAt" DESC)`},
		{"Offer表索引 - status+createdAt", `CREATE INDEX IF NOT EXISTS idx_offer_status_created ON "Offer"("status", "createdAt" DESC)`},
		{"TokenTransaction表索引 - userId+type", `CREATE INDEX IF NOT EXISTS idx_token_tx_user_type ON "TokenTransaction"("userId", "type")`},
		{"TokenTransaction表索引 - type+createdAt", `CREATE INDEX IF NOT EXISTS idx_token_tx_type_created ON "TokenTransaction"("type", "createdAt" DESC)`},
		{"TokenTransaction表索引 - source", `CREATE INDEX IF NOT EXISTS idx_token_tx_source ON "TokenTransaction"("source")`},
		{"TokenTransaction表索引 - pending status", `CREATE INDEX IF NOT EXISTS idx_token_tx_status ON "TokenTransaction"("status") WHERE "status" = 'pending'`},
		{"Subscription表索引 - status", `CREATE INDEX IF NOT EXISTS idx_subscription_status ON "Subscription"("status")`},
		{"Subscription表索引 - active period", `CREATE INDEX IF NOT EXISTS idx_subscription_period_end ON "Subscription"("currentPeriodEnd") WHERE "status" = 'active'`},
		{"UserAdsConnection表索引 - loginCustomerId", `CREATE INDEX IF NOT EXISTS idx_userads_login_customer ON "UserAdsConnection"("loginCustomerId")`},
		{"BulkAudit表索引 - userId+createdAt", `CREATE INDEX IF NOT EXISTS idx_bulk_audit_user_created ON "BulkAudit"("userId", "createdAt" DESC)`},
		{"BulkAudit表索引 - status", `CREATE INDEX IF NOT EXISTS idx_bulk_audit_status ON "BulkAudit"("status")`},
		{"Event表索引 - createdAt", `CREATE INDEX IF NOT EXISTS idx_event_created ON "Event"("createdAt" DESC)`},
		{"AuditEvents表索引 - entity", `CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON "AuditEvents"("entityType", "entityId")`},
		{"AuditEvents表索引 - createdAt", `CREATE INDEX IF NOT EXISTS idx_audit_events_created ON "AuditEvents"("createdAt" DESC)`},
	}

	for _, m := range migrations {
		log.Printf("正在创建: %s...", m.name)
		if _, err := db.ExecContext(ctx, m.sql); err != nil {
			log.Printf("  ⚠️  警告: %v", err)
		} else {
			log.Printf("  ✅ 成功")
		}
	}

	// 更新统计信息
	log.Println("\n更新表统计信息...")
	tables := []string{"Offer", "TokenTransaction", "Subscription", "UserAdsConnection", "BulkAudit", "Event", "AuditEvents"}
	for _, table := range tables {
		log.Printf("分析表: %s...", table)
		if _, err := db.ExecContext(ctx, fmt.Sprintf(`ANALYZE "%s"`, table)); err != nil {
			log.Printf("  ⚠️  警告: %v", err)
		} else {
			log.Printf("  ✅ 成功")
		}
	}

	// 验证索引
	log.Println("\n验证已创建的索引:")
	rows, err := db.QueryContext(ctx, `
		SELECT tablename, indexname
		FROM pg_indexes
		WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
		ORDER BY tablename, indexname
	`)
	if err != nil {
		log.Fatalf("查询索引失败: %v", err)
	}
	defer rows.Close()

	var count int
	for rows.Next() {
		var tableName, indexName string
		if err := rows.Scan(&tableName, &indexName); err != nil {
			log.Printf("扫描行失败: %v", err)
			continue
		}
		log.Printf("  %s.%s", tableName, indexName)
		count++
	}

	log.Printf("\n✅ 索引迁移完成！共创建/验证 %d 个索引", count)
}
