package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	tokencrypto "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/crypto"
	_ "github.com/lib/pq"
)

func mustEnv(k string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		log.Fatalf("required env %s not set", k)
	}
	return v
}

func readDatabaseURL(ctx context.Context) string {
	if sec := os.Getenv("DATABASE_URL_SECRET_NAME"); strings.TrimSpace(sec) != "" {
		// Fallback: require caller to inject DATABASE_URL directly for this tool to keep dependencies simple.
		// In CI, prefer: export DATABASE_URL=$(gcloud secrets versions access latest --secret=DATABASE_URL)
		log.Println("INFO: DATABASE_URL_SECRET_NAME set; please export DATABASE_URL from Secret Manager before running this tool")
	}
	v := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if v == "" {
		log.Fatal("DATABASE_URL not set (export from Secret Manager first)")
	}
	return v
}

func main() {
	ctx := context.Background()
	dryRun := flag.Bool("dry-run", true, "only print actions without writing")
	flag.Parse()

	dsn := readDatabaseURL(ctx)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("db open: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("db ping: %v", err)
	}

	keyB64 := mustEnv("REFRESH_TOKEN_ENC_KEY_B64")
	key, err := base64.StdEncoding.DecodeString(keyB64)
	if err != nil || len(key) != 32 {
		log.Fatalf("invalid REFRESH_TOKEN_ENC_KEY_B64: must be base64(32 bytes)")
	}

	rows, err := db.QueryContext(ctx, `SELECT id, "userId", "refreshToken" FROM "UserAdsConnection"`)
	if err != nil {
		log.Fatalf("query: %v", err)
	}
	defer rows.Close()

	var updates int
	for rows.Next() {
		var id, userID, token string
		if err := rows.Scan(&id, &userID, &token); err != nil {
			log.Fatalf("scan: %v", err)
		}
		// Attempt decrypt with current key; if succeeds, it's already encrypted
		if _, err := tokencrypto.Decrypt(key, token); err == nil {
			continue
		}
		// Try to detect likely base64-ciphertext pattern: we already tried decrypt; assume plaintext
		enc, err := tokencrypto.Encrypt(key, token)
		if err != nil {
			log.Printf("WARN: user=%s id=%s encrypt failed: %v", userID, id, err)
			continue
		}
		updates++
		log.Printf("INFO: user=%s id=%s will rewrite plaintext -> encrypted", userID, id)
		if !*dryRun {
			if _, err := db.ExecContext(ctx, `UPDATE "UserAdsConnection" SET "refreshToken"=$1, "updatedAt"=NOW() WHERE id=$2`, enc, id); err != nil {
				log.Printf("ERROR: update failed for id=%s: %v", id, err)
			}
		}
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("rows: %v", err)
	}
	if *dryRun {
		fmt.Printf("Dry-run complete. Would update %d rows.\n", updates)
	} else {
		fmt.Printf("Migration complete. Updated %d rows.\n", updates)
	}
}
