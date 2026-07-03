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

func TestCloudSQLNotificationsIntegration(t *testing.T) {
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

	t.Run("CreateNotificationTemplate_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"name":    "Cloud SQL Test Template",
			"type":    "email",
			"subject": "Test {{user.name}}",
			"body":    "Hello {{user.name}}, testing Cloud SQL integration",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/create", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.CreateNotificationTemplate(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.True(t, response["success"].(bool))
		assert.NotEmpty(t, response["template_id"])
	})

	t.Run("ListNotificationTemplates_Success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/notifications/templates", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListNotificationTemplates(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.GreaterOrEqual(t, int(response["total"].(float64)), 1)
	})

	t.Run("PreviewTemplate_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"subject": "Test {{user.name}}",
			"body":    "Hello {{user.name}}",
			"context": map[string]interface{}{
				"user.name": "TestUser",
			},
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/preview", bytes.NewReader(body))
		w := httptest.NewRecorder()

		handler.PreviewTemplate(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.Equal(t, "Test TestUser", response["subject"])
		assert.Equal(t, "Hello TestUser", response["body"])
	})

	t.Run("GetBroadcastStats_Success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/notifications/stats", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.GetBroadcastStats(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var stats handlers.BroadcastStats
		json.NewDecoder(w.Body).Decode(&stats)
		assert.GreaterOrEqual(t, stats.TotalBroadcasts, 0)
	})
}
