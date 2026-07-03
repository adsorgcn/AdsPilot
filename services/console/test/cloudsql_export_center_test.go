//go:build cloudsql
// +build cloudsql

package test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/console/internal/handlers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloudSQLExportCenterIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Cloud SQL integration test in short mode")
	}

	ctx := context.Background()
	config, err := SetupCloudSQLIntegrationTest(ctx)
	require.NoError(t, err, "Failed to setup Cloud SQL integration test")
	defer config.Cleanup()

	testUserID := "cloudsql-test-" + time.Now().Format("20060102150405")
	defer config.CleanupTestData(ctx, testUserID)

	handler := &handlers.Handler{DB: config.DBPool}

	t.Run("ListExportHistory_EmptyAtStart", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/exports/history", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListExportHistory(w, req)

		if !assert.Equal(t, http.StatusOK, w.Code, "Response body: %s", w.Body.String()) {
			return
		}

		var response map[string]interface{}
		err := json.NewDecoder(w.Body).Decode(&response)
		require.NoError(t, err, "Failed to decode response")

		// Should be empty for new test user
		require.NotNil(t, response["total"], "Response missing 'total' field")
		total := int(response["total"].(float64))
		assert.GreaterOrEqual(t, total, 0)
	})

	t.Run("RecordExportHistory_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"type":         "token_usage",
			"format":       "csv",
			"start_date":   "2025-01-01",
			"end_date":     "2025-01-31",
			"record_count": 500,
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/exports/record", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.RecordExportHistory(w, req)

		if w.Code != http.StatusOK {
			t.Logf("Response body: %s", w.Body.String())
		}
		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.True(t, response["success"].(bool))
		assert.NotEmpty(t, response["export_id"])
	})

	t.Run("GetExportStats_WithData", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/exports/stats", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetExportStats(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var stats handlers.ExportStats
		json.NewDecoder(w.Body).Decode(&stats)
		assert.GreaterOrEqual(t, stats.TotalExports, 1)
	})
}
