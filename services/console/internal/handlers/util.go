package handlers

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse is a lightweight error payload used by console handlers.
type ErrorResponse struct {
	Error   string                 `json:"error"`
	Details map[string]interface{} `json:"details,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
