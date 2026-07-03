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

func TestFeatureFlagsIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	config, err := SetupIntegrationTest(ctx)
	require.NoError(t, err, "Failed to setup integration test")
	defer config.Cleanup()

	// Clean up ALL historical test data BEFORE running tests
	err = config.CleanupAllTestData(ctx)
	require.NoError(t, err, "Failed to cleanup historical test data")

	testUserID := "integration-test-" + time.Now().Format("20060102150405")
	testFlagKey := "test_flag_" + time.Now().Format("20060102150405")
	defer config.CleanupTestData(ctx, testUserID)

	handler := &handlers.Handler{DB: config.DBPool}

	t.Run("CreateFeatureFlag_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"key":         testFlagKey,
			"enabled":     false,
			"description": "Integration test flag",
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

	t.Run("ListFeatureFlags_ContainsCreated", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/feature-flags", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListFeatureFlags(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)

		flags := response["flags"].([]interface{})
		found := false
		for _, flag := range flags {
			flagMap := flag.(map[string]interface{})
			if flagMap["key"] == testFlagKey {
				found = true
				assert.False(t, flagMap["enabled"].(bool))
				assert.Equal(t, "Integration test flag", flagMap["description"])
				break
			}
		}
		assert.True(t, found, "Created flag should be in the list")
	})

	t.Run("UpdateFeatureFlag_EnableFlag", func(t *testing.T) {
		payload := map[string]interface{}{
			"enabled":     true,
			"description": "Updated integration test flag",
			"reason":      "Testing enable functionality",
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

	t.Run("GetFeatureFlagHistory_HasEntry", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/feature-flags/"+testFlagKey+"/history", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetFeatureFlagHistory(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)

		assert.GreaterOrEqual(t, int(response["total"].(float64)), 1)
		history := response["history"].([]interface{})
		assert.GreaterOrEqual(t, len(history), 1)

		// Verify the history entry
		firstEntry := history[0].(map[string]interface{})
		assert.Equal(t, testFlagKey, firstEntry["flag_key"])
		assert.False(t, firstEntry["old_value"].(bool))
		assert.True(t, firstEntry["new_value"].(bool))
		assert.Equal(t, testUserID, firstEntry["changed_by"])
	})

	t.Run("UpdateFeatureFlag_DescriptionOnly", func(t *testing.T) {
		payload := map[string]interface{}{
			"enabled":     true,
			"description": "Description only update",
			"reason":      "Testing description update without value change",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PUT", "/api/v1/console/feature-flags/"+testFlagKey, bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.UpdateFeatureFlag(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		// History should NOT have a new entry since value didn't change
		histReq := httptest.NewRequest("GET", "/api/v1/console/feature-flags/"+testFlagKey+"/history", nil)
		histCtx := context.WithValue(histReq.Context(), "user_id", testUserID)
		histReq = histReq.WithContext(histCtx)
		histW := httptest.NewRecorder()

		handler.GetFeatureFlagHistory(histW, histReq)

		var histResponse map[string]interface{}
		json.NewDecoder(histW.Body).Decode(&histResponse)
		// Should still be 1 entry (only the first enable change)
		assert.Equal(t, float64(1), histResponse["total"])
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

		// Verify deletion
		listReq := httptest.NewRequest("GET", "/api/v1/console/feature-flags", nil)
		listCtx := context.WithValue(listReq.Context(), "user_id", testUserID)
		listReq = listReq.WithContext(listCtx)
		listW := httptest.NewRecorder()

		handler.ListFeatureFlags(listW, listReq)

		var listResponse map[string]interface{}
		json.NewDecoder(listW.Body).Decode(&listResponse)

		flags := listResponse["flags"].([]interface{})
		for _, flag := range flags {
			flagMap := flag.(map[string]interface{})
			assert.NotEqual(t, testFlagKey, flagMap["key"], "Deleted flag should not be in the list")
		}
	})
}
