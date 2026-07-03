package dburl

import (
	"log"
	"net/url"
	"os"
)

// RewriteIfNeeded checks for DB_NAME environment variable and rewrites the database URL if present.
// This supports logical database isolation where services can override the database name.
//
// Example:
//
//	DATABASE_URL=postgresql://user:pass@host:5432/gm_db
//	DB_NAME=offer_db
//	Result: postgresql://user:pass@host:5432/offer_db
func RewriteIfNeeded(originalURL string) string {
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		return originalURL
	}

	u, err := url.Parse(originalURL)
	if err != nil {
		log.Printf("WARN: Failed to parse DATABASE_URL, using as-is: %v", err)
		return originalURL
	}

	u.Path = "/" + dbName
	rewritten := u.String()

	log.Printf("DB_NAME override detected: using database '%s'", dbName)
	return rewritten
}
