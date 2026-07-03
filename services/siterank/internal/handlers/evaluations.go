package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/evaluation"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/go-chi/chi/v5"
)

// EvaluationHandler handles offer evaluation requests
// Siterank is a pure execution engine - no business logic (subscription, billing)
// All orchestration is handled by the Offer service
type EvaluationHandler struct {
	evalService *evaluation.Service
	publisher   *events.Publisher
}

// NewEvaluationHandler creates a new evaluation handler
func NewEvaluationHandler(evalService *evaluation.Service, publisher *events.Publisher) *EvaluationHandler {
	return &EvaluationHandler{
		evalService: evalService,
		publisher:   publisher,
	}
}

// CreateEvaluationRequest represents the request body for creating an evaluation
type CreateEvaluationRequest struct {
	IncludeAI    bool `json:"includeAI"`
	ForceRefresh bool `json:"forceRefresh"`
}

// CreateEvaluationResponse represents the response for creating an evaluation
type CreateEvaluationResponse struct {
	EvaluationID    string `json:"evaluationId"`
	Status          string `json:"status"`
	EstimatedTokens int    `json:"estimatedTokens"`
	Message         string `json:"message"`
}

const (
	defaultHistoryLimit = 10
	maxHistoryLimit     = 100
)

// ErrorResponse represents an error response
type ErrorResponse struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// CreateOfferEvaluation handles POST /api/v1/offers/{offerId}/evaluate
// Pure execution mode - no subscription or token checks (handled by Offer service)
func (h *EvaluationHandler) CreateOfferEvaluation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	offerID := chi.URLParam(r, "offerId")

	// Validate user authentication
	claims, ok := supabaseauth.ClaimsFromContext(ctx)
	if !ok || strings.TrimSpace(claims.UserID) == "" {
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
		return
	}
	userID := strings.TrimSpace(claims.UserID)
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authorization header missing", nil)
		return
	}

	// Parse request body
	var req CreateEvaluationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body", nil)
		return
	}

	// Calculate estimated tokens (for response only)
	estimatedTokens := 1
	if req.IncludeAI {
		estimatedTokens = 3
	}

	// Create evaluation task (pure execution)
	evalReq := &evaluation.EvaluationRequest{
		OfferID:      offerID,
		UserID:       userID,
		IncludeAI:    req.IncludeAI,
		ForceRefresh: req.ForceRefresh,
	}

	result, err := h.evalService.CreateEvaluation(ctx, evalReq)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, "CREATION_FAILED", "Failed to create evaluation", nil)
		return
	}

	// Publish evaluation task to Pub/Sub for async processing
	// Note: ReserveTxID is empty - token management handled by Offer service
	taskPayload := events.EvaluationTaskCreatedPayload{
		EvaluationID:    result.ID,
		OfferID:         offerID,
		UserID:          userID,
		IncludeAI:       req.IncludeAI,
		ForceRefresh:    req.ForceRefresh,
		AccessToken:     authHeader,
		ReserveTxID:     "", // Token managed by Offer orchestrator
		EstimatedTokens: estimatedTokens,
	}

	if err := h.publisher.Publish(ctx, "EvaluationTaskCreated", taskPayload); err != nil {
		h.respondError(w, http.StatusInternalServerError, "TASK_PUBLISH_FAILED", "Failed to publish evaluation task", nil)
		return
	}

	// Respond with 202 Accepted
	response := CreateEvaluationResponse{
		EvaluationID:    result.ID,
		Status:          "pending",
		EstimatedTokens: estimatedTokens,
		Message:         "Evaluation task created, processing in background",
	}

	h.respondJSON(w, http.StatusAccepted, response)
}

// ListOfferEvaluations handles GET /api/v1/offers/{offerId}/evaluations
func (h *EvaluationHandler) ListOfferEvaluations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	offerID := chi.URLParam(r, "offerId")

	userID, ok := supabaseauth.UserIDFromContext(ctx)
	if !ok || strings.TrimSpace(userID) == "" {
		metrics.EvaluationHistoryRequests.WithLabelValues("unauthorized").Inc()
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
		return
	}

	// Parse limit parameter
	limit := defaultHistoryLimit
	if limitParam := strings.TrimSpace(r.URL.Query().Get("limit")); limitParam != "" {
		parsed, err := strconv.Atoi(limitParam)
		if err != nil || parsed <= 0 {
			h.respondError(w, http.StatusBadRequest, "INVALID_LIMIT", "limit must be a positive integer", nil)
			return
		}
		if parsed > maxHistoryLimit {
			parsed = maxHistoryLimit
		}
		limit = parsed
	}

	// Parse evaluation type filter
	var evalType *evaluation.EvaluationType
	switch strings.TrimSpace(r.URL.Query().Get("type")) {
	case "", "all":
		// no filter
	case "basic":
		t := evaluation.EvaluationTypeBasic
		evalType = &t
	case "ai":
		t := evaluation.EvaluationTypeAI
		evalType = &t
	default:
		h.respondError(w, http.StatusBadRequest, "INVALID_TYPE", "type must be one of basic, ai, all", nil)
		return
	}

	results, err := h.evalService.ListEvaluations(ctx, offerID, userID, evalType, limit)
	if err != nil {
		metrics.EvaluationHistoryRequests.WithLabelValues("error").Inc()
		h.respondError(w, http.StatusInternalServerError, "QUERY_FAILED", "Failed to list evaluations", nil)
		return
	}

	metrics.EvaluationHistoryRequests.WithLabelValues("success").Inc()

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"evaluations": results,
		"total":       len(results),
	})
}

// GetEvaluation handles GET /api/v1/evaluations/{evaluationId}
func (h *EvaluationHandler) GetEvaluation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	evaluationID := chi.URLParam(r, "evaluationId")

	// Get user ID from context
	userID, ok := supabaseauth.UserIDFromContext(ctx)
	if !ok {
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
		return
	}

	// Get evaluation
	result, err := h.evalService.GetEvaluation(ctx, evaluationID, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			h.respondError(w, http.StatusNotFound, "NOT_FOUND", "Evaluation not found", nil)
		} else {
			h.respondError(w, http.StatusInternalServerError, "QUERY_FAILED", "Failed to retrieve evaluation", nil)
		}
		return
	}

	h.respondJSON(w, http.StatusOK, result)
}

// GetLatestOfferEvaluation handles GET /api/v1/offers/{offerId}/evaluations/latest
func (h *EvaluationHandler) GetLatestOfferEvaluation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	offerID := chi.URLParam(r, "offerId")

	// Get user ID from context
	userID, ok := supabaseauth.UserIDFromContext(ctx)
	if !ok {
		h.respondError(w, http.StatusUnauthorized, "UNAUTHORIZED", "User not authenticated", nil)
		return
	}

	// Get evaluation type from query params
	evalType := r.URL.Query().Get("type")
	if evalType == "" {
		evalType = "basic"
	}

	var evalTypeEnum evaluation.EvaluationType
	switch evalType {
	case "basic":
		evalTypeEnum = evaluation.EvaluationTypeBasic
	case "ai":
		evalTypeEnum = evaluation.EvaluationTypeAI
	default:
		h.respondError(w, http.StatusBadRequest, "INVALID_TYPE", "Invalid evaluation type", nil)
		return
	}

	// Get latest evaluation
	result, err := h.evalService.GetLatestEvaluation(ctx, offerID, userID, evalTypeEnum)
	if err != nil {
		h.respondError(w, http.StatusNotFound, "NOT_FOUND", "No evaluation found", nil)
		return
	}

	h.respondJSON(w, http.StatusOK, result)
}

// Helper methods

func (h *EvaluationHandler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *EvaluationHandler) respondError(w http.ResponseWriter, status int, code, message string, details map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Code:    code,
		Message: message,
		Details: details,
	})
}
