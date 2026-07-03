package clients

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
)

// BillingClient handles communication with the Billing service using serviceclient
type BillingClient struct {
	registry *serviceclient.Registry
}

// NewBillingClient creates a new Billing service client using serviceclient
func NewBillingClient(registry *serviceclient.Registry) *BillingClient {
	return &BillingClient{
		registry: registry,
	}
}

// SubscriptionResponse represents the subscription API response
type SubscriptionResponse struct {
	ID               string    `json:"id"`
	UserID           string    `json:"userId"`
	PlanID           string    `json:"planId"`
	Tier             string    `json:"tier"`
	Status           string    `json:"status"`
	CurrentPeriodEnd time.Time `json:"currentPeriodEnd"`
}

// TokenBalanceResponse represents the token balance API response
type TokenBalanceResponse struct {
	UserID    string `json:"userId"`
	Available int    `json:"available"`
	Reserved  int    `json:"reserved"`
	Total     int    `json:"total"`
}

// PermissionsResponse represents the permissions API response
type PermissionsResponse struct {
	Tier        string   `json:"tier"`
	Permissions []string `json:"permissions"`
}

// GetSubscription retrieves user's subscription from Billing service
func (c *BillingClient) GetSubscription(ctx context.Context, authToken string) (*SubscriptionResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var subscription SubscriptionResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodGet,
		Path:   "/api/v1/users/me/subscription",
		Headers: map[string]string{
			"Authorization": authToken,
		},
	}, &subscription)

	if err != nil {
		return nil, fmt.Errorf("failed to get subscription: %w", err)
	}

	return &subscription, nil
}

// GetTokenBalance retrieves user's token balance from Billing service
func (c *BillingClient) GetTokenBalance(ctx context.Context, authToken string) (*TokenBalanceResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var balance TokenBalanceResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodGet,
		Path:   "/api/v1/users/me/tokens/balance",
		Headers: map[string]string{
			"Authorization": authToken,
		},
	}, &balance)

	if err != nil {
		return nil, fmt.Errorf("failed to get token balance: %w", err)
	}

	return &balance, nil
}

// GetPlanPermissions retrieves permissions for a subscription tier
func (c *BillingClient) GetPlanPermissions(ctx context.Context, tier string) (*PermissionsResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var permissions PermissionsResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/billing/plans/%s/permissions", tier),
	}, &permissions)

	if err != nil {
		return nil, fmt.Errorf("failed to get plan permissions: %w", err)
	}

	return &permissions, nil
}

// ReserveTokensRequest represents token reservation request
type ReserveTokensRequest struct {
	Amount  int    `json:"amount"`
	Service string `json:"service"`
	Action  string `json:"action"`
	Reason  string `json:"reason"`
}

// ReserveTokensResponse represents token reservation response
type ReserveTokensResponse struct {
	ReservationID string    `json:"reservationId"`
	UserID        string    `json:"userId"`
	Amount        int       `json:"amount"`
	ExpiresAt     time.Time `json:"expiresAt"`
}

// ReserveTokens reserves tokens for an operation
func (c *BillingClient) ReserveTokens(ctx context.Context, authToken string, userID string, req *ReserveTokensRequest) (*ReserveTokensResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var reservation ReserveTokensResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/v1/users/%s/tokens/reserve", userID),
		Body:   req,
		Headers: map[string]string{
			"Authorization": authToken,
		},
	}, &reservation)

	if err != nil {
		return nil, fmt.Errorf("failed to reserve tokens: %w", err)
	}

	return &reservation, nil
}

// ReleaseReservation releases a token reservation (refund)
func (c *BillingClient) ReleaseReservation(ctx context.Context, authToken string, reservationID string) error {
	if c.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/v1/tokens/reservations/%s/release", reservationID),
		Headers: map[string]string{
			"Authorization": authToken,
		},
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to release reservation: %w", err)
	}

	return nil
}

// CommitTokensRequest represents token commit request
type CommitTokensRequest struct {
	TxID   string `json:"txId"`
	Amount int    `json:"amount"`
	TaskID string `json:"taskId"`
	Source string `json:"source"`
}

// CommitTokensResponse represents token commit response
type CommitTokensResponse struct {
	TxID   string `json:"txId"`
	UserID string `json:"userId"`
	Amount int    `json:"amount"`
	Status string `json:"status"`
}

// CommitTokens commits reserved tokens after task completion
func (c *BillingClient) CommitTokens(ctx context.Context, authToken string, req *CommitTokensRequest, idempotencyKey string) (*CommitTokensResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var commitResp CommitTokensResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodPost,
		Path:   "/api/v1/tokens/commit",
		Body:   req,
		Headers: map[string]string{
			"Authorization":   authToken,
			"Idempotency-Key": idempotencyKey,
		},
	}, &commitResp)

	if err != nil {
		return nil, fmt.Errorf("failed to commit tokens: %w", err)
	}

	return &commitResp, nil
}

// ReleaseTokensRequest represents token release request
type ReleaseTokensRequest struct {
	TxID   string `json:"txId"`
	Amount int    `json:"amount"`
	TaskID string `json:"taskId"`
}

// ReleaseTokensResponse represents token release response
type ReleaseTokensResponse struct {
	TxID   string `json:"txId"`
	UserID string `json:"userId"`
	Amount int    `json:"amount"`
	Status string `json:"status"`
}

// ReleaseTokens releases reserved tokens when task fails
func (c *BillingClient) ReleaseTokens(ctx context.Context, authToken string, req *ReleaseTokensRequest, idempotencyKey string) (*ReleaseTokensResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var releaseResp ReleaseTokensResponse
	err := c.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodPost,
		Path:   "/api/v1/tokens/release",
		Body:   req,
		Headers: map[string]string{
			"Authorization":   authToken,
			"Idempotency-Key": idempotencyKey,
		},
	}, &releaseResp)

	if err != nil {
		return nil, fmt.Errorf("failed to release tokens: %w", err)
	}

	return &releaseResp, nil
}
