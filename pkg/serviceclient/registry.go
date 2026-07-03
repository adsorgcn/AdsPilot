package serviceclient

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/sony/gobreaker"
)

// Registry manages all registered services and their circuit breakers
type Registry struct {
	services map[string]*ServiceEndpoint
	mu       sync.RWMutex
}

// ServiceEndpoint wraps a service client with a circuit breaker
type ServiceEndpoint struct {
	Name    string
	Client  *Client
	Breaker *gobreaker.CircuitBreaker
}

// NewRegistry creates a new service registry with pre-configured services
func NewRegistry() *Registry {
	registry := &Registry{
		services: make(map[string]*ServiceEndpoint),
	}

	// Register common services with sensible defaults
	registry.registerDefaultServices()

	return registry
}

// registerDefaultServices registers commonly used internal services
func (r *Registry) registerDefaultServices() {
	// Billing service
	r.Register(ServiceConfig{
		Name:           "billing",
		URL:            getServiceURL("BILLING_SERVICE_URL", "http://billing:8080"),
		Timeout:        5 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})

	// Offer service
	r.Register(ServiceConfig{
		Name:           "offer",
		URL:            getServiceURL("OFFER_SERVICE_URL", "http://offer:8080"),
		Timeout:        10 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})

	// Siterank service
	r.Register(ServiceConfig{
		Name:           "siterank",
		URL:            getServiceURL("SITERANK_SERVICE_URL", "http://siterank:8080"),
		Timeout:        30 * time.Second, // Longer timeout for analysis
		MaxRetries:     1,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})

	// Adscenter service
	r.Register(ServiceConfig{
		Name:           "adscenter",
		URL:            getServiceURL("ADSCENTER_URL", "http://adscenter:8080"),
		Timeout:        10 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})

	// Browser-exec service
	r.Register(ServiceConfig{
		Name:           "browser-exec",
		URL:            getServiceURL("BROWSER_EXEC_SERVICE_URL", "http://browser-exec:8080"),
		Timeout:        35 * time.Second, // Browser operations are slow
		MaxRetries:     1,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})

	// UserActivity service
	r.Register(ServiceConfig{
		Name:           "useractivity",
		URL:            getServiceURL("USERACTIVITY_SERVICE_URL", "http://useractivity:8080"),
		Timeout:        5 * time.Second,
		MaxRetries:     2,
		CircuitBreaker: DefaultCircuitBreakerConfig(),
	})
}

// Register adds a new service to the registry
func (r *Registry) Register(config ServiceConfig) {
	r.mu.Lock()
	defer r.mu.Unlock()

	client := NewClient(config)

	// Create circuit breaker if enabled
	var breaker *gobreaker.CircuitBreaker
	if config.CircuitBreaker.Enabled {
		breaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
			Name:        config.Name,
			MaxRequests: config.CircuitBreaker.MaxRequests,
			Interval:    config.CircuitBreaker.Interval,
			Timeout:     config.CircuitBreaker.Timeout,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				if config.CircuitBreaker.ReadyToTrip != nil {
					return config.CircuitBreaker.ReadyToTrip(Counts{
						Requests:             counts.Requests,
						TotalSuccesses:       counts.TotalSuccesses,
						TotalFailures:        counts.TotalFailures,
						ConsecutiveSuccesses: counts.ConsecutiveSuccesses,
						ConsecutiveFailures:  counts.ConsecutiveFailures,
					})
				}
				// Default: trip after 5 consecutive failures
				return counts.ConsecutiveFailures >= 5
			},
		})
	}

	r.services[config.Name] = &ServiceEndpoint{
		Name:    config.Name,
		Client:  client,
		Breaker: breaker,
	}
}

// Call executes a request to the specified service
func (r *Registry) Call(ctx context.Context, serviceName string, req Request) (*Response, error) {
	r.mu.RLock()
	endpoint, exists := r.services[serviceName]
	r.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("service '%s' not registered", serviceName)
	}

	// Execute with circuit breaker if enabled
	if endpoint.Breaker != nil {
		result, err := endpoint.Breaker.Execute(func() (interface{}, error) {
			return endpoint.Client.DoWithRetry(ctx, req)
		})

		if err != nil {
			return nil, fmt.Errorf("call to %s failed: %w", serviceName, err)
		}

		return result.(*Response), nil
	}

	// Direct call without circuit breaker
	return endpoint.Client.DoWithRetry(ctx, req)
}

// CallJSON is a convenience method that unmarshals the response
func (r *Registry) CallJSON(ctx context.Context, serviceName string, req Request, result interface{}) error {
	resp, err := r.Call(ctx, serviceName, req)
	if err != nil {
		return err
	}

	if result != nil && len(resp.Body) > 0 {
		if err := unmarshalJSON(resp.Body, result); err != nil {
			return fmt.Errorf("failed to unmarshal response from %s: %w", serviceName, err)
		}
	}

	return nil
}

// GetService returns the endpoint for a service
func (r *Registry) GetService(serviceName string) (*ServiceEndpoint, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	endpoint, exists := r.services[serviceName]
	if !exists {
		return nil, fmt.Errorf("service '%s' not registered", serviceName)
	}

	return endpoint, nil
}

// getServiceURL returns the service URL from environment or fallback
func getServiceURL(envKey, fallback string) string {
	if url := strings.TrimSpace(os.Getenv(envKey)); url != "" {
		return strings.TrimRight(url, "/")
	}
	return fallback
}

// unmarshalJSON unmarshals JSON with better error messages
func unmarshalJSON(data []byte, v interface{}) error {
	if err := json.Unmarshal(data, v); err != nil {
		return fmt.Errorf("JSON unmarshal error: %w (body: %s)", err, string(data))
	}
	return nil
}
