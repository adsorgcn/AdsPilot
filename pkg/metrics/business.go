package metrics

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	// Global business metrics instance (singleton)
	globalBusinessMetrics *Metrics
	globalBusinessOnce    sync.Once
)

// GetGlobalBusinessMetrics returns the global business metrics instance
// This allows services to record business metrics without managing their own instance
func GetGlobalBusinessMetrics() *Metrics {
	globalBusinessOnce.Do(func() {
		globalBusinessMetrics = New(Config{
			ServiceName: "business",
			Namespace:   "gm",
		})
		// Setup all business metrics
		globalBusinessMetrics.SetupBillingMetrics()
		globalBusinessMetrics.SetupOfferMetrics()
		globalBusinessMetrics.SetupAdMetrics()
	})
	return globalBusinessMetrics
}

// Business metric names (constants for consistency)
const (
	// Billing metrics
	MetricTokensConsumed    = "tokens_consumed_total"
	MetricTokensReserved    = "tokens_reserved_total"
	MetricTokensCommitted   = "tokens_committed_total"
	MetricTokensRefunded    = "tokens_refunded_total"
	MetricActiveSubscribers = "active_subscribers"

	// Offer metrics
	MetricOffersCreated   = "offers_created_total"
	MetricOffersCompleted = "offers_completed_total"
	MetricOffersFailed    = "offers_failed_total"
	MetricOfferConversion = "offer_conversion_rate"
	MetricOfferValue      = "offer_value_total"

	// Ad metrics
	MetricAdsCreated    = "ads_created_total"
	MetricAdsActive     = "ads_active"
	MetricAdImpressions = "ad_impressions_total"
	MetricAdClicks      = "ad_clicks_total"
	MetricAdConversions = "ad_conversions_total"
	MetricAdSpend       = "ad_spend_total"
)

// SetupBillingMetrics registers billing-specific business metrics
func (m *Metrics) SetupBillingMetrics() {
	// Token consumption counter
	m.RegisterCounter(
		MetricTokensConsumed,
		"Total number of tokens consumed",
		[]string{"user_id", "operation"},
		"gm",
		"billing",
	)

	// Token reservation counter
	m.RegisterCounter(
		MetricTokensReserved,
		"Total number of tokens reserved",
		[]string{"user_id"},
		"gm",
		"billing",
	)

	// Token commit counter
	m.RegisterCounter(
		MetricTokensCommitted,
		"Total number of tokens committed",
		[]string{"user_id", "operation"},
		"gm",
		"billing",
	)

	// Token refund counter
	m.RegisterCounter(
		MetricTokensRefunded,
		"Total number of tokens refunded",
		[]string{"user_id", "reason"},
		"gm",
		"billing",
	)

	// Active subscribers gauge
	m.RegisterGauge(
		MetricActiveSubscribers,
		"Number of active subscribers",
		[]string{"plan"},
		"gm",
		"billing",
	)
}

// SetupOfferMetrics registers offer-specific business metrics
func (m *Metrics) SetupOfferMetrics() {
	// Offers created counter
	m.RegisterCounter(
		MetricOffersCreated,
		"Total number of offers created",
		[]string{"user_id", "type"},
		"gm",
		"offer",
	)

	// Offers completed counter
	m.RegisterCounter(
		MetricOffersCompleted,
		"Total number of offers completed",
		[]string{"user_id", "type"},
		"gm",
		"offer",
	)

	// Offers failed counter
	m.RegisterCounter(
		MetricOffersFailed,
		"Total number of offers failed",
		[]string{"user_id", "type", "reason"},
		"gm",
		"offer",
	)

	// Offer conversion gauge (ratio)
	m.RegisterGauge(
		MetricOfferConversion,
		"Offer conversion rate (completed/created)",
		[]string{"type"},
		"gm",
		"offer",
	)

	// Offer value counter
	m.RegisterCounter(
		MetricOfferValue,
		"Total value of offers (in cents)",
		[]string{"user_id", "type"},
		"gm",
		"offer",
	)
}

// SetupAdMetrics registers ad-specific business metrics
func (m *Metrics) SetupAdMetrics() {
	// Ads created counter
	m.RegisterCounter(
		MetricAdsCreated,
		"Total number of ads created",
		[]string{"user_id", "campaign_id", "platform"},
		"gm",
		"adscenter",
	)

	// Active ads gauge
	m.RegisterGauge(
		MetricAdsActive,
		"Number of currently active ads",
		[]string{"user_id", "platform"},
		"gm",
		"adscenter",
	)

	// Ad impressions counter
	m.RegisterCounter(
		MetricAdImpressions,
		"Total number of ad impressions",
		[]string{"user_id", "campaign_id", "platform"},
		"gm",
		"adscenter",
	)

	// Ad clicks counter
	m.RegisterCounter(
		MetricAdClicks,
		"Total number of ad clicks",
		[]string{"user_id", "campaign_id", "platform"},
		"gm",
		"adscenter",
	)

	// Ad conversions counter
	m.RegisterCounter(
		MetricAdConversions,
		"Total number of ad conversions",
		[]string{"user_id", "campaign_id", "platform"},
		"gm",
		"adscenter",
	)

	// Ad spend counter
	m.RegisterCounter(
		MetricAdSpend,
		"Total ad spend (in cents)",
		[]string{"user_id", "campaign_id", "platform"},
		"gm",
		"adscenter",
	)
}

// RecordTokenConsumption records token consumption
func (m *Metrics) RecordTokenConsumption(userID, operation string, amount float64) {
	m.AddCounter(MetricTokensConsumed, amount, prometheus.Labels{
		"user_id":   userID,
		"operation": operation,
	})
}

// RecordTokenReservation records token reservation
func (m *Metrics) RecordTokenReservation(userID string, amount float64) {
	m.AddCounter(MetricTokensReserved, amount, prometheus.Labels{
		"user_id": userID,
	})
}

// RecordOfferCreated records offer creation
func (m *Metrics) RecordOfferCreated(userID, offerType string) {
	m.IncrementCounter(MetricOffersCreated, prometheus.Labels{
		"user_id": userID,
		"type":    offerType,
	})
}

// RecordOfferCompleted records offer completion
func (m *Metrics) RecordOfferCompleted(userID, offerType string) {
	m.IncrementCounter(MetricOffersCompleted, prometheus.Labels{
		"user_id": userID,
		"type":    offerType,
	})
}

// RecordAdImpression records ad impression
func (m *Metrics) RecordAdImpression(userID, campaignID, platform string) {
	m.IncrementCounter(MetricAdImpressions, prometheus.Labels{
		"user_id":     userID,
		"campaign_id": campaignID,
		"platform":    platform,
	})
}

// RecordAdClick records ad click
func (m *Metrics) RecordAdClick(userID, campaignID, platform string) {
	m.IncrementCounter(MetricAdClicks, prometheus.Labels{
		"user_id":     userID,
		"campaign_id": campaignID,
		"platform":    platform,
	})
}
