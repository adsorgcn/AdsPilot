package clients

import (
	"context"
	"errors"
	"fmt"

	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/sony/gobreaker"
)

// ServiceClients holds all external service clients with circuit breakers
// Now uses the unified pkg/serviceclient library
type ServiceClients struct {
	registry *serviceclient.Registry
}

// NewServiceClients creates all service clients using pkg/serviceclient
func NewServiceClients() *ServiceClients {
	return &ServiceClients{
		registry: serviceclient.NewRegistry(),
	}
}

// BillingReserveTokens calls the billing service to reserve tokens
func (sc *ServiceClients) BillingReserveTokens(ctx context.Context, userID string, amount int) (string, error) {
	var result struct {
		TxID string `json:"txId"`
	}

	err := sc.registry.CallJSON(ctx, "billing", serviceclient.Request{
		Method: "POST",
		Path:   "/api/v1/tokens/reserve",
		Body: map[string]interface{}{
			"userId": userID,
			"amount": amount,
		},
	}, &result)

	if err != nil {
		// Check if circuit breaker is open
		if errors.Is(err, gobreaker.ErrOpenState) {
			return "", fmt.Errorf("billing service unavailable (circuit breaker open): please try again later")
		}
		return "", fmt.Errorf("billing reserve tokens: %w", err)
	}

	return result.TxID, nil
}

// BrowserExecResolveOffer calls browser-exec to resolve an offer URL
func (sc *ServiceClients) BrowserExecResolveOffer(ctx context.Context, url string, timeoutMs int) (map[string]interface{}, error) {
	var result map[string]interface{}

	err := sc.registry.CallJSON(ctx, "browser-exec", serviceclient.Request{
		Method: "POST",
		Path:   "/api/v1/browser/resolve-offer",
		Body: map[string]interface{}{
			"url":       url,
			"timeoutMs": timeoutMs,
		},
	}, &result)

	if err != nil {
		// Check if circuit breaker is open
		if errors.Is(err, gobreaker.ErrOpenState) {
			// Return degraded response when circuit is open
			return map[string]interface{}{
				"ok":       false,
				"error":    "browser-exec service temporarily unavailable",
				"finalUrl": url, // Fallback to original URL
				"degraded": true,
			}, nil
		}
		return nil, fmt.Errorf("browser-exec resolve offer: %w", err)
	}

	return result, nil
}

// HealthStatus returns the health status of all service clients
func (sc *ServiceClients) HealthStatus() map[string]interface{} {
	status := make(map[string]interface{})

	// Get health status for each service
	for _, serviceName := range []string{"billing", "browser-exec"} {
		endpoint, err := sc.registry.GetService(serviceName)
		if err != nil {
			status[serviceName] = map[string]interface{}{
				"error": err.Error(),
			}
			continue
		}

		if endpoint.Breaker != nil {
			counts := endpoint.Breaker.Counts()
			status[serviceName] = map[string]interface{}{
				"state": endpoint.Breaker.State().String(),
				"counts": map[string]interface{}{
					"requests":             counts.Requests,
					"totalSuccesses":       counts.TotalSuccesses,
					"totalFailures":        counts.TotalFailures,
					"consecutiveSuccesses": counts.ConsecutiveSuccesses,
					"consecutiveFailures":  counts.ConsecutiveFailures,
				},
			}
		} else {
			status[serviceName] = map[string]interface{}{
				"state": "no circuit breaker",
			}
		}
	}

	return status
}
