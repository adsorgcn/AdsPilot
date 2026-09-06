package api

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
)

// BulkActionsHandler retains the legacy local-preview endpoint.
// Live submission is unavailable until a durable execution worker exists.
type BulkActionsHandler struct {
	DB *sql.DB
}

func NewBulkActionsHandler(db *sql.DB) *BulkActionsHandler {
	return &BulkActionsHandler{DB: db}
}

func (h *BulkActionsHandler) HandleSubmitBulkActions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.InvalidRequest("method", "Method not allowed")
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid == "" {
		apierrors.Unauthorized("Unauthorized").WriteJSON(w, r)
		return
	}
	var plan struct {
		ValidateOnly *bool `json:"validateOnly"`
		Actions      []struct {
			Type   string         `json:"type"`
			Params map[string]any `json:"params"`
			Filter map[string]any `json:"filter"`
		} `json:"actions"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(&plan); err != nil {
		apierrors.InvalidRequest("body", "invalid action plan").WriteJSON(w, r)
		return
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		apierrors.InvalidRequest("body", "expected exactly one action plan").WriteJSON(w, r)
		return
	}
	if len(plan.Actions) == 0 {
		apierrors.InvalidRequest("actions", "at least one action is required").WriteJSON(w, r)
		return
	}
	for _, action := range plan.Actions {
		if strings.TrimSpace(action.Type) == "" {
			apierrors.InvalidRequest("actions.type", "action type is required").WriteJSON(w, r)
			return
		}
	}
	if plan.ValidateOnly != nil && !*plan.ValidateOnly {
		writeExecutionUnavailable(w, r, "Bulk execution is unavailable: no durable executor is connected")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "preview", "validateOnly": true, "executed": false,
		"googleValidated": false,
		"message":         "Local plan preview only; Google Ads has not validated or executed these actions",
		"summary":         map[string]any{"actions": len(plan.Actions)},
	})
}

func writeExecutionUnavailable(w http.ResponseWriter, r *http.Request, message string) {
	apiErr := apierrors.New("NOT_IMPLEMENTED", message, map[string]any{
		"executed": false, "googleValidated": false,
	})
	apiErr.HTTPStatus = http.StatusNotImplemented
	apiErr.WriteJSON(w, r)
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func generateOperationID() string {
	return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
}

func extractUserID(r *http.Request) string {
	uid := ""
	if v := r.Context().Value(middleware.UserIDKey); v != nil {
		if s, ok := v.(string); ok {
			uid = s
		}
	}
	if uid == "" {
		if v := r.Header.Get("X-User-Id"); v != "" {
			uid = v
		}
	}
	return uid
}
