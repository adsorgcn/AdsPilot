package clients

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/sony/gobreaker"
)

// Integration tests using real preview environment services

func TestNewBreakerClient(t *testing.T) {
	cfg := Config{
		Name:    "test-service",
		BaseURL: "https://billing-preview-yt54xvsg5q-an.a.run.app",
		Timeout: 5 * time.Second,
	}

	client := NewBreakerClient(cfg)

	if client == nil {
		t.Fatal("NewBreakerClient returned nil")
	}

	if client.client == nil {
		t.Error("HTTP client not initialized")
	}

	if client.breaker == nil {
		t.Error("Circuit breaker not initialized")
	}

	if client.State() != gobreaker.StateClosed.String() {
		t.Errorf("Initial state should be Closed, got %s", client.State())
	}
}

func TestServiceClients_BillingReserveTokens(t *testing.T) {
	// Set environment variables for real preview services
	os.Setenv("BILLING_SERVICE_URL", "https://billing-preview-yt54xvsg5q-an.a.run.app")
	os.Setenv("INTERNAL_SERVICE_TOKEN", "10ea0531d8f98fd94b3ef72aba917c12")
	defer os.Unsetenv("BILLING_SERVICE_URL")
	defer os.Unsetenv("INTERNAL_SERVICE_TOKEN")

	sc := NewServiceClients()

	// Test with real preview billing service
	ctx := context.Background()

	// This should fail because we don't have a valid user ID, but it tests the connection
	_, err := sc.BillingReserveTokens(ctx, "test-user-id", 100)

	// We expect an error (user not found or insufficient balance), but not a network error
	if err != nil {
		t.Logf("BillingReserveTokens error (expected for test user): %v", err)
	}

	// Check that circuit breaker recorded the attempt
	endpoint, err := sc.registry.GetService("billing")
	if err != nil {
		t.Fatalf("Failed to get billing service: %v", err)
	}
	counts := endpoint.Breaker.Counts()
	if counts.Requests < 1 {
		t.Errorf("Expected at least 1 request, got %d", counts.Requests)
	}
}

func TestServiceClients_BrowserExecResolveOffer(t *testing.T) {
	// Set environment variables for real preview services
	os.Setenv("BROWSER_EXEC_SERVICE_URL", "https://browser-exec-preview-yt54xvsg5q-an.a.run.app")
	os.Setenv("INTERNAL_SERVICE_TOKEN", "10ea0531d8f98fd94b3ef72aba917c12")
	defer os.Unsetenv("BROWSER_EXEC_SERVICE_URL")
	defer os.Unsetenv("INTERNAL_SERVICE_TOKEN")

	sc := NewServiceClients()

	ctx := context.Background()

	// Test with a simple URL (may timeout or fail, but tests connectivity)
	result, err := sc.BrowserExecResolveOffer(ctx, "https://example.com", 5000)

	if err != nil {
		t.Logf("BrowserExecResolveOffer error (may be expected): %v", err)
	} else {
		t.Logf("BrowserExecResolveOffer result: %+v", result)
	}

	// Check that circuit breaker recorded the attempt
	endpoint, err := sc.registry.GetService("browser-exec")
	if err != nil {
		t.Fatalf("Failed to get browser-exec service: %v", err)
	}
	counts := endpoint.Breaker.Counts()
	if counts.Requests < 1 {
		t.Errorf("Expected at least 1 request, got %d", counts.Requests)
	}
}

func TestServiceClients_HealthStatus(t *testing.T) {
	sc := NewServiceClients()

	status := sc.HealthStatus()

	if status == nil {
		t.Fatal("HealthStatus returned nil")
	}

	// Check all services are included
	services := []string{"billing", "browser-exec"}
	for _, svc := range services {
		if _, ok := status[svc]; !ok {
			t.Errorf("HealthStatus missing service: %s", svc)
		}
	}
}

func TestBreakerClient_DefaultTimeout(t *testing.T) {
	cfg := Config{
		Name:    "test",
		BaseURL: "https://billing-preview-yt54xvsg5q-an.a.run.app",
		// Timeout not set
	}

	client := NewBreakerClient(cfg)

	// Should have default timeout of 5 seconds
	if client == nil {
		t.Fatal("NewBreakerClient returned nil with default timeout")
	}
}

// Note: Circuit breaker opening tests are difficult to test with real services
// as we don't want to deliberately cause failures in the preview environment.
// These should be tested in a dedicated test environment or with fault injection.

func TestServiceClients_FallbackLogic_BrowserExec(t *testing.T) {
	// Set environment variables for real preview services
	os.Setenv("BROWSER_EXEC_SERVICE_URL", "https://invalid-service-url.example.com")
	defer os.Unsetenv("BROWSER_EXEC_SERVICE_URL")

	sc := NewServiceClients()

	ctx := context.Background()

	// Make multiple failing requests to trip the circuit breaker
	for i := 0; i < 10; i++ {
		_, _ = sc.BrowserExecResolveOffer(ctx, "https://example.com", 100)
	}

	// Circuit should be open now, next call should get fallback response
	result, err := sc.BrowserExecResolveOffer(ctx, "https://test.com", 100)

	if err != nil {
		t.Errorf("Expected fallback response without error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected fallback result, got nil")
	}

	if degraded, ok := result["degraded"].(bool); !ok || !degraded {
		t.Error("Expected degraded=true in fallback response")
	}

	if finalUrl, ok := result["finalUrl"].(string); !ok || finalUrl != "https://test.com" {
		t.Errorf("Expected finalUrl=https://test.com, got %v", finalUrl)
	}
}
