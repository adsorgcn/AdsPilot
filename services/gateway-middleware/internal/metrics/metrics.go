package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Prometheus metrics for Gateway Middleware
var (
	// Request metrics
	RequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_requests_total",
			Help: "Total number of requests processed by the gateway",
		},
		[]string{"method", "path", "status", "backend"},
	)

	RequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_request_duration_seconds",
			Help:    "Duration of gateway request processing",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"method", "path", "backend"},
	)

	// JWT validation metrics
	JWTValidationTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_jwt_validation_total",
			Help: "Total number of JWT validation attempts",
		},
		[]string{"result"}, // success, failure
	)

	JWTValidationDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "gateway_jwt_validation_duration_seconds",
			Help:    "Duration of JWT validation",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.0025, 0.005, 0.01},
		},
	)

	// Subscription query metrics
	SubscriptionQueriesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_subscription_queries_total",
			Help: "Total number of subscription queries",
		},
		[]string{"result"}, // cache_hit, cache_miss, error
	)

	SubscriptionQueryDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "gateway_subscription_query_duration_seconds",
			Help:    "Duration of subscription queries",
			Buckets: []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25},
		},
	)

	// Permission check metrics
	PermissionChecksTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_permission_checks_total",
			Help: "Total number of permission checks",
		},
		[]string{"result"}, // allowed, denied, error
	)

	PermissionCheckDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "gateway_permission_check_duration_seconds",
			Help:    "Duration of permission checks",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.0025, 0.005, 0.01},
		},
	)

	// Token reservation metrics
	TokenReservationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_token_reservations_total",
			Help: "Total number of token reservations",
		},
		[]string{"result"}, // success, insufficient, error
	)

	TokenReservationDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "gateway_token_reservation_duration_seconds",
			Help:    "Duration of token reservations",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5},
		},
	)

	// Cache metrics
	CacheOperationsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_cache_operations_total",
			Help: "Total number of cache operations",
		},
		[]string{"operation", "result"}, // operation: get/set, result: hit/miss/error
	)

	CacheOperationDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_cache_operation_duration_seconds",
			Help:    "Duration of cache operations",
			Buckets: []float64{0.0001, 0.0005, 0.001, 0.0025, 0.005, 0.01},
		},
		[]string{"operation"}, // get, set, delete
	)

	// Backend proxy metrics
	BackendRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_backend_requests_total",
			Help: "Total number of requests proxied to backends",
		},
		[]string{"backend", "method", "status"},
	)

	BackendRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "gateway_backend_request_duration_seconds",
			Help:    "Duration of backend requests",
			Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"backend", "method"},
	)

	BackendErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_backend_errors_total",
			Help: "Total number of backend errors",
		},
		[]string{"backend", "error_type"},
	)

	// Rate limiting metrics
	RateLimitExceededTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_rate_limit_exceeded_total",
			Help: "Total number of rate limit exceeded events",
		},
		[]string{"user_id", "tier"},
	)

	// Token commit/release metrics (internal API)
	TokenCommitsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_token_commits_total",
			Help: "Total number of token commit operations",
		},
		[]string{"result"}, // success, error
	)

	TokenReleasesTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gateway_token_releases_total",
			Help: "Total number of token release operations",
		},
		[]string{"result"}, // success, error
	)
)
