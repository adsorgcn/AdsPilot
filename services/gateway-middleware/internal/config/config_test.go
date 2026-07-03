package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoad_ValidConfig(t *testing.T) {
	// Create a temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.yaml")

	configContent := `
environment: test
backends:
  offer: "https://offer-test.example.com"
  billing: "https://billing-test.example.com"

routes:
  - prefix: "/api/v1/offers"
    backend: "offer"
    methods: ["GET", "POST"]
    requireAuth: true
    requireTier: ["professional", "pro"]
    tokenCost: 10
    description: "Offer management"

  - prefix: "/api/v1/public"
    backend: "offer"
    methods: ["GET"]
    requireAuth: false
    tokenCost: 0

defaultPermissions:
  starter: ["read"]
  professional: ["read", "write"]

redis:
  address: "localhost:6379"
  password: ""
  db: 0
  cacheExpiry:
    subscription: "5m"
    permissions: "5m"
    tokenBalance: "1m"

jwt:
  issuer: "test-issuer"
  audience: "test-audience"

rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 120
`

	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	// Load config
	cfg, err := Load(configPath)
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Assertions
	if cfg.Environment != "test" {
		t.Errorf("Expected environment 'test', got '%s'", cfg.Environment)
	}

	if len(cfg.Backends) != 2 {
		t.Errorf("Expected 2 backends, got %d", len(cfg.Backends))
	}

	if cfg.Backends["offer"] != "https://offer-test.example.com" {
		t.Errorf("Expected offer backend URL, got '%s'", cfg.Backends["offer"])
	}

	if len(cfg.Routes) != 2 {
		t.Errorf("Expected 2 routes, got %d", len(cfg.Routes))
	}

	// Check first route
	route1 := cfg.Routes[0]
	if route1.Prefix != "/api/v1/offers" {
		t.Errorf("Expected prefix '/api/v1/offers', got '%s'", route1.Prefix)
	}

	if route1.Backend != "offer" {
		t.Errorf("Expected backend 'offer', got '%s'", route1.Backend)
	}

	if !route1.RequireAuth {
		t.Error("Expected RequireAuth true, got false")
	}

	if route1.TokenCost != 10 {
		t.Errorf("Expected TokenCost 10, got %d", route1.TokenCost)
	}

	if len(route1.RequireTier) != 2 {
		t.Errorf("Expected 2 tiers, got %d", len(route1.RequireTier))
	}

	// Check second route (public)
	route2 := cfg.Routes[1]
	if route2.RequireAuth {
		t.Error("Expected RequireAuth false for public route")
	}

	if route2.TokenCost != 0 {
		t.Errorf("Expected TokenCost 0 for public route, got %d", route2.TokenCost)
	}

	// Check default permissions
	if len(cfg.DefaultPermissions) != 2 {
		t.Errorf("Expected 2 default permission sets, got %d", len(cfg.DefaultPermissions))
	}

	starterPerms := cfg.DefaultPermissions["starter"]
	if len(starterPerms) != 1 || starterPerms[0] != "read" {
		t.Errorf("Expected starter permissions ['read'], got %v", starterPerms)
	}

	// Check Redis config
	if cfg.Redis.Address != "localhost:6379" {
		t.Errorf("Expected Redis address 'localhost:6379', got '%s'", cfg.Redis.Address)
	}

	if cfg.Redis.CacheExpiry.Subscription != 5*time.Minute {
		t.Errorf("Expected subscription TTL 5m, got %v", cfg.Redis.CacheExpiry.Subscription)
	}

	// Check JWT config
	if cfg.JWT.Issuer != "test-issuer" {
		t.Errorf("Expected JWT issuer 'test-issuer', got '%s'", cfg.JWT.Issuer)
	}

	// Check rate limit config
	if !cfg.RateLimit.Enabled {
		t.Error("Expected rate limit enabled")
	}

	if cfg.RateLimit.RequestsPerMinute != 100 {
		t.Errorf("Expected 100 requests per minute, got %d", cfg.RateLimit.RequestsPerMinute)
	}
}

func TestLoad_FileNotFound(t *testing.T) {
	_, err := Load("/nonexistent/config.yaml")
	if err == nil {
		t.Error("Expected error for nonexistent file, got nil")
	}
}

func TestLoad_InvalidYAML(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "invalid.yaml")

	invalidContent := `
environment: test
backends:
  invalid yaml structure
    - malformed
`

	if err := os.WriteFile(configPath, []byte(invalidContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	_, err := Load(configPath)
	if err == nil {
		t.Error("Expected error for invalid YAML, got nil")
	}
}

func TestConfig_FindRoute(t *testing.T) {
	cfg := &Config{
		Routes: []RouteConfig{
			{
				Prefix:  "/api/v1/offers",
				Backend: "offer",
				Methods: []string{"GET", "POST"},
			},
			{
				Prefix:  "/api/v1/billing",
				Backend: "billing",
				Methods: []string{"GET"},
			},
			{
				Prefix:  "/api/v1",
				Backend: "default",
				Methods: []string{"GET", "POST", "PUT", "DELETE"},
			},
		},
	}

	tests := []struct {
		name            string
		path            string
		method          string
		expectedBackend string
		expectNil       bool
	}{
		{
			name:            "exact match",
			path:            "/api/v1/offers",
			method:          "GET",
			expectedBackend: "offer",
			expectNil:       false,
		},
		{
			name:            "prefix match",
			path:            "/api/v1/offers/123",
			method:          "POST",
			expectedBackend: "offer",
			expectNil:       false,
		},
		{
			name:            "method mismatch - fallback to default",
			path:            "/api/v1/billing",
			method:          "POST",
			expectedBackend: "default", // Falls back to default backend which supports POST
			expectNil:       false,
		},
		{
			name:            "longest match wins",
			path:            "/api/v1/offers/create",
			method:          "POST",
			expectedBackend: "offer",
			expectNil:       false,
		},
		{
			name:            "fallback to shorter prefix",
			path:            "/api/v1/unknown",
			method:          "GET",
			expectedBackend: "default",
			expectNil:       false,
		},
		{
			name:      "no match",
			path:      "/api/v2/test",
			method:    "GET",
			expectNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			route := cfg.FindRoute(tt.path, tt.method)

			if tt.expectNil && route != nil {
				t.Errorf("Expected nil route, got backend '%s'", route.Backend)
			}

			if !tt.expectNil && route == nil {
				t.Error("Expected route, got nil")
			}

			if !tt.expectNil && route != nil && route.Backend != tt.expectedBackend {
				t.Errorf("Expected backend '%s', got '%s'", tt.expectedBackend, route.Backend)
			}
		})
	}
}

func TestConfig_GetBackendURL(t *testing.T) {
	cfg := &Config{
		Backends: map[string]string{
			"offer":   "https://offer.example.com",
			"billing": "https://billing.example.com",
		},
	}

	tests := []struct {
		name        string
		backend     string
		expectedURL string
	}{
		{
			name:        "existing backend",
			backend:     "offer",
			expectedURL: "https://offer.example.com",
		},
		{
			name:        "another backend",
			backend:     "billing",
			expectedURL: "https://billing.example.com",
		},
		{
			name:        "nonexistent backend",
			backend:     "unknown",
			expectedURL: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := cfg.GetBackendURL(tt.backend)
			if url != tt.expectedURL {
				t.Errorf("Expected URL '%s', got '%s'", tt.expectedURL, url)
			}
		})
	}
}
