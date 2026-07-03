package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
	"github.com/go-chi/chi/v5"
)

// SimilarWebHandler handles SimilarWeb data requests
// Pure data service - no billing logic (orchestrated by caller)
type SimilarWebHandler struct {
	swClient *similarweb.CachedClient
}

// NewSimilarWebHandler creates a new SimilarWeb handler
func NewSimilarWebHandler(swClient *similarweb.CachedClient) *SimilarWebHandler {
	return &SimilarWebHandler{
		swClient: swClient,
	}
}

// SimilarWebResponse represents the response for SimilarWeb data
type SimilarWebResponse struct {
	Domain   string                     `json:"domain"`
	Data     *similarweb.SimilarWebData `json:"data"`
	Cached   bool                       `json:"cached"`
	CachedAt *string                    `json:"cachedAt,omitempty"`
}

// GetSimilarWebData handles GET /api/v1/domains/{domain}/similarweb
// Pure data fetching - no billing logic (caller is responsible for token management)
func (h *SimilarWebHandler) GetSimilarWebData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	domain := chi.URLParam(r, "domain")

	// Basic authentication check
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authorization header missing", nil)
		return
	}

	// Get forceRefresh from query params
	forceRefresh := false
	if forceRefreshStr := r.URL.Query().Get("forceRefresh"); forceRefreshStr != "" {
		if parsed, err := strconv.ParseBool(forceRefreshStr); err == nil {
			forceRefresh = parsed
		}
	}

	// Fetch SimilarWeb data (pure execution)
	result, err := h.swClient.GetDomainData(ctx, domain, forceRefresh)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "NOT_FOUND", "Unable to fetch data for this domain", nil)
		return
	}

	// Build response
	response := SimilarWebResponse{
		Domain: domain,
		Data:   result.Data,
		Cached: result.Cached,
	}

	if result.CachedAt != nil {
		cachedAtStr := result.CachedAt.Format("2006-01-02T15:04:05Z07:00")
		response.CachedAt = &cachedAtStr
	}

	h.respondJSON(w, http.StatusOK, response)
}

// Helper methods (inherited from base handler)

func (h *SimilarWebHandler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	handler := &EvaluationHandler{}
	handler.respondJSON(w, status, data)
}

func (h *SimilarWebHandler) respondError(w http.ResponseWriter, status int, code, message string, details map[string]interface{}) {
	handler := &EvaluationHandler{}
	handler.respondError(w, status, code, message, details)
}
