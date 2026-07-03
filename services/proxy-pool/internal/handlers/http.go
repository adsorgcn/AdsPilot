package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/proxy-pool/internal/pool"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	manager pool.ManagerInterface
}

func NewHandler(manager pool.ManagerInterface) *Handler {
	return &Handler{manager: manager}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/health", h.Health)
	r.Get("/healthz", h.Health)
	r.Get("/proxy", h.GetProxy)
	r.Post("/proxy/release", h.ReleaseProxy)
	r.Get("/stats", h.GetStats)
}

// Health returns service health status
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"time":   map[string]interface{}{"timestamp": time.Now().UTC().Format(time.RFC3339)},
	})
}

// GetProxy allocates a proxy for target URL
func (h *Handler) GetProxy(w http.ResponseWriter, r *http.Request) {
	targetURL := r.URL.Query().Get("targetUrl")
	if targetURL == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "Missing targetUrl parameter"})
		return
	}

	country := r.URL.Query().Get("country") // Optional country filter

	proxy, err := h.manager.GetProxy(targetURL, country)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"proxy": proxy, "country": country})
}

type ReleaseRequest struct {
	Proxy          string `json:"proxy"`
	Country        string `json:"country"`
	Success        *bool  `json:"success"`
	ResponseTimeMs int    `json:"responseTime"`
}

// ReleaseProxy releases proxy back to pool
func (h *Handler) ReleaseProxy(w http.ResponseWriter, r *http.Request) {
	var req ReleaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	if req.Proxy == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": "proxy field is required"})
		return
	}

	success := true
	if req.Success != nil {
		success = *req.Success
	}

	if err := h.manager.ReleaseProxy(req.Proxy, req.Country, success, req.ResponseTimeMs); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"message": "Proxy released"})
}

// GetStats returns pool statistics
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	country := r.URL.Query().Get("country") // Optional country filter

	stats, err := h.manager.GetStats(country)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(stats)
}
