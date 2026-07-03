package clients

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
)

// OfferClient is a client for the Offer service using serviceclient
type OfferClient struct {
	registry *serviceclient.Registry
}

// NewOfferClient creates a new Offer service client using serviceclient
func NewOfferClient(registry *serviceclient.Registry) *OfferClient {
	return &OfferClient{
		registry: registry,
	}
}

// Offer represents an offer from the Offer service
type Offer struct {
	ID         string                 `json:"id"`
	UserID     string                 `json:"userId"`
	Name       string                 `json:"name"`
	Status     string                 `json:"status"`
	LandingURL string                 `json:"landingUrl"`
	CreatedAt  time.Time              `json:"createdAt"`
	UpdatedAt  time.Time              `json:"updatedAt"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// ListOffersRequest represents the request for listing offers
type ListOffersRequest struct {
	UserID string
	Status string
	Limit  int
	Offset int
}

// ListOffersResponse represents the response from listing offers
type ListOffersResponse struct {
	Items      []Offer `json:"items"`
	TotalCount int     `json:"totalCount"`
}

// ListOffers retrieves offers for a user
func (c *OfferClient) ListOffers(ctx context.Context, req ListOffersRequest) (*ListOffersResponse, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	path := fmt.Sprintf("/api/v1/offers?userId=%s", req.UserID)
	if req.Status != "" {
		path += fmt.Sprintf("&status=%s", req.Status)
	}
	if req.Limit > 0 {
		path += fmt.Sprintf("&limit=%d", req.Limit)
	}
	if req.Offset > 0 {
		path += fmt.Sprintf("&offset=%d", req.Offset)
	}

	var resp ListOffersResponse
	err := c.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodGet,
		Path:   path,
	}, &resp)

	if err != nil {
		return nil, fmt.Errorf("failed to list offers: %w", err)
	}

	return &resp, nil
}

// GetOffer retrieves a single offer by ID
func (c *OfferClient) GetOffer(ctx context.Context, offerID string) (*Offer, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var offer Offer
	err := c.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/offers/%s", offerID),
	}, &offer)

	if err != nil {
		return nil, fmt.Errorf("failed to get offer: %w", err)
	}

	return &offer, nil
}

// OfferKPI represents KPI metrics for an offer
type OfferKPI struct {
	OfferID        string    `json:"offerId"`
	Impressions    int64     `json:"impressions"`
	Clicks         int64     `json:"clicks"`
	Conversions    int64     `json:"conversions"`
	Revenue        float64   `json:"revenue"`
	CTR            float64   `json:"ctr"`
	ConversionRate float64   `json:"conversionRate"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// GetOfferKPI retrieves KPI metrics for an offer
func (c *OfferClient) GetOfferKPI(ctx context.Context, offerID string) (*OfferKPI, error) {
	if c.registry == nil {
		return nil, fmt.Errorf("service registry not initialized")
	}

	var kpi OfferKPI
	err := c.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/offers/%s/kpi", offerID),
	}, &kpi)

	if err != nil {
		return nil, fmt.Errorf("failed to get offer KPI: %w", err)
	}

	return &kpi, nil
}

// UpdateOfferStatusRequest represents a request to update offer status
type UpdateOfferStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

// UpdateOfferStatus updates the status of an offer
func (c *OfferClient) UpdateOfferStatus(ctx context.Context, offerID string, req UpdateOfferStatusRequest) error {
	if c.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	err := c.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodPatch,
		Path:   fmt.Sprintf("/api/v1/offers/%s/status", offerID),
		Body:   req,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to update offer status: %w", err)
	}

	return nil
}

// Health checks the health of the Offer service
func (c *OfferClient) Health(ctx context.Context) error {
	if c.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	err := c.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodGet,
		Path:   "/health",
	}, &struct{}{})

	if err != nil {
		return fmt.Errorf("offer service unhealthy: %w", err)
	}

	return nil
}
