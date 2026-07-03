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
	log.Println("=========================================")
	log.Println("  应用性能索引到Cloud SQL")
	log.Printf("  日期: %s\n", time.Now().Format(time.RFC3339))
	log.Println("=========================================")

	// 获取DATABASE_URL
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("❌ DATABASE_URL环境变量未设置")
	}

	log.Println("✅ DATABASE_URL已设置")
	log.Println("")

	// 连接数据库
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		log.Fatalf("打开数据库失败: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	log.Println("✅ 数据库连接成功")
	log.Println("")

	// 索引列表（基于实际数据库表结构）
	indexes := []struct {
		name string
		sql  string
	}{
		{"offers - user_id+status", `CREATE INDEX IF NOT EXISTS idx_offers_user_status ON offers(user_id, status)`},
		{"offers - user_id+created_at", `CREATE INDEX IF NOT EXISTS idx_offers_user_created ON offers(user_id, created_at DESC)`},
		{"offers - status+created_at", `CREATE INDEX IF NOT EXISTS idx_offers_status_created ON offers(status, created_at DESC)`},
		{"offer_evaluations - user_id+status", `CREATE INDEX IF NOT EXISTS idx_offer_eval_user_status ON offer_evaluations(user_id, status)`},
		{"offer_evaluations - created_at", `CREATE INDEX IF NOT EXISTS idx_offer_eval_created ON offer_evaluations(created_at DESC)`},
		{"url_visit_results - user_id+result_type", `CREATE INDEX IF NOT EXISTS idx_url_visit_user_result ON url_visit_results(user_id, result_type)`},
		{"url_visit_results - domain+created_at", `CREATE INDEX IF NOT EXISTS idx_url_visit_domain_created ON url_visit_results(domain, created_at DESC)`},
	}

	log.Println("开始创建索引...")
	for i, idx := range indexes {
		log.Printf("[%d/%d] %s...", i+1, len(indexes), idx.name)
		if _, err := db.ExecContext(ctx, idx.sql); err != nil {
			log.Printf("  ⚠️  警告: %v", err)
		} else {
			log.Printf("  ✅ 成功")
		}
	}

	log.Println("")
	log.Println("更新表统计信息...")
	tables := []string{"offers", "offer_evaluations", "url_visit_results"}
	for _, table := range tables {
		log.Printf("  ANALYZE %s...", table)
		if _, err := db.ExecContext(ctx, fmt.Sprintf(`ANALYZE %s`, table)); err != nil {
			log.Printf("    ⚠️  %v", err)
		} else {
			log.Printf("    ✅")
		}
	}

	log.Println("")
	log.Println("验证索引:")
	rows, err := db.QueryContext(ctx, `
		SELECT tablename, indexname
		FROM pg_indexes
		WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
		ORDER BY tablename, indexname
	`)
	if err != nil {
		log.Printf("查询失败: %v", err)
	} else {
		defer rows.Close()
		count := 0
		for rows.Next() {
			var table, index string
			rows.Scan(&table, &index)
			log.Printf("  %s.%s", table, index)
			count++
		}
		log.Printf("\n共 %d 个性能索引", count)
	}

	log.Println("")
	log.Println("=========================================")
	log.Println("  ✅ 迁移完成！")
	log.Println("=========================================")
}
