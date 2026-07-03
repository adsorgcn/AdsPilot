# serviceclient - Internal Service Communication Library

Unified library for calling internal services with circuit breakers, retries, and service discovery.

## Features

- ✅ **Circuit Breaker**: Automatic failure detection and recovery (using `github.com/sony/gobreaker`)
- ✅ **Automatic Retries**: Exponential backoff for transient failures
- ✅ **Service Discovery**: Environment-based configuration with Cloud Run defaults
- ✅ **Type-Safe**: Structured request/response types
- ✅ **Context-Aware**: Full `context.Context` support for timeouts and cancellation
- ✅ **Zero Configuration**: Pre-configured for common services (billing, offer, siterank, etc.)

## Quick Start

### Basic Usage

```go
import "github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"

// Create registry (initialized with common services)
registry := serviceclient.NewRegistry()

// Make a call
resp, err := registry.Call(ctx, "billing", serviceclient.Request{
    Method: "POST",
    Path:   "/api/v1/tokens/reserve",
    Body:   map[string]interface{}{
        "userId": "user123",
        "amount": 10,
    },
})
```

### JSON Response Unmarshaling

```go
type ReserveResponse struct {
    TxID   string `json:"txId"`
    Amount int    `json:"amount"`
}

var result ReserveResponse
err := registry.CallJSON(ctx, "billing", serviceclient.Request{
    Method: "POST",
    Path:   "/api/v1/tokens/reserve",
    Body:   map[string]interface{}{"amount": 10},
}, &result)

if err != nil {
    return fmt.Errorf("failed to reserve tokens: %w", err)
}

fmt.Printf("Reserved %d tokens, txID: %s\n", result.Amount, result.TxID)
```

### Custom Headers

```go
resp, err := registry.Call(ctx, "offer", serviceclient.Request{
    Method: "GET",
    Path:   "/api/v1/offers/123",
    Headers: map[string]string{
        "X-User-ID": userID,
        "X-Request-ID": requestID,
    },
})
```

### Custom Timeout

```go
resp, err := registry.Call(ctx, "siterank", serviceclient.Request{
    Method:  "POST",
    Path:    "/api/v1/siterank/evaluate",
    Body:    evalRequest,
    Timeout: 60 * time.Second, // Override default timeout
})
```

## Pre-Configured Services

The registry automatically configures these services:

| Service | Default URL | Timeout | Retries | Circuit Breaker |
|---------|-------------|---------|---------|-----------------|
| billing | http://billing:8080 | 5s | 2 | ✅ |
| offer | http://offer:8080 | 10s | 2 | ✅ |
| siterank | http://siterank:8080 | 30s | 1 | ✅ |
| adscenter | http://adscenter:8080 | 10s | 2 | ✅ |
| browser-exec | http://browser-exec:8080 | 35s | 1 | ✅ |
| useractivity | http://useractivity:8080 | 5s | 2 | ✅ |

## Environment Variables

Override default URLs with environment variables:

```bash
# Example configuration
BILLING_SERVICE_URL=https://billing-prod.example.com
OFFER_SERVICE_URL=http://offer:8080
SITERANK_SERVICE_URL=http://siterank:8080
```

## Circuit Breaker Behavior

Default circuit breaker settings:
- **Max Requests (half-open)**: 3
- **Interval**: 60 seconds
- **Timeout**: 30 seconds
- **Trip Condition**: 5 consecutive failures

States:
1. **Closed**: Normal operation
2. **Open**: Failing fast (after 5 consecutive failures)
3. **Half-Open**: Testing recovery (allows 3 requests)

## Retry Logic

Automatic retry with exponential backoff:
- **Retry 1**: Wait 100ms
- **Retry 2**: Wait 200ms
- **Retry 3**: Wait 400ms

**Note**: 4xx errors (client errors) are NOT retried.

## Advanced Usage

### Register Custom Service

```go
registry := serviceclient.NewRegistry()

registry.Register(serviceclient.ServiceConfig{
    Name:       "my-service",
    URL:        "http://my-service:8080",
    Timeout:    15 * time.Second,
    MaxRetries: 3,
    CircuitBreaker: serviceclient.CircuitBreakerConfig{
        Enabled:     true,
        MaxRequests: 5,
        Interval:    120 * time.Second,
        Timeout:     60 * time.Second,
        ReadyToTrip: func(counts serviceclient.Counts) bool {
            // Custom trip condition
            failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
            return counts.Requests >= 10 && failureRatio >= 0.5
        },
    },
})
```

### Direct Client Usage (Without Registry)

```go
client := serviceclient.NewClient(serviceclient.ServiceConfig{
    Name:    "billing",
    URL:     "http://billing:8080",
    Timeout: 5 * time.Second,
})

resp, err := client.Do(ctx, serviceclient.Request{
    Method: "GET",
    Path:   "/api/v1/health",
})
```

## Migration Guide

### Before (Direct HTTP Call)

```go
billingURL := os.Getenv("BILLING_SERVICE_URL")
reqBody, _ := json.Marshal(map[string]interface{}{"amount": 10})
req, _ := http.NewRequestWithContext(ctx, "POST",
    billingURL+"/api/v1/tokens/reserve",
    bytes.NewReader(reqBody))
req.Header.Set("Content-Type", "application/json")

client := &http.Client{Timeout: 5 * time.Second}
resp, err := client.Do(req)
// ... handle response
```

### After (Using serviceclient)

```go
registry := serviceclient.NewRegistry()

var result ReserveResponse
err := registry.CallJSON(ctx, "billing", serviceclient.Request{
    Method: "POST",
    Path:   "/api/v1/tokens/reserve",
    Body:   map[string]interface{}{"amount": 10},
}, &result)
```

**Benefits**:
- ✅ 70% less code
- ✅ Automatic circuit breaker
- ✅ Automatic retries
- ✅ Better error handling

## Best Practices

### 1. Use Pub/Sub for Async Operations

```go
// ❌ BAD: Synchronous call for non-urgent data
resp, _ := registry.Call(ctx, "siterank", ...)

// ✅ GOOD: Publish event for async processing
publisher.Publish(ctx, "EvaluationTaskCreated", event)
```

### 2. Reuse Registry Instance

```go
// ✅ GOOD: Create once, reuse
var globalRegistry = serviceclient.NewRegistry()

func myHandler(w http.ResponseWriter, r *http.Request) {
    resp, _ := globalRegistry.Call(r.Context(), "billing", ...)
}
```

### 3. Handle Circuit Breaker Errors

```go
resp, err := registry.Call(ctx, "billing", req)
if err != nil {
    if err == gobreaker.ErrOpenState {
        // Circuit breaker is open, fail fast
        return errors.New("billing service is currently unavailable")
    }
    return fmt.Errorf("billing call failed: %w", err)
}
```

### 4. Use Context for Cancellation

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

resp, err := registry.Call(ctx, "offer", req)
```

## Troubleshooting

### Circuit Breaker Keeps Tripping

Check circuit breaker state:
```go
endpoint, _ := registry.GetService("billing")
state := endpoint.Breaker.State()
fmt.Printf("Circuit breaker state: %v\n", state)
```

Adjust trip threshold:
```go
registry.Register(serviceclient.ServiceConfig{
    Name: "billing",
    CircuitBreaker: serviceclient.CircuitBreakerConfig{
        ReadyToTrip: func(counts serviceclient.Counts) bool {
            return counts.ConsecutiveFailures >= 10 // More tolerant
        },
    },
})
```

### Slow Requests

Increase timeout:
```go
resp, err := registry.Call(ctx, "siterank", serviceclient.Request{
    Method:  "POST",
    Path:    "/api/v1/evaluate",
    Timeout: 60 * time.Second, // Longer timeout
})
```

### Service Not Found

Register the service:
```go
registry.Register(serviceclient.ServiceConfig{
    Name: "my-service",
    URL:  "http://my-service:8080",
})
```

## Architecture Decision

This library replaces:
- ❌ Direct HTTP calls to internal services
- ❌ Scattered circuit breaker implementations
- ❌ Inconsistent retry logic
- ❌ Manual service URL management

With:
- ✅ Unified service communication layer
- ✅ Consistent error handling
- ✅ Built-in observability (circuit breaker metrics)
- ✅ Zero-configuration defaults

See: `/docs/architecture/SERVICE_COMMUNICATION_PATTERNS.md`
