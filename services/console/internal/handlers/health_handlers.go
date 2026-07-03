package handlers

import (
	"encoding/json"
	"net/http"
	"time"
)

// healthAggregate returns simplified health status for console service only.
// GET /api/health
// Response: { overall: "ok"|"down", services: {console: {status, latency_ms}}, updatedAt: ISO8601 }
func (h *Handler) healthAggregate(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	type item struct {
		Status  string `json:"status"`
		Latency int64  `json:"latency_ms"`
		Error   string `json:"error,omitempty"`
	}

	// Check database connectivity
	status := "ok"
	consoleItem := item{Status: "up"}

	if err := h.DB.Ping(r.Context()); err != nil {
		status = "down"
		consoleItem.Status = "down"
		consoleItem.Error = "database connection failed"
	}

	consoleItem.Latency = time.Since(start).Milliseconds()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"overall":   status,
		"services":  map[string]item{"console": consoleItem},
		"updatedAt": time.Now().UTC().Format(time.RFC3339),
	})
}
