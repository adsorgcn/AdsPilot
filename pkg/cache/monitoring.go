// Package cache provides comprehensive monitoring for cache systems
package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"sync"
	"time"
)

// Monitor provides comprehensive cache monitoring
type Monitor struct {
	cache        CacheService
	logger       Logger
	config       MonitoringConfig
	metrics      *MetricsCollector
	alertManager *AlertManager
	dashboard    *Dashboard
	stopCh       chan struct{}
	wg           sync.WaitGroup
}

// MonitoringConfig holds monitoring configuration
type MonitoringConfig struct {
	Enabled          bool            `json:"enabled"`
	Interval         time.Duration   `json:"interval"`
	Retention        time.Duration   `json:"retention"`
	ExportFormat     string          `json:"export_format"`
	ExportTargets    []string        `json:"export_targets"`
	AlertThresholds  AlertThresholds `json:"alert_thresholds"`
	DashboardEnabled bool            `json:"dashboard_enabled"`
	DashboardPort    int             `json:"dashboard_port"`
	ProfilingEnabled bool            `json:"profiling_enabled"`
	TracingEnabled   bool            `json:"tracing_enabled"`
}

// AlertThresholds defines alerting thresholds
type AlertThresholds struct {
	HitRateMin        float64       `json:"hit_rate_min"`
	MemoryUsageMax    float64       `json:"memory_usage_max"`
	ResponseTimeMax   time.Duration `json:"response_time_max"`
	ErrorRateMax      float64       `json:"error_rate_max"`
	ConnectionPoolMin int           `json:"connection_pool_min"`
	EvictionRateMax   float64       `json:"eviction_rate_max"`
}

// NewMonitor creates a new cache monitor
func NewMonitor(cache CacheService, config MonitoringConfig, logger Logger) *Monitor {
	return &Monitor{
		cache:        cache,
		logger:       logger,
		config:       config,
		metrics:      NewMetricsCollector(config.Retention),
		alertManager: NewAlertManager(config.AlertThresholds, logger),
		dashboard:    NewDashboard(config.DashboardPort, logger),
		stopCh:       make(chan struct{}),
	}
}

// Start starts the monitoring system
func (m *Monitor) Start(ctx context.Context) error {
	if !m.config.Enabled {
		m.logger.Info("Cache monitoring disabled")
		return nil
	}

	m.logger.Info("Starting cache monitoring", "interval", m.config.Interval)

	// Start metrics collection
	m.wg.Add(1)
	go m.metricsCollector(ctx)

	// Start alert manager
	m.wg.Add(1)
	go m.alertManager.Start(ctx, m.metrics)

	// Start dashboard if enabled
	if m.config.DashboardEnabled {
		m.wg.Add(1)
		go m.dashboard.Start(ctx, m.metrics)
	}

	m.logger.Info("Cache monitoring started")
	return nil
}

// Stop stops the monitoring system
func (m *Monitor) Stop() {
	m.logger.Info("Stopping cache monitoring")
	close(m.stopCh)
	m.wg.Wait()
	m.logger.Info("Cache monitoring stopped")
}

// metricsCollector continuously collects cache metrics
func (m *Monitor) metricsCollector(ctx context.Context) {
	defer m.wg.Done()

	ticker := time.NewTicker(m.config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-m.stopCh:
			return
		case <-ticker.C:
			m.collectMetrics(ctx)
		}
	}
}

// collectMetrics collects current cache metrics
func (m *Monitor) collectMetrics(ctx context.Context) {
	start := time.Now()

	// Get cache statistics
	stats, err := m.cache.GetStats(ctx)
	if err != nil {
		m.logger.Error("Failed to collect cache metrics", "error", err)
		return
	}

	// Create metric snapshot
	snapshot := MetricSnapshot{
		Timestamp:     time.Now(),
		HitRate:       stats.HitRate,
		MissRate:      stats.MissRate,
		HitCount:      stats.HitCount,
		MissCount:     stats.MissCount,
		EvictionCount: stats.EvictionCount,
		KeyCount:      stats.KeyCount,
		MemoryUsage:   stats.MemoryUsage,
		Connections:   stats.Connections,
		ResponseTime:  stats.ResponseTime,
		DomainStats:   stats.DomainStats,
	}

	// Store metrics
	m.metrics.AddSnapshot(snapshot)

	// Log performance metrics
	m.logger.Debug("Cache metrics collected",
		"hit_rate", stats.HitRate,
		"memory_usage", stats.MemoryUsage,
		"key_count", stats.KeyCount,
		"collection_time", time.Since(start))

	// Export metrics if configured
	if len(m.config.ExportTargets) > 0 {
		m.exportMetrics(snapshot)
	}
}

// exportMetrics exports metrics to configured targets
func (m *Monitor) exportMetrics(snapshot MetricSnapshot) {
	for _, target := range m.config.ExportTargets {
		switch target {
		case "prometheus":
			m.exportToPrometheus(snapshot)
		case "json":
			m.exportToJSON(snapshot)
		case "log":
			m.exportToLog(snapshot)
		default:
			m.logger.Warn("Unknown export target", "target", target)
		}
	}
}

// exportToPrometheus exports metrics in Prometheus format
func (m *Monitor) exportToPrometheus(snapshot MetricSnapshot) {
	// Prometheus metrics export implementation
	// This would format metrics according to Prometheus exposition format
	metrics := fmt.Sprintf(`
# HELP cache_hit_rate Cache hit rate
# TYPE cache_hit_rate gauge
cache_hit_rate %.4f

# HELP cache_memory_usage_bytes Cache memory usage in bytes
# TYPE cache_memory_usage_bytes gauge
cache_memory_usage_bytes %d

# HELP cache_keys_total Total number of cache keys
# TYPE cache_keys_total gauge
cache_keys_total %d

# HELP cache_operations_total Total cache operations
# TYPE cache_operations_total counter
cache_hits_total %d
cache_misses_total %d
cache_evictions_total %d
`, snapshot.HitRate, snapshot.MemoryUsage, snapshot.KeyCount, snapshot.HitCount, snapshot.MissCount, snapshot.EvictionCount)

	log.Printf("Prometheus Metrics:\n%s", metrics)
}

// exportToJSON exports metrics as JSON
func (m *Monitor) exportToJSON(snapshot MetricSnapshot) {
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		m.logger.Error("Failed to marshal metrics to JSON", "error", err)
		return
	}
	log.Printf("JSON Metrics: %s", string(data))
}

// exportToLog exports metrics as structured logs
func (m *Monitor) exportToLog(snapshot MetricSnapshot) {
	m.logger.Info("Cache metrics",
		"timestamp", snapshot.Timestamp,
		"hit_rate", snapshot.HitRate,
		"memory_usage", snapshot.MemoryUsage,
		"key_count", snapshot.KeyCount,
		"hit_count", snapshot.HitCount,
		"miss_count", snapshot.MissCount)
}

// GetMetrics returns collected metrics
func (m *Monitor) GetMetrics(ctx context.Context) (*MetricsData, error) {
	return m.metrics.GetMetrics(ctx)
}

// GetHealthStatus returns current health status
func (m *Monitor) GetHealthStatus(ctx context.Context) (*HealthStatus, error) {
	stats, err := m.cache.GetStats(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get cache stats: %w", err)
	}

	status := &HealthStatus{
		Status:    "healthy",
		Timestamp: time.Now(),
		Metrics:   stats,
		Checks:    make(map[string]CheckResult),
	}

	// Perform health checks
	status.Checks["cache_health"] = m.performHealthCheck(ctx)
	status.Checks["performance"] = m.performPerformanceCheck(stats)
	status.Checks["memory"] = m.performMemoryCheck(stats)
	status.Checks["connectivity"] = m.performConnectivityCheck(ctx)

	// Determine overall health
	for _, check := range status.Checks {
		if check.Status != "pass" {
			status.Status = "unhealthy"
			break
		}
	}

	return status, nil
}

// performHealthCheck performs basic cache health check
func (m *Monitor) performHealthCheck(ctx context.Context) CheckResult {
	err := m.cache.HealthCheck(ctx)
	if err != nil {
		return CheckResult{
			Status:  "fail",
			Message: fmt.Sprintf("Cache health check failed: %v", err),
		}
	}

	return CheckResult{
		Status:  "pass",
		Message: "Cache is healthy",
	}
}

// performPerformanceCheck performs performance health check
func (m *Monitor) performPerformanceCheck(stats CacheStats) CheckResult {
	if stats.HitRate < m.config.AlertThresholds.HitRateMin {
		return CheckResult{
			Status:  "warn",
			Message: fmt.Sprintf("Low hit rate: %.2f%% (threshold: %.2f%%)", stats.HitRate*100, m.config.AlertThresholds.HitRateMin*100),
		}
	}

	if stats.ResponseTime > m.config.AlertThresholds.ResponseTimeMax {
		return CheckResult{
			Status:  "warn",
			Message: fmt.Sprintf("High response time: %v (threshold: %v)", stats.ResponseTime, m.config.AlertThresholds.ResponseTimeMax),
		}
	}

	return CheckResult{
		Status:  "pass",
		Message: "Performance is acceptable",
	}
}

// performMemoryCheck performs memory health check
func (m *Monitor) performMemoryCheck(stats CacheStats) CheckResult {
	// Memory usage check would need total memory capacity
	// For now, we'll check eviction rate as a proxy
	if stats.EvictionCount > 0 {
		return CheckResult{
			Status:  "warn",
			Message: fmt.Sprintf("Cache evictions detected: %d", stats.EvictionCount),
		}
	}

	return CheckResult{
		Status:  "pass",
		Message: "Memory usage is acceptable",
	}
}

// performConnectivityCheck performs connectivity check
func (m *Monitor) performConnectivityCheck(ctx context.Context) CheckResult {
	// Test basic cache operations
	testKey := fmt.Sprintf("health_check_%d", time.Now().Unix())
	testValue := "test"

	if err := m.cache.Set(ctx, testKey, testValue, time.Minute); err != nil {
		return CheckResult{
			Status:  "fail",
			Message: fmt.Sprintf("Cache set operation failed: %v", err),
		}
	}

	if retrieved, err := m.cache.Get(ctx, testKey); err != nil {
		return CheckResult{
			Status:  "fail",
			Message: fmt.Sprintf("Cache get operation failed: %v", err),
		}
	} else if retrieved != testValue {
		return CheckResult{
			Status:  "fail",
			Message: "Cache data integrity check failed",
		}
	}

	if err := m.cache.Delete(ctx, testKey); err != nil {
		return CheckResult{
			Status:  "warn",
			Message: fmt.Sprintf("Cache delete operation failed: %v", err),
		}
	}

	return CheckResult{
		Status:  "pass",
		Message: "Connectivity check passed",
	}
}

// MetricSnapshot represents a point-in-time metric snapshot
type MetricSnapshot struct {
	Timestamp     time.Time              `json:"timestamp"`
	HitRate       float64                `json:"hit_rate"`
	MissRate      float64                `json:"miss_rate"`
	HitCount      int64                  `json:"hit_count"`
	MissCount     int64                  `json:"miss_count"`
	EvictionCount int64                  `json:"eviction_count"`
	KeyCount      int64                  `json:"key_count"`
	MemoryUsage   int64                  `json:"memory_usage"`
	Connections   int64                  `json:"connections"`
	ResponseTime  time.Duration          `json:"response_time"`
	DomainStats   map[string]DomainStats `json:"domain_stats"`
}

// MetricsCollector collects and stores cache metrics
type MetricsCollector struct {
	snapshots []MetricSnapshot
	maxAge    time.Duration
	mu        sync.RWMutex
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(maxAge time.Duration) *MetricsCollector {
	return &MetricsCollector{
		snapshots: make([]MetricSnapshot, 0),
		maxAge:    maxAge,
	}
}

// AddSnapshot adds a new metric snapshot
func (mc *MetricsCollector) AddSnapshot(snapshot MetricSnapshot) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.snapshots = append(mc.snapshots, snapshot)
	mc.cleanupOldSnapshots()
}

// cleanupOldSnapshots removes snapshots older than maxAge
func (mc *MetricsCollector) cleanupOldSnapshots() {
	cutoff := time.Now().Add(-mc.maxAge)
	filtered := mc.snapshots[:0]

	for _, snapshot := range mc.snapshots {
		if snapshot.Timestamp.After(cutoff) {
			filtered = append(filtered, snapshot)
		}
	}

	mc.snapshots = filtered
}

// GetMetrics returns collected metrics
func (mc *MetricsCollector) GetMetrics(ctx context.Context) (*MetricsData, error) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	if len(mc.snapshots) == 0 {
		return &MetricsData{
			Snapshots: []MetricSnapshot{},
			Summary:   MetricSummary{},
		}, nil
	}

	// Calculate summary statistics
	var totalHitRate, totalMemoryUsage float64
	var totalHitCount, totalMissCount, totalEvictions int64
	var minResponseTime, maxResponseTime time.Duration

	for _, snapshot := range mc.snapshots {
		totalHitRate += snapshot.HitRate
		totalMemoryUsage += float64(snapshot.MemoryUsage)
		totalHitCount += snapshot.HitCount
		totalMissCount += snapshot.MissCount
		totalEvictions += snapshot.EvictionCount

		if minResponseTime == 0 || snapshot.ResponseTime < minResponseTime {
			minResponseTime = snapshot.ResponseTime
		}
		if snapshot.ResponseTime > maxResponseTime {
			maxResponseTime = snapshot.ResponseTime
		}
	}

	count := float64(len(mc.snapshots))
	summary := MetricSummary{
		AverageHitRate:     totalHitRate / count,
		AverageMemoryUsage: totalMemoryUsage / count,
		TotalHits:          totalHitCount,
		TotalMisses:        totalMissCount,
		TotalEvictions:     totalEvictions,
		MinResponseTime:    minResponseTime,
		MaxResponseTime:    maxResponseTime,
		SnapshotCount:      len(mc.snapshots),
		LatestSnapshot:     mc.snapshots[len(mc.snapshots)-1],
	}

	return &MetricsData{
		Snapshots: mc.snapshots,
		Summary:   summary,
	}, nil
}

// MetricsData represents collected metrics data
type MetricsData struct {
	Snapshots []MetricSnapshot `json:"snapshots"`
	Summary   MetricSummary    `json:"summary"`
}

// MetricSummary provides summary statistics
type MetricSummary struct {
	AverageHitRate     float64        `json:"average_hit_rate"`
	AverageMemoryUsage float64        `json:"average_memory_usage"`
	TotalHits          int64          `json:"total_hits"`
	TotalMisses        int64          `json:"total_misses"`
	TotalEvictions     int64          `json:"total_evictions"`
	MinResponseTime    time.Duration  `json:"min_response_time"`
	MaxResponseTime    time.Duration  `json:"max_response_time"`
	SnapshotCount      int            `json:"snapshot_count"`
	LatestSnapshot     MetricSnapshot `json:"latest_snapshot"`
}

// HealthStatus represents cache health status
type HealthStatus struct {
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Metrics   CacheStats             `json:"metrics"`
	Checks    map[string]CheckResult `json:"checks"`
}

// CheckResult represents a health check result
type CheckResult struct {
	Status  string `json:"status"` // pass, warn, fail
	Message string `json:"message"`
}

// AlertManager manages cache alerts
type AlertManager struct {
	thresholds AlertThresholds
	logger     Logger
	active     map[string]Alert
	mu         sync.RWMutex
}

// Alert represents a cache alert
type Alert struct {
	ID         string     `json:"id"`
	Type       string     `json:"type"`
	Severity   string     `json:"severity"`
	Message    string     `json:"message"`
	Timestamp  time.Time  `json:"timestamp"`
	Resolved   bool       `json:"resolved"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
}

// NewAlertManager creates a new alert manager
func NewAlertManager(thresholds AlertThresholds, logger Logger) *AlertManager {
	return &AlertManager{
		thresholds: thresholds,
		logger:     logger,
		active:     make(map[string]Alert),
	}
}

// Start starts the alert manager
func (am *AlertManager) Start(ctx context.Context, metrics *MetricsCollector) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			am.checkAlerts(ctx, metrics)
		}
	}
}

// checkAlerts checks for alert conditions
func (am *AlertManager) checkAlerts(ctx context.Context, metrics *MetricsCollector) {
	metricsData, err := metrics.GetMetrics(ctx)
	if err != nil {
		am.logger.Error("Failed to get metrics for alert checking", "error", err)
		return
	}

	latest := metricsData.Summary.LatestSnapshot

	// Check hit rate
	if latest.HitRate < am.thresholds.HitRateMin {
		am.triggerAlert(Alert{
			Type:     "hit_rate_low",
			Severity: "warning",
			Message:  fmt.Sprintf("Cache hit rate is low: %.2f%%", latest.HitRate*100),
		})
	} else {
		am.resolveAlert("hit_rate_low")
	}

	// Check memory usage (simplified - would need total capacity)
	if latest.EvictionCount > 0 {
		am.triggerAlert(Alert{
			Type:     "memory_pressure",
			Severity: "warning",
			Message:  fmt.Sprintf("Memory pressure detected - %d evictions", latest.EvictionCount),
		})
	} else {
		am.resolveAlert("memory_pressure")
	}

	// Check response time
	if latest.ResponseTime > am.thresholds.ResponseTimeMax {
		am.triggerAlert(Alert{
			Type:     "response_time_high",
			Severity: "critical",
			Message:  fmt.Sprintf("Cache response time is high: %v", latest.ResponseTime),
		})
	} else {
		am.resolveAlert("response_time_high")
	}
}

// triggerAlert triggers a new alert
func (am *AlertManager) triggerAlert(alert Alert) {
	am.mu.Lock()
	defer am.mu.Unlock()

	alert.ID = fmt.Sprintf("%s_%d", alert.Type, time.Now().Unix())
	alert.Timestamp = time.Now()

	if existing, exists := am.active[alert.Type]; !exists || existing.Resolved {
		am.active[alert.Type] = alert
		am.logger.Error("Cache alert triggered",
			"type", alert.Type,
			"severity", alert.Severity,
			"message", alert.Message)
	}
}

// resolveAlert resolves an alert
func (am *AlertManager) resolveAlert(alertType string) {
	am.mu.Lock()
	defer am.mu.Unlock()

	if alert, exists := am.active[alertType]; exists && !alert.Resolved {
		alert.Resolved = true
		resolvedAt := time.Now()
		alert.ResolvedAt = &resolvedAt
		am.active[alertType] = alert

		am.logger.Info("Cache alert resolved",
			"type", alertType,
			"duration", resolvedAt.Sub(alert.Timestamp))
	}
}

// GetActiveAlerts returns active alerts
func (am *AlertManager) GetActiveAlerts() []Alert {
	am.mu.RLock()
	defer am.mu.RUnlock()

	alerts := make([]Alert, 0, len(am.active))
	for _, alert := range am.active {
		if !alert.Resolved {
			alerts = append(alerts, alert)
		}
	}

	sort.Slice(alerts, func(i, j int) bool {
		return alerts[i].Timestamp.After(alerts[j].Timestamp)
	})

	return alerts
}

// Dashboard provides web-based monitoring dashboard
type Dashboard struct {
	port   int
	logger Logger
}

// NewDashboard creates a new monitoring dashboard
func NewDashboard(port int, logger Logger) *Dashboard {
	return &Dashboard{
		port:   port,
		logger: logger,
	}
}

// Start starts the dashboard server
func (d *Dashboard) Start(ctx context.Context, metrics *MetricsCollector) {
	d.logger.Info("Starting cache monitoring dashboard", "port", d.port)

	// Dashboard implementation would go here
	// This would include HTTP server with web UI for cache monitoring

	d.logger.Info("Cache monitoring dashboard started")
}
