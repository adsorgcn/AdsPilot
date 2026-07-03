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

// TestDiagnoseHandler_HandleDiagnose tests the diagnose functionality
func TestDiagnoseHandler_HandleDiagnose(t *testing.T) {
	tests := []struct {
		name           string
		userID         string
		method         string
		payload        interface{}
		wantStatusCode int
	}{
		{
			name:           "missing user context",
			userID:         "",
			method:         "POST",
			payload:        map[string]interface{}{"accountId": "123456789"},
			wantStatusCode: http.StatusUnauthorized,
		},
		{
			name:           "wrong HTTP method",
			userID:         "test-user-1",
			method:         "GET",
			payload:        nil,
			wantStatusCode: http.StatusMethodNotAllowed,
		},
		{
			name:           "invalid JSON payload",
			userID:         "test-user-1",
			method:         "POST",
			payload:        "invalid json",
			wantStatusCode: http.StatusBadRequest,
		},
		{
			name:   "valid request with metrics",
			userID: "test-user-1",
			method: "POST",
			payload: map[string]interface{}{
				"accountId": "123456789",
				"metrics": map[string]interface{}{
					"impressions": 1000,
					"ctr":         0.05,
				},
			},
			wantStatusCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Arrange
			handler := NewDiagnoseHandler(nil, nil)

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

			req := httptest.NewRequest(tt.method, "/api/v1/adscenter/diagnose", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			if tt.userID != "" {
				req = withUserContext(req, tt.userID)
			}

			w := httptest.NewRecorder()

			// Act
			handler.HandleDiagnose(w, req)

			// Assert
			assert.Equal(t, tt.wantStatusCode, w.Code)
		})
	}
}

// TestDiagnoseHandler_DiagnosticRules tests diagnostic rule generation
func TestDiagnoseHandler_DiagnosticRules(t *testing.T) {
	t.Run("generates rules based on metrics", func(t *testing.T) {
		// Arrange
		handler := NewDiagnoseHandler(nil, nil)

		diagnoseReq := map[string]interface{}{
			"accountId": "123456789",
			"metrics": map[string]interface{}{
				"impressions":  1000,
				"ctr":          0.02, // Low CTR
				"qualityScore": 3,    // Low quality score
				"budgetPacing": 0.9,  // High budget pacing
				"dailyBudget":  100,
			},
		}

		body, err := json.Marshal(diagnoseReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/v1/adscenter/diagnose", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = withUserContext(req, "test-user-1")

		w := httptest.NewRecorder()

		// Act
		handler.HandleDiagnose(w, req)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err = json.Unmarshal(w.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Contains(t, response, "rules")
		assert.Contains(t, response, "suggestedActions")
	})
}

// TestDiagnoseHandler_EmptyBody tests with empty request body
func TestDiagnoseHandler_EmptyBody(t *testing.T) {
	t.Run("empty request body", func(t *testing.T) {
		// Arrange
		handler := NewDiagnoseHandler(nil, nil)

		req := httptest.NewRequest("POST", "/api/v1/adscenter/diagnose", nil)
		req.Header.Set("Content-Type", "application/json")
		req = withUserContext(req, "test-user-1")

		w := httptest.NewRecorder()

		// Act
		handler.HandleDiagnose(w, req)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
