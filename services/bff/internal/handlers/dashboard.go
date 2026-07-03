package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/redis/go-redis/v9"
)

// DashboardHandler handles dashboard aggregation requests
type DashboardHandler struct {
	registry    *serviceclient.Registry
	redisClient *redis.Client
}

// NewDashboardHandler creates a new dashboard handler
func NewDashboardHandler(registry *serviceclient.Registry, redisClient *redis.Client) *DashboardHandler {
	return &DashboardHandler{
		registry:    registry,
		redisClient: redisClient,
	}
}

// DashboardStats represents aggregated dashboard statistics
type DashboardStats struct {
	UserID string `json:"userId"`

	// Offer statistics
	TotalOffers        int `json:"totalOffers"`
	EvaluatedOffers    int `json:"evaluatedOffers"`
	PendingEvaluations int `json:"pendingEvaluations"`

	// AI Evaluation statistics
	AIEvaluationsTotal   int `json:"aiEvaluationsTotal"`
	AIEvaluationsSuccess int `json:"aiEvaluationsSuccess"`
	AIEvaluationsFailed  int `json:"aiEvaluationsFailed"`

	// Token statistics
	TokensTotal     int64 `json:"tokensTotal"`
	TokensConsumed  int64 `json:"tokensConsumed"`
	TokensRemaining int64 `json:"tokensRemaining"`

	// Subscription info
	SubscriptionPlan string     `json:"subscriptionPlan"`
	SubscriptionEnd  *time.Time `json:"subscriptionEnd,omitempty"`

	// Ads account statistics
	AdsAccounts *AdsAccountStats `json:"adsAccounts,omitempty"`

	// Checkin & Referral statistics
	CheckinStreak       int `json:"checkinStreak"`
	TotalCheckins       int `json:"totalCheckins"`
	TotalReferrals      int `json:"totalReferrals"`
	SuccessfulReferrals int `json:"successfulReferrals"`

	// Recent activity
	RecentEvaluations []RecentEvaluation `json:"recentEvaluations"`

	LastUpdated time.Time `json:"lastUpdated"`
}

// AdsAccountStats represents Ads account statistics
type AdsAccountStats struct {
	TotalAccounts        int     `json:"totalAccounts"`
	ActiveAccounts       int     `json:"activeAccounts"`
	PendingAuthorization int     `json:"pendingAuthorization"`
	OffersCoverage       float64 `json:"offersCoverage"` // percentage
}

// RecentEvaluation represents a recent evaluation record
type RecentEvaluation struct {
	ID             string     `json:"id"`
	OfferID        string     `json:"offerId"`
	Type           string     `json:"type"` // "ai" or "basic"
	Status         string     `json:"status"`
	TokensConsumed int        `json:"tokensConsumed"`
	BrandName      *string    `json:"brandName,omitempty"`
	Domain         *string    `json:"domain,omitempty"`
	AIScore        *int       `json:"aiScore,omitempty"`
	CompletedAt    *time.Time `json:"completedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

// GetDashboardStats handles GET /api/v1/dashboard/stats
// BE-069: Aggregates data from multiple services with Redis caching
func (h *DashboardHandler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get user ID from context (set by auth middleware)
	userID, ok := getUserIDFromContext(ctx)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check cache first (5-minute TTL)
	cacheKey := fmt.Sprintf("dashboard:stats:%s", userID)
	if h.redisClient != nil {
		if cached, err := h.redisClient.Get(ctx, cacheKey).Result(); err == nil {
			var stats DashboardStats
			if json.Unmarshal([]byte(cached), &stats) == nil {
				log.Printf("Dashboard cache hit for user %s", userID)
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache-Status", "HIT")
				w.WriteHeader(http.StatusOK)
				json.NewEncoder(w).Encode(stats)
				return
			}
		}
	}

	// Cache miss - aggregate from services
	log.Printf("Dashboard cache miss for user %s, aggregating from services", userID)

	stats := &DashboardStats{
		UserID:            userID,
		RecentEvaluations: []RecentEvaluation{},
		LastUpdated:       time.Now(),
	}

	// Get Authorization header for service calls
	authHeader, _ := getAuthHeaderFromContext(ctx)

	// Concurrent service calls with error handling
	var wg sync.WaitGroup
	var mu sync.Mutex
	errors := make(map[string]error)

	// 1. Get Offer statistics
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := h.getOfferStats(ctx, userID, authHeader, stats, &mu); err != nil {
			errors["offer"] = err
			log.Printf("Failed to get offer stats: %v", err)
		}
	}()

	// 2. Get Evaluation statistics
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := h.getEvaluationStats(ctx, userID, authHeader, stats, &mu); err != nil {
			errors["evaluation"] = err
			log.Printf("Failed to get evaluation stats: %v", err)
		}
	}()

	// 3. Get Token & Subscription info
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := h.getBillingStats(ctx, userID, authHeader, stats, &mu); err != nil {
			errors["billing"] = err
			log.Printf("Failed to get billing stats: %v", err)
		}
	}()

	// 4. Get Ads account statistics
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := h.getAdsAccountStats(ctx, userID, authHeader, stats, &mu); err != nil {
			errors["adscenter"] = err
			log.Printf("Failed to get ads account stats: %v", err)
		}
	}()

	// 5. Get Checkin & Referral statistics
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := h.getUserActivityStats(ctx, userID, authHeader, stats, &mu); err != nil {
			errors["useractivity"] = err
			log.Printf("Failed to get user activity stats: %v", err)
		}
	}()

	wg.Wait()

	// Partial failure tolerance: return data even if some services fail
	log.Printf("Dashboard aggregation completed for user %s, errors: %d/%d", userID, len(errors), 5)

	// Cache the result (5 minutes)
	if h.redisClient != nil && len(errors) < 3 { // Only cache if majority of services succeeded
		if data, err := json.Marshal(stats); err == nil {
			h.redisClient.Set(ctx, cacheKey, data, 5*time.Minute)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache-Status", "MISS")
	if len(errors) > 0 {
		w.Header().Set("X-Partial-Errors", fmt.Sprintf("%d", len(errors)))
	}
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(stats)
}

// Service aggregation methods

func (h *DashboardHandler) getOfferStats(ctx context.Context, userID, authHeader string, stats *DashboardStats, mu *sync.Mutex) error {
	if h.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	var result struct {
		Total int `json:"total"`
	}

	err := h.registry.CallJSON(ctx, "offer", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/offers?userId=%s&limit=1", userID),
		Headers: map[string]string{
			"Authorization": authHeader,
		},
	}, &result)

	if err != nil {
		return fmt.Errorf("offer service failed: %w", err)
	}

	mu.Lock()
	stats.TotalOffers = result.Total
	mu.Unlock()

	return nil
}

func (h *DashboardHandler) getEvaluationStats(ctx context.Context, userID, authHeader string, stats *DashboardStats, mu *sync.Mutex) error {
	if h.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	var result struct {
		Total int                `json:"total"`
		Items []RecentEvaluation `json:"items"`
	}

	err := h.registry.CallJSON(ctx, "siterank", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/evaluations?userId=%s&limit=5", userID),
		Headers: map[string]string{
			"Authorization": authHeader,
		},
	}, &result)

	if err != nil {
		return fmt.Errorf("siterank service failed: %w", err)
	}

	mu.Lock()
	stats.EvaluatedOffers = result.Total
	stats.RecentEvaluations = result.Items
	mu.Unlock()

	return nil
}

func (h *DashboardHandler) getBillingStats(ctx context.Context, userID, authHeader string, stats *DashboardStats, mu *sync.Mutex) error {
	if h.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	var result struct {
		TokensTotal     int64  `json:"tokensTotal"`
		TokensRemaining int64  `json:"tokensRemaining"`
		Plan            string `json:"plan"`
	}

	err := h.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/billing/balance?userId=%s", userID),
		Headers: map[string]string{
			"Authorization": authHeader,
		},
	}, &result)

	if err != nil {
		return fmt.Errorf("billing service failed: %w", err)
	}

	mu.Lock()
	stats.TokensTotal = result.TokensTotal
	stats.TokensRemaining = result.TokensRemaining
	stats.TokensConsumed = result.TokensTotal - result.TokensRemaining
	stats.SubscriptionPlan = result.Plan
	mu.Unlock()

	return nil
}

func (h *DashboardHandler) getAdsAccountStats(ctx context.Context, userID, authHeader string, stats *DashboardStats, mu *sync.Mutex) error {
	if h.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	var result struct {
		Total       int `json:"total"`
		Active      int `json:"active"`
		PendingAuth int `json:"pendingAuth"`
	}

	err := h.registry.CallJSON(ctx, "adscenter", serviceclient.Request{
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/v1/ads/accounts?userId=%s&stats=true", userID),
		Headers: map[string]string{
			"Authorization": authHeader,
		},
	}, &result)

	if err != nil {
		return fmt.Errorf("adscenter service failed: %w", err)
	}

	mu.Lock()
	stats.AdsAccounts = &AdsAccountStats{
		TotalAccounts:        result.Total,
		ActiveAccounts:       result.Active,
		PendingAuthorization: result.PendingAuth,
	}
	mu.Unlock()

	return nil
}

func (h *DashboardHandler) getUserActivityStats(ctx context.Context, userID, authHeader string, stats *DashboardStats, mu *sync.Mutex) error {
	if h.registry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	headers := map[string]string{
		"Authorization": authHeader,
	}

	// Get checkin stats
	var checkinResult struct {
		CurrentStreak int `json:"currentStreak"`
		TotalCheckins int `json:"totalCheckins"`
	}

	err := h.registry.CallJSON(ctx, "useractivity", serviceclient.Request{
		Method:  http.MethodGet,
		Path:    "/api/v1/check-in/status",
		Headers: headers,
	}, &checkinResult)

	if err == nil {
		mu.Lock()
		stats.CheckinStreak = checkinResult.CurrentStreak
		stats.TotalCheckins = checkinResult.TotalCheckins
		mu.Unlock()
	}

	// Get referral stats
	var referralResult struct {
		TotalReferrals      int `json:"totalReferrals"`
		SuccessfulReferrals int `json:"successfulReferrals"`
	}

	err2 := h.registry.CallJSON(ctx, "useractivity", serviceclient.Request{
		Method:  http.MethodGet,
		Path:    "/api/v1/referral",
		Headers: headers,
	}, &referralResult)

	if err2 == nil {
		mu.Lock()
		stats.TotalReferrals = referralResult.TotalReferrals
		stats.SuccessfulReferrals = referralResult.SuccessfulReferrals
		mu.Unlock()
	}

	// Return error only if both calls failed
	if err != nil && err2 != nil {
		return fmt.Errorf("useractivity service failed: checkin=%v, referral=%v", err, err2)
	}

	return nil
}

// Helper functions

func getUserIDFromContext(ctx context.Context) (string, bool) {
	// AuthMiddleware sets user_id in context
	userID, ok := ctx.Value("user_id").(string)
	if !ok || userID == "" {
		return "", false
	}
	return userID, true
}

func getAuthHeaderFromContext(ctx context.Context) (string, bool) {
	// Get Authorization header from request
	// AuthMiddleware should preserve the original header
	authHeader, ok := ctx.Value("authorization").(string)
	if !ok || authHeader == "" {
		return "", false
	}
	return authHeader, true
}
