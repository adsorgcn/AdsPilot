// github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events/handler.go
package events

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/google/uuid"
)

// WorkflowStepStartedPayload defines the incoming event structure.
type WorkflowStepStartedPayload struct {
	WorkflowProgressID string                 `json:"workflowProgressId"`
	UserID             string                 `json:"userId"`
	Step               int                    `json:"step"`
	Context            map[string]interface{} `json:"context"`
}

// SiterankAnalysisCompletedPayload defines the outgoing event structure.
type SiterankAnalysisCompletedPayload struct {
	AnalysisID string  `json:"analysisId"`
	UserID     string  `json:"userId"`
	OfferID    string  `json:"offerId"`
	Score      float64 `json:"score"`
}

// EvaluationTaskCreatedPayload defines the evaluation task event structure.
type EvaluationTaskCreatedPayload struct {
	EvaluationID    string `json:"evaluationId"`
	OfferID         string `json:"offerId"`
	UserID          string `json:"userId"`
	IncludeAI       bool   `json:"includeAI"`
	ForceRefresh    bool   `json:"forceRefresh"`
	AccessToken     string `json:"accessToken"`
	ReserveTxID     string `json:"reserveTxId"`
	EstimatedTokens int    `json:"estimatedTokens"`
}

// simulateSiterankAnalysis mocks a call to an external service like SimilarWeb.
func simulateSiterankAnalysis(url string) (float64, map[string]interface{}) {
	log.Printf("Simulating siterank analysis for URL: %s", url)
	time.Sleep(2 * time.Second) // Simulate network latency

	// Generate a random score between 0 and 100.
	score := rand.Float64() * 100

	result := map[string]interface{}{
		"globalRank": rand.Intn(1000000),
		"country":    "United States",
		"traffic":    fmt.Sprintf("%dK", rand.Intn(500)+10),
		"score":      score,
	}
	log.Printf("Analysis complete. Score: %.2f", score)
	return score, result
}

// HandleWorkflowStepStarted processes the event to perform a siterank analysis.
func HandleWorkflowStepStarted(ctx context.Context, db *sql.DB, publisher *Publisher, payload []byte) error {
	var data WorkflowStepStartedPayload
	if err := json.Unmarshal(payload, &data); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	// This handler is only interested in Step 1 of the workflow.
	if data.Step != 1 {
		return nil // Not an error, just skipping.
	}

	offerID, ok := data.Context["offerId"].(string)
	if !ok || offerID == "" {
		return fmt.Errorf("offerId not found or invalid in workflow context")
	}
	url, ok := data.Context["originalUrl"].(string)
	if !ok || url == "" {
		return fmt.Errorf("originalUrl not found or invalid in workflow context")
	}

	log.Printf("Starting siterank analysis for offerID: %s", offerID)

	score, result := simulateSiterankAnalysis(url)
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}

	analysisID := uuid.New().String()

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert the analysis result into the SiterankAnalysis read model.
	_, err = tx.ExecContext(ctx, `
        INSERT INTO siterank.analyses
        (id, "userId", "offerId", status, result, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, 'completed', $4, NOW(), NOW())
		ON CONFLICT ("offerId") DO UPDATE SET
		status = 'completed', result = $4, "updatedAt" = NOW()
    `, analysisID, data.UserID, offerID, resultJSON)
	if err != nil {
		return fmt.Errorf("failed to insert siterank analysis: %w", err)
	}

	// Publish an event to notify that the analysis is complete.
	completedPayload := SiterankAnalysisCompletedPayload{
		AnalysisID: analysisID,
		UserID:     data.UserID,
		OfferID:    offerID,
		Score:      score,
	}

	if err := publisher.Publish(ctx, "SiterankAnalysisCompleted", completedPayload); err != nil {
		return fmt.Errorf("failed to publish completion event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("Successfully completed siterank analysis for offerID: %s", offerID)
	return nil
}

// EvaluationService interface for evaluation operations
type EvaluationService interface {
	ExecuteBasicEvaluation(ctx context.Context, evaluationID string) error
	ExecuteAIEvaluation(ctx context.Context, evaluationID string) error
}

// BillingClientInterface defines billing operations
type BillingClientInterface interface {
	ReleaseTokens(ctx context.Context, authHeader string, request interface{}, idempotencyKey string) (interface{}, error)
	CommitTokens(ctx context.Context, authHeader string, request interface{}, idempotencyKey string) (interface{}, error)
}

// HandleEvaluationTaskCreated processes evaluation task events
// After evaluation completes, commits tokens via Gateway internal API
func HandleEvaluationTaskCreated(
	ctx context.Context,
	evalServiceInterface interface{},
	billingClientInterface interface{}, // Kept for signature compatibility but not used
	payload []byte,
) error {
	startTime := time.Now()
	defer func() {
		metrics.PubSubProcessingDuration.WithLabelValues("EvaluationTaskCreated").Observe(time.Since(startTime).Seconds())
	}()

	var task EvaluationTaskCreatedPayload
	if err := json.Unmarshal(payload, &task); err != nil {
		return fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	log.Printf("Processing evaluation task: evaluationID=%s, offerId=%s, includeAI=%v",
		task.EvaluationID, task.OfferID, task.IncludeAI)

	// Type assertion
	evalService, ok := evalServiceInterface.(EvaluationService)
	if !ok {
		return fmt.Errorf("invalid evaluation service type")
	}

	actualTokens := 1 // Basic evaluation

	// Execute basic evaluation (pure execution - no billing)
	if err := evalService.ExecuteBasicEvaluation(ctx, task.EvaluationID); err != nil {
		log.Printf("Basic evaluation failed for %s: %v", task.EvaluationID, err)
		// Release tokens via Gateway if reservation exists
		if task.ReserveTxID != "" {
			releaseTokensViaGateway(ctx, task.AccessToken, task.ReserveTxID, task.EstimatedTokens, task.EvaluationID, "evaluation_failed")
		}
		return fmt.Errorf("basic evaluation failed: %w", err)
	}

	// Execute AI evaluation if requested
	if task.IncludeAI {
		if err := evalService.ExecuteAIEvaluation(ctx, task.EvaluationID); err != nil {
			log.Printf("AI evaluation failed for %s: %v", task.EvaluationID, err)
			// Basic succeeded but AI failed - commit basic tokens only (1 token)
			if task.ReserveTxID != "" {
				commitTokensViaGateway(ctx, task.AccessToken, task.ReserveTxID, 1, task.EvaluationID)
			}
			return fmt.Errorf("AI evaluation failed: %w", err)
		}
		actualTokens = 3 // Both basic and AI succeeded
	}

	// Commit actual tokens consumed via Gateway
	if task.ReserveTxID != "" {
		if err := commitTokensViaGateway(ctx, task.AccessToken, task.ReserveTxID, actualTokens, task.EvaluationID); err != nil {
			log.Printf("Warning: Failed to commit tokens for %s: %v", task.EvaluationID, err)
			// Don't fail the evaluation, just log
		}
	}

	log.Printf("Successfully completed evaluation task %s (includeAI=%v, tokens=%d)", task.EvaluationID, task.IncludeAI, actualTokens)
	metrics.PubSubMessagesProcessed.WithLabelValues("EvaluationTaskCreated", "success").Inc()
	return nil
}

// commitTokensViaGateway calls Gateway internal API to commit reserved tokens
func commitTokensViaGateway(ctx context.Context, authToken, reservationID string, actualCost int, taskID string) error {
	gatewayURL := getGatewayURL()

	commitReq := map[string]interface{}{
		"reservationId": reservationID,
		"actualCost":    actualCost,
		"service":       "siterank",
		"taskId":        taskID,
	}

	return callGatewayInternalAPI(ctx, authToken, gatewayURL+"/internal/v1/tokens/commit", commitReq)
}

// releaseTokensViaGateway calls Gateway internal API to release reserved tokens
func releaseTokensViaGateway(ctx context.Context, authToken, reservationID string, amount int, taskID, reason string) error {
	gatewayURL := getGatewayURL()

	releaseReq := map[string]interface{}{
		"reservationId": reservationID,
		"amount":        amount,
		"service":       "siterank",
		"taskId":        taskID,
		"reason":        reason,
	}

	return callGatewayInternalAPI(ctx, authToken, gatewayURL+"/internal/v1/tokens/release", releaseReq)
}

// callGatewayInternalAPI makes HTTP request to Gateway internal API
func callGatewayInternalAPI(ctx context.Context, authToken, endpoint string, body map[string]interface{}) error {
	jsonData, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", authToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call gateway: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gateway returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// getGatewayURL returns the Gateway URL from environment
func getGatewayURL() string {
	gatewayURL := os.Getenv("GATEWAY_URL")
	if gatewayURL == "" {
		gatewayURL = "http://localhost:8080" // Default
	}
	return gatewayURL
}
