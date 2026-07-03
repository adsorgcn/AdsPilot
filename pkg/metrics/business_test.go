package metrics

import (
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
)

func TestSetupBillingMetrics(t *testing.T) {
	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	m.SetupBillingMetrics()

	// Verify all billing metrics are registered
	assert.Contains(t, m.BusinessCounters, MetricTokensConsumed)
	assert.Contains(t, m.BusinessCounters, MetricTokensReserved)
	assert.Contains(t, m.BusinessCounters, MetricTokensCommitted)
	assert.Contains(t, m.BusinessCounters, MetricTokensRefunded)
	assert.Contains(t, m.BusinessGauges, MetricActiveSubscribers)
}

func TestSetupOfferMetrics(t *testing.T) {
	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	m.SetupOfferMetrics()

	// Verify all offer metrics are registered
	assert.Contains(t, m.BusinessCounters, MetricOffersCreated)
	assert.Contains(t, m.BusinessCounters, MetricOffersCompleted)
	assert.Contains(t, m.BusinessCounters, MetricOffersFailed)
	assert.Contains(t, m.BusinessGauges, MetricOfferConversion)
	assert.Contains(t, m.BusinessCounters, MetricOfferValue)
}

func TestSetupAdMetrics(t *testing.T) {
	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	m.SetupAdMetrics()

	// Verify all ad metrics are registered
	assert.Contains(t, m.BusinessCounters, MetricAdsCreated)
	assert.Contains(t, m.BusinessGauges, MetricAdsActive)
	assert.Contains(t, m.BusinessCounters, MetricAdImpressions)
	assert.Contains(t, m.BusinessCounters, MetricAdClicks)
	assert.Contains(t, m.BusinessCounters, MetricAdConversions)
	assert.Contains(t, m.BusinessCounters, MetricAdSpend)
}

func TestRecordTokenConsumption(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	// Setup billing metrics
	m.BusinessCounters[MetricTokensConsumed] = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_tokens_consumed_total",
		},
		[]string{"user_id", "operation"},
	)
	reg.MustRegister(m.BusinessCounters[MetricTokensConsumed])

	// Record consumption
	m.RecordTokenConsumption("user123", "offer_creation", 100)
	m.RecordTokenConsumption("user123", "offer_creation", 50)

	// Verify
	count := testutil.ToFloat64(m.BusinessCounters[MetricTokensConsumed].WithLabelValues("user123", "offer_creation"))
	assert.Equal(t, 150.0, count)
}

func TestRecordOfferCreated(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	// Setup offer metrics
	m.BusinessCounters[MetricOffersCreated] = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_offers_created_total",
		},
		[]string{"user_id", "type"},
	)
	reg.MustRegister(m.BusinessCounters[MetricOffersCreated])

	// Record offers
	m.RecordOfferCreated("user456", "affiliate")
	m.RecordOfferCreated("user456", "affiliate")
	m.RecordOfferCreated("user456", "cpa")

	// Verify
	affiliateCount := testutil.ToFloat64(m.BusinessCounters[MetricOffersCreated].WithLabelValues("user456", "affiliate"))
	assert.Equal(t, 2.0, affiliateCount)

	cpaCount := testutil.ToFloat64(m.BusinessCounters[MetricOffersCreated].WithLabelValues("user456", "cpa"))
	assert.Equal(t, 1.0, cpaCount)
}

func TestRecordAdImpression(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	// Setup ad metrics
	m.BusinessCounters[MetricAdImpressions] = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_ad_impressions_total",
		},
		[]string{"user_id", "campaign_id", "platform"},
	)
	reg.MustRegister(m.BusinessCounters[MetricAdImpressions])

	// Record impressions
	m.RecordAdImpression("user789", "campaign123", "google")
	m.RecordAdImpression("user789", "campaign123", "google")
	m.RecordAdImpression("user789", "campaign123", "facebook")

	// Verify
	googleCount := testutil.ToFloat64(m.BusinessCounters[MetricAdImpressions].WithLabelValues("user789", "campaign123", "google"))
	assert.Equal(t, 2.0, googleCount)

	facebookCount := testutil.ToFloat64(m.BusinessCounters[MetricAdImpressions].WithLabelValues("user789", "campaign123", "facebook"))
	assert.Equal(t, 1.0, facebookCount)
}

func TestIncrementCounter(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	// Register a test counter
	m.BusinessCounters["test_counter"] = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_counter_total",
		},
		[]string{"label1"},
	)
	reg.MustRegister(m.BusinessCounters["test_counter"])

	// Increment
	m.IncrementCounter("test_counter", prometheus.Labels{"label1": "value1"})
	m.IncrementCounter("test_counter", prometheus.Labels{"label1": "value1"})

	// Verify
	count := testutil.ToFloat64(m.BusinessCounters["test_counter"].WithLabelValues("value1"))
	assert.Equal(t, 2.0, count)
}

func TestSetGauge(t *testing.T) {
	reg := prometheus.NewRegistry()

	m := &Metrics{
		BusinessCounters: make(map[string]*prometheus.CounterVec),
		BusinessGauges:   make(map[string]*prometheus.GaugeVec),
	}

	// Register a test gauge
	m.BusinessGauges["test_gauge"] = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "test_gauge",
		},
		[]string{"label1"},
	)
	reg.MustRegister(m.BusinessGauges["test_gauge"])

	// Set gauge
	m.SetGauge("test_gauge", 42.5, prometheus.Labels{"label1": "value1"})

	// Verify
	value := testutil.ToFloat64(m.BusinessGauges["test_gauge"].WithLabelValues("value1"))
	assert.Equal(t, 42.5, value)
}
