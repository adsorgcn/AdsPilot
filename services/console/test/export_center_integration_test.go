//go:build integration
// +build integration

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

func TestExportCenterIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	config, err := SetupIntegrationTest(ctx)
	require.NoError(t, err, "Failed to setup integration test")
	defer config.Cleanup()

	// Clean up ALL historical test data BEFORE running tests
	// This ensures a clean slate even if previous test runs left data behind
	err = config.CleanupAllTestData(ctx)
	require.NoError(t, err, "Failed to cleanup historical test data")

	testUserID := "integration-test-" + time.Now().Format("20060102150405")

	// Also clean up after tests complete
	defer config.CleanupTestData(ctx, testUserID)

	handler := &handlers.Handler{DB: config.DBPool}

	t.Run("ListExportHistory_EmptyAtStart", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/history/history", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListExportHistory(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.Equal(t, float64(0), response["total"])
	})

	var exportID string

	t.Run("RecordExportHistory_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"type":         "token_usage",
			"format":       "csv",
			"start_date":   "2025-01-01",
			"end_date":     "2025-01-31",
			"record_count": 500,
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/history/record", bytes.NewReader(body))
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

		exportID = response["export_id"].(string)
	})

	t.Run("ListExportHistory_AfterRecord", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/history/history", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListExportHistory(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)

		if w.Code != http.StatusOK {
			t.Logf("Response: %+v", response)
		}
		assert.Equal(t, float64(1), response["total"])

		history, ok := response["history"].([]interface{})
		if !ok || len(history) == 0 {
			t.Logf("Response body: %s", w.Body.String())
			t.Fatalf("Expected history array, got: %+v", response)
		}
		assert.Len(t, history, 1)

		firstExport := history[0].(map[string]interface{})
		assert.Equal(t, exportID, firstExport["id"])
		assert.Equal(t, "token_usage", firstExport["type"])
		assert.Equal(t, "csv", firstExport["format"])
		assert.Equal(t, "pending", firstExport["status"])
	})

	t.Run("GetExportStats_WithData", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/history/stats", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetExportStats(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var stats handlers.ExportStats
		json.NewDecoder(w.Body).Decode(&stats)
		assert.GreaterOrEqual(t, stats.TotalExports, 1)
		assert.GreaterOrEqual(t, stats.TodayExports, 1)
	})

	t.Run("RecordExportHistory_MultipleTypes", func(t *testing.T) {
		types := []string{"offer_metrics", "user_activity", "payment_history"}

		for _, exportType := range types {
			payload := map[string]interface{}{
				"type":         exportType,
				"format":       "json",
				"start_date":   "2025-01-01",
				"end_date":     "2025-01-31",
				"record_count": 100,
			}
			body, _ := json.Marshal(payload)
			req := httptest.NewRequest("POST", "/api/v1/console/history/record", bytes.NewReader(body))
			ctx := context.WithValue(req.Context(), "user_id", testUserID)
			req = req.WithContext(ctx)
			w := httptest.NewRecorder()

			handler.RecordExportHistory(w, req)
			assert.Equal(t, http.StatusOK, w.Code)
		}

		// Verify stats
		req := httptest.NewRequest("GET", "/api/v1/console/history/stats", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetExportStats(w, req)

		var stats handlers.ExportStats
		json.NewDecoder(w.Body).Decode(&stats)
		assert.GreaterOrEqual(t, stats.TotalExports, 4)
		assert.Contains(t, stats.TypeBreakdown, "token_usage")
		assert.Contains(t, stats.TypeBreakdown, "offer_metrics")
	})
}
