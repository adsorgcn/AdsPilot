package handlers

import (
	"fmt"
	"net/http"

	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/clients"
	"github.com/ScientificInternet/Google-Monetize/services/gateway-middleware/internal/metrics"
	"github.com/gin-gonic/gin"
)

// TokenInternalHandler handles internal token management operations
// These endpoints are called by backend services (Offer, Adscenter) after task completion
type TokenInternalHandler struct {
	billingClient *clients.BillingClient
}

// NewTokenInternalHandler creates a new internal token handler
func NewTokenInternalHandler(billingClient *clients.BillingClient) *TokenInternalHandler {
	return &TokenInternalHandler{
		billingClient: billingClient,
	}
}

// CommitTokenRequest represents the request to commit reserved tokens
type CommitTokenRequest struct {
	ReservationID string `json:"reservationId" binding:"required"`
	ActualCost    int    `json:"actualCost" binding:"required,min=0"`
	Service       string `json:"service" binding:"required"`
	TaskID        string `json:"taskId" binding:"required"`
}

// ReleaseTokenRequest represents the request to release reserved tokens
type ReleaseTokenRequest struct {
	ReservationID string `json:"reservationId" binding:"required"`
	Amount        int    `json:"amount" binding:"required,min=0"`
	Service       string `json:"service" binding:"required"`
	TaskID        string `json:"taskId" binding:"required"`
	Reason        string `json:"reason"`
}

// CommitTokens handles POST /internal/v1/tokens/commit
// Called by backend services when task completes successfully
func (h *TokenInternalHandler) CommitTokens(c *gin.Context) {
	var req CommitTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request: %v", err),
			"code":  "INVALID_REQUEST",
		})
		return
	}

	// Extract auth token from internal service call
	authToken := c.GetHeader("Authorization")
	if authToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authorization header required",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	// Call billing service to commit tokens
	idempotencyKey := fmt.Sprintf("commit-%s-%s", req.Service, req.TaskID)
	commitResp, err := h.billingClient.CommitTokens(
		c.Request.Context(),
		authToken,
		&clients.CommitTokensRequest{
			TxID:   req.ReservationID,
			Amount: req.ActualCost,
			TaskID: req.TaskID,
			Source: req.Service,
		},
		idempotencyKey,
	)

	if err != nil {
		metrics.TokenCommitsTotal.WithLabelValues("error").Inc()
		c.JSON(http.StatusBadGateway, gin.H{
			"error": fmt.Sprintf("Failed to commit tokens: %v", err),
			"code":  "COMMIT_FAILED",
		})
		return
	}

	metrics.TokenCommitsTotal.WithLabelValues("success").Inc()

	c.JSON(http.StatusOK, gin.H{
		"status":        "committed",
		"reservationId": req.ReservationID,
		"actualCost":    req.ActualCost,
		"transactionId": commitResp.TxID,
	})
}

// ReleaseTokens handles POST /internal/v1/tokens/release
// Called by backend services when task fails or is cancelled
func (h *TokenInternalHandler) ReleaseTokens(c *gin.Context) {
	var req ReleaseTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Invalid request: %v", err),
			"code":  "INVALID_REQUEST",
		})
		return
	}

	// Extract auth token from internal service call
	authToken := c.GetHeader("Authorization")
	if authToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authorization header required",
			"code":  "UNAUTHORIZED",
		})
		return
	}

	// Call billing service to release tokens
	idempotencyKey := fmt.Sprintf("release-%s-%s", req.Service, req.TaskID)
	releaseResp, err := h.billingClient.ReleaseTokens(
		c.Request.Context(),
		authToken,
		&clients.ReleaseTokensRequest{
			TxID:   req.ReservationID,
			Amount: req.Amount,
			TaskID: req.TaskID,
		},
		idempotencyKey,
	)

	if err != nil {
		metrics.TokenReleasesTotal.WithLabelValues("error").Inc()
		c.JSON(http.StatusBadGateway, gin.H{
			"error": fmt.Sprintf("Failed to release tokens: %v", err),
			"code":  "RELEASE_FAILED",
		})
		return
	}

	metrics.TokenReleasesTotal.WithLabelValues("success").Inc()

	c.JSON(http.StatusOK, gin.H{
		"status":        "released",
		"reservationId": req.ReservationID,
		"amount":        req.Amount,
		"transactionId": releaseResp.TxID,
		"reason":        req.Reason,
	})
}
