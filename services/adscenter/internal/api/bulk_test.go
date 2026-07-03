package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestBulkActionsHandler_HandleSubmitBulkActions tests bulk action submission
func TestBulkActionsHandler_HandleSubmitBulkActions(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		payload        interface{}
		wantStatusCode int
	}{
		{
			name:           "wrong HTTP method",
			method:         "GET",
			payload:        nil,
			wantStatusCode: http.StatusMethodNotAllowed,
		},
		{
			name:           "empty actions with validateOnly",
			method:         "POST",
			payload:        map[string]interface{}{"actions": []interface{}{}, "validateOnly": true},
			wantStatusCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			handler := NewBulkActionsHandler(nil)

			var body []byte
			var err error
			if tt.payload != nil {
				if str, ok := tt.payload.(string); ok {
					body = []byte(str)
				} else {
					body, err = json.Marshal(tt.payload)
					require.NoError(t, err)
				}
			}

			req := httptest.NewRequest(tt.method, "/api/v1/adscenter/bulk-actions", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req = withUserContext(req, "test-user-1")

			w := httptest.NewRecorder()

			// Act
			handler.HandleSubmitBulkActions(w, req)

			// Assert
			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestBulkActionsHandler_ValidateOnly tests validation mode
func TestBulkActionsHandler_ValidateOnly(t *testing.T) {
	t.Run("validate only mode returns summary", func(t *testing.T) {
		// Arrange
		handler := NewBulkActionsHandler(nil)

		plan := map[string]interface{}{
			"actions": []map[string]interface{}{
				{
					"type": "ROTATE_LINK",
					"params": map[string]interface{}{
						"newUrl": "https://example.com/new",
					},
				},
			},
			"validateOnly": true,
		}

		body, err := json.Marshal(plan)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/v1/adscenter/bulk-actions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = withUserContext(req, "test-user-1")

		w := httptest.NewRecorder()

		// Act
		handler.HandleSubmitBulkActions(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "summary")
	})
}
