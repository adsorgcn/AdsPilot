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

func TestCloudSQLFeatureFlagsIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping Cloud SQL integration test in short mode")
	}

	ctx := context.Background()
	config, err := SetupCloudSQLIntegrationTest(ctx)
	require.NoError(t, err, "Failed to setup Cloud SQL integration test")
	defer config.Cleanup()

	testUserID := "cloudsql-test-" + time.Now().Format("20060102150405")
	testFlagKey := "cloudsql_flag_" + time.Now().Format("20060102150405")
	defer config.CleanupTestData(ctx, testUserID)

	handler := &handlers.Handler{DB: config.DBPool}

	t.Run("CreateFeatureFlag_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"key":         testFlagKey,
			"enabled":     false,
			"description": "Cloud SQL integration test flag",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/feature-flags", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.CreateFeatureFlag(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.True(t, response["success"].(bool))
		assert.Equal(t, testFlagKey, response["key"])
	})

	t.Run("UpdateFeatureFlag_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"enabled":     true,
			"description": "Updated Cloud SQL test flag",
			"reason":      "Testing Cloud SQL integration",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PUT", "/api/v1/console/feature-flags/"+testFlagKey, bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.UpdateFeatureFlag(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.True(t, response["success"].(bool))
	})

	t.Run("GetFeatureFlagHistory_Success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/feature-flags/"+testFlagKey+"/history", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetFeatureFlagHistory(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.GreaterOrEqual(t, int(response["total"].(float64)), 1)
	})

	t.Run("DeleteFeatureFlag_Success", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/console/feature-flags/"+testFlagKey, nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.DeleteFeatureFlag(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.True(t, response["success"].(bool))
	})
}
