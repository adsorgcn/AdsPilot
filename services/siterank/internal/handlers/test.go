package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/evaluation"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

var testLog = logger.Get()

// TestHandler handles test evaluation requests without authentication.
// Note: All database schema fixes (userid→user_id, originalurl→original_url, status constraint) are applied.
// Go version fixed to 1.23 (1.26 doesn't exist).
type TestHandler struct {
	evalService *evaluation.Service
	db          *sql.DB
}

// NewTestHandler creates a new test handler
func NewTestHandler(evalService *evaluation.Service, db *sql.DB) *TestHandler {
	return &TestHandler{
		evalService: evalService,
		db:          db,
	}
}

// TestEvaluateRequest is the request body for test evaluation
type TestEvaluateRequest struct {
	OfferURL     string `json:"offerUrl"`
	IncludeAI    bool   `json:"includeAI"`
	ForceRefresh bool   `json:"forceRefresh"`
}

// TestEvaluateResponse is the response for test evaluation
type TestEvaluateResponse struct {
	EvaluationID string `json:"evaluationId"`
	OfferID      string `json:"offerId"`
	Status       string `json:"status"`
	Message      string `json:"message"`
}

// TestEvaluate executes a synchronous evaluation for testing (no authentication)
func (h *TestHandler) TestEvaluate(w http.ResponseWriter, r *http.Request) {
	var req TestEvaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body: "+err.Error())
		return
	}

	// Validation
	if req.OfferURL == "" {
		h.respondError(w, http.StatusBadRequest, "INVALID_REQUEST", "offerUrl is required")
		return
	}

	// Create test offer in database
	// Generate a pure UUID for offer ID (no "test-" prefix) to satisfy database UUID constraint
	offerID := uuid.New().String()
	// Use a fixed UUID for test user to avoid database constraint errors
	userID := "00000000-0000-0000-0000-000000000001"

	_, err := h.db.Exec(`
		INSERT INTO offers (id, user_id, name, original_url, status, created_at)
		VALUES ($1, $2, $3, $4, 'evaluating', NOW())
		ON CONFLICT (id) DO NOTHING
	`, offerID, userID, "Test Offer", req.OfferURL)
	if err != nil {
		testLog.Error().Err(err).Msg("Failed to create test offer")
		h.respondError(w, http.StatusInternalServerError, "DATABASE_ERROR", "Failed to create test offer: "+err.Error())
		return
	}

	testLog.Info().
		Str("offerId", offerID).
		Str("offerUrl", req.OfferURL).
		Bool("includeAI", req.IncludeAI).
		Msg("Created test offer for evaluation")

	// Create and execute evaluation synchronously
	evalReq := &evaluation.EvaluationRequest{
		OfferID:      offerID,
		UserID:       userID,
		IncludeAI:    req.IncludeAI,
		ForceRefresh: req.ForceRefresh,
	}

	evalResult, err := h.evalService.CreateEvaluation(r.Context(), evalReq)
	if err != nil {
		testLog.Error().Err(err).Msg("Failed to create evaluation")
		h.respondError(w, http.StatusInternalServerError, "EVALUATION_ERROR", "Failed to create evaluation: "+err.Error())
		return
	}

	evalID := evalResult.ID

	testLog.Info().
		Str("evaluationId", evalID).
		Msg("Starting synchronous evaluation")

	// Execute basic evaluation immediately
	if err := h.evalService.ExecuteBasicEvaluation(r.Context(), evalID); err != nil {
		testLog.Error().Err(err).Str("evaluationId", evalID).Msg("Basic evaluation failed")
		h.respondError(w, http.StatusInternalServerError, "BASIC_EVAL_FAILED", "Basic evaluation failed: "+err.Error())
		return
	}

	testLog.Info().
		Str("evaluationId", evalID).
		Msg("Basic evaluation completed")

	// Execute AI evaluation if requested
	if req.IncludeAI {
		testLog.Info().
			Str("evaluationId", evalID).
			Msg("Starting AI evaluation")

		if err := h.evalService.ExecuteAIEvaluation(r.Context(), evalID); err != nil {
			testLog.Error().Err(err).Str("evaluationId", evalID).Msg("AI evaluation failed")
			h.respondError(w, http.StatusInternalServerError, "AI_EVAL_FAILED", "AI evaluation failed: "+err.Error())
			return
		}

		testLog.Info().
			Str("evaluationId", evalID).
			Msg("AI evaluation completed")
	}

	// Return success response
	resp := TestEvaluateResponse{
		EvaluationID: evalID,
		OfferID:      offerID,
		Status:       "completed",
		Message:      "Evaluation completed successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		testLog.Error().Err(err).Msg("Failed to encode response")
	}
}

// GetEvaluation retrieves an evaluation by ID (for testing)
func (h *TestHandler) GetEvaluation(w http.ResponseWriter, r *http.Request) {
	evaluationID := chi.URLParam(r, "evaluationId")
	if evaluationID == "" {
		h.respondError(w, http.StatusBadRequest, "INVALID_REQUEST", "evaluationId is required")
		return
	}

	eval, err := h.evalService.GetEvaluation(r.Context(), evaluationID, "00000000-0000-0000-0000-000000000001")
	if err != nil {
		if err == sql.ErrNoRows {
			h.respondError(w, http.StatusNotFound, "NOT_FOUND", "Evaluation not found")
			return
		}
		h.respondError(w, http.StatusInternalServerError, "DATABASE_ERROR", "Failed to retrieve evaluation: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(eval); err != nil {
		testLog.Error().Err(err).Msg("Failed to encode response")
	}
}

// respondError sends an error response
func (h *TestHandler) respondError(w http.ResponseWriter, statusCode int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}
