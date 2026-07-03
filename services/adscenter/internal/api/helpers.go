package api

import (
	"database/sql"

	"github.com/ScientificInternet/Google-Monetize/pkg/database"
)

// openDB opens a database connection with schema isolation support
func openDB(databaseURL string) (*sql.DB, error) {
	return database.InitWithSchemaAndPool(databaseURL)
}

// toMap converts interface{} to map[string]interface{}
func toMap(v interface{}) map[string]interface{} {
	if m, ok := v.(map[string]interface{}); ok {
		return m
	}
	return nil
}

// int64From converts interface{} to int64
func int64From(v interface{}) int64 {
	switch t := v.(type) {
	case float64:
		return int64(t)
	case int64:
		return t
	case int:
		return int64(t)
	case int32:
		return int64(t)
	default:
		return 0
	}
}
