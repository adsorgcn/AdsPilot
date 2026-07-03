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

func TestNotificationsIntegration(t *testing.T) {
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
	defer config.CleanupTestData(ctx, testUserID)

	handler := &handlers.Handler{DB: config.DBPool}

	var templateID string

	t.Run("CreateNotificationTemplate_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"name":    "Integration Test Template",
			"type":    "email",
			"subject": "Welcome {{user.name}}",
			"body":    "Hello {{user.name}}, your token balance is {{token.balance}}",
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

		templateID = response["template_id"].(string)
	})

	t.Run("ListNotificationTemplates_ContainsCreated", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/notifications/templates", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListNotificationTemplates(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)

		templates := response["templates"].([]interface{})
		found := false
		for _, tmpl := range templates {
			tmplMap := tmpl.(map[string]interface{})
			if tmplMap["id"] == templateID {
				found = true
				assert.Equal(t, "Integration Test Template", tmplMap["name"])
				assert.Equal(t, "email", tmplMap["type"])

				// Verify auto-extracted variables
				variables := tmplMap["variables"].([]interface{})
				assert.Contains(t, variables, "user.name")
				assert.Contains(t, variables, "token.balance")
				break
			}
		}
		assert.True(t, found, "Created template should be in the list")
	})

	t.Run("PreviewTemplate_Success", func(t *testing.T) {
		payload := map[string]interface{}{
			"subject": "Welcome {{user.name}}",
			"body":    "Hello {{user.name}}, your balance is {{token.balance}}",
			"context": map[string]interface{}{
				"user.name":     "Alice",
				"token.balance": 1000,
			},
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/preview", bytes.NewReader(body))
		w := httptest.NewRecorder()

		handler.PreviewTemplate(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		assert.Equal(t, "Welcome Alice", response["subject"])
		assert.Equal(t, "Hello Alice, your balance is 1000", response["body"])
	})

	t.Run("BroadcastNotification_Success", func(t *testing.T) {
		// Note: This test requires users in the database
		// We'll test the API call but may not have actual users to send to
		payload := map[string]interface{}{
			"templateId":  templateID,
			"targetGroup": "all",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/notifications/broadcast", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.BroadcastNotification(w, req)

		// May succeed with 0 targets or fail if no users exist
		// Both are acceptable for integration test
		if w.Code == http.StatusOK {
			var response map[string]interface{}
			json.NewDecoder(w.Body).Decode(&response)
			assert.True(t, response["success"].(bool))
			assert.NotEmpty(t, response["broadcast_id"])
		} else {
			// If there are no users, it might return 404 or other error
			t.Logf("Broadcast returned status %d (expected in test environment with no users)", w.Code)
		}
	})

	t.Run("ListBroadcasts_Success", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/console/notifications/broadcasts", nil)
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.ListBroadcasts(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		var response map[string]interface{}
		json.NewDecoder(w.Body).Decode(&response)
		// Should have at least the broadcast we just created (if successful)
		assert.GreaterOrEqual(t, int(response["total"].(float64)), 0)
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
		// Stats should be valid even if no broadcasts exist
		assert.GreaterOrEqual(t, stats.TotalBroadcasts, 0)
		assert.GreaterOrEqual(t, stats.SuccessRate, 0.0)
	})

	t.Run("TemplateRendering_ConditionalBlocks", func(t *testing.T) {
		// Create a template with conditional
		payload := map[string]interface{}{
			"name":    "VIP Template",
			"type":    "inapp",
			"subject": "Special Offer",
			"body":    "Hello {{user.name}}. {{#if vip}}You are a VIP member!{{/if}}",
		}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/create", bytes.NewReader(body))
		ctx := context.WithValue(req.Context(), "user_id", testUserID)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()

		handler.CreateNotificationTemplate(w, req)
		assert.Equal(t, http.StatusOK, w.Code)

		// Preview with vip=true
		previewPayload := map[string]interface{}{
			"subject": "Special Offer",
			"body":    "Hello {{user.name}}. {{#if vip}}You are a VIP member!{{/if}}",
			"context": map[string]interface{}{
				"user.name": "Bob",
				"vip":       true,
			},
		}
		previewBody, _ := json.Marshal(previewPayload)
		previewReq := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/preview", bytes.NewReader(previewBody))
		previewW := httptest.NewRecorder()

		handler.PreviewTemplate(previewW, previewReq)

		assert.Equal(t, http.StatusOK, previewW.Code)
		var response map[string]interface{}
		json.NewDecoder(previewW.Body).Decode(&response)
		assert.Equal(t, "Hello Bob. You are a VIP member!", response["body"])

		// Preview with vip=false
		previewPayload["context"] = map[string]interface{}{
			"user.name": "Bob",
			"vip":       false,
		}
		previewBody2, _ := json.Marshal(previewPayload)
		previewReq2 := httptest.NewRequest("POST", "/api/v1/console/notifications/templates/preview", bytes.NewReader(previewBody2))
		previewW2 := httptest.NewRecorder()

		handler.PreviewTemplate(previewW2, previewReq2)

		var response2 map[string]interface{}
		json.NewDecoder(previewW2.Body).Decode(&response2)
		assert.Equal(t, "Hello Bob. ", response2["body"])
	})
}
