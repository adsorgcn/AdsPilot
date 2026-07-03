package storage

import (
	"context"
	"database/sql"
	"errors"

	_ "github.com/lib/pq"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

func NewDB(dsn string) (*sql.DB, error) {
	db, err := database.NewOptimizedConnection(dsn)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func GetUserRefreshToken(ctx context.Context, db *sql.DB, userID string) (token string, loginCID string, primaryCID sql.NullString, err error) {
	queryCtx, cancel := database.WithShortQueryTimeout(ctx)
	defer cancel()

	err = db.QueryRowContext(queryCtx, `SELECT "refreshToken", "loginCustomerId", "primaryCustomerId" FROM "UserAdsConnection" WHERE "userId"=$1 ORDER BY "updatedAt" DESC LIMIT 1`, userID).Scan(&token, &loginCID, &primaryCID)
	return
}

func UpsertUserRefreshToken(ctx context.Context, db *sql.DB, userID, loginCID, primaryCID, encryptedToken string) error {
	queryCtx, cancel := database.WithMediumQueryTimeout(ctx)
	defer cancel()

	// Try update existing row for user; else insert
	res, err := db.ExecContext(queryCtx, `UPDATE "UserAdsConnection" SET "refreshToken"=$1, "loginCustomerId"=$2, "primaryCustomerId"=NULLIF($3,''), "updatedAt"=NOW() WHERE "userId"=$4`, encryptedToken, loginCID, primaryCID, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n > 0 {
		return nil
	}
	_, err = db.ExecContext(queryCtx, `INSERT INTO "UserAdsConnection" ("userId","loginCustomerId","primaryCustomerId","refreshToken") VALUES ($1,$2,NULLIF($3,''),$4)`, userID, loginCID, primaryCID, encryptedToken)
	return err
}

var ErrNotFound = errors.New("not found")
