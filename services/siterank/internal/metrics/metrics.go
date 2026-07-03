package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// Evaluation metrics
	EvaluationRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_evaluation_requests_total",
			Help: "Total number of evaluation requests",
		},
		[]string{"type", "status"},
	)

	EvaluationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "siterank_evaluation_duration_seconds",
			Help:    "Duration of evaluation processing",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"type", "stage"},
	)

	TokensConsumed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_tokens_consumed_total",
			Help: "Total tokens consumed by evaluations",
		},
		[]string{"type"},
	)

	// AI evaluation metrics
	AIEvaluationScore = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "siterank_ai_recommendation_score",
			Help:    "AI recommendation scores distribution",
			Buckets: []float64{0, 20, 40, 60, 80, 100},
		},
		[]string{},
	)

	GeminiAPILatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_gemini_api_latency_seconds",
			Help:    "Gemini API call latency",
			Buckets: []float64{0.5, 1, 2, 5, 10, 30},
		},
	)

	GeminiAPIErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_gemini_api_errors_total",
			Help: "Total Gemini API errors",
		},
		[]string{"error_type"},
	)

	// Gemini API token usage and cost metrics
	GeminiInputTokens = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_gemini_input_tokens",
			Help:    "Gemini API input tokens per request",
			Buckets: []float64{100, 500, 1000, 2000, 5000, 10000},
		},
	)

	GeminiOutputTokens = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_gemini_output_tokens",
			Help:    "Gemini API output tokens per request",
			Buckets: []float64{100, 500, 1000, 2000, 5000},
		},
	)

	GeminiAPICost = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_gemini_api_cost_usd",
			Help:    "Gemini API cost per request in USD",
			Buckets: []float64{0.0001, 0.001, 0.01, 0.05, 0.1, 0.5},
		},
	)

	// SimilarWeb metrics
	SimilarWebCacheHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_similarweb_cache_hits_total",
			Help: "Total SimilarWeb cache hits",
		},
		[]string{"hit"},
	)

	SimilarWebAPILatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_similarweb_api_latency_seconds",
			Help:    "SimilarWeb API call latency",
			Buckets: []float64{0.1, 0.5, 1, 2, 5},
		},
	)

	// Browser-exec metrics
	BrowserExecLatency = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "siterank_browser_exec_latency_seconds",
			Help:    "Browser-exec service latency",
			Buckets: []float64{5, 10, 20, 30, 60},
		},
	)

	BrowserExecErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_browser_exec_errors_total",
			Help: "Total browser-exec errors",
		},
		[]string{"error_type"},
	)

	// Billing integration metrics
	TokenReserveSuccess = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "siterank_token_reserve_success_total",
			Help: "Total successful token reservations",
		},
	)

	TokenReserveFailed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_token_reserve_failed_total",
			Help: "Total failed token reservations",
		},
		[]string{"reason"},
	)

	TokenCommitSuccess = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "siterank_token_commit_success_total",
			Help: "Total successful token commits",
		},
	)

	TokenReleaseSuccess = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "siterank_token_release_success_total",
			Help: "Total successful token releases (refunds)",
		},
	)

	// Pub/Sub metrics
	PubSubMessagesReceived = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_pubsub_messages_received_total",
			Help: "Total Pub/Sub messages received",
		},
		[]string{"event_type"},
	)

	PubSubMessagesProcessed = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_pubsub_messages_processed_total",
			Help: "Total Pub/Sub messages processed",
		},
		[]string{"event_type", "status"},
	)

	PubSubProcessingDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "siterank_pubsub_processing_duration_seconds",
			Help:    "Pub/Sub message processing duration",
			Buckets: []float64{1, 5, 10, 30, 60, 120},
		},
		[]string{"event_type"},
	)

	// Evaluation history metrics
	EvaluationHistoryRequests = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "siterank_evaluation_history_requests_total",
			Help: "Total number of evaluation history requests",
		},
		[]string{"status"},
	)
)
