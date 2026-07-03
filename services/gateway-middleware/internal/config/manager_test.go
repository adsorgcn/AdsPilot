package config

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestConfigManager_NewAndGet(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.yaml")

	configData := `
environment: test
backends:
  billing: https://billing-test.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
    tokenCost: 5
    requireAuth: true
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://test.supabase.co
  issuer: https://test.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 20
`

	if err := os.WriteFile(configPath, []byte(configData), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	// Create config manager
	cm, err := NewConfigManager(configPath)
	if err != nil {
		t.Fatalf("Failed to create config manager: %v", err)
	}

	// Test Get
	cfg := cm.Get()
	if cfg == nil {
		t.Fatal("Expected config, got nil")
	}

	if cfg.Environment != "test" {
		t.Errorf("Expected environment 'test', got '%s'", cfg.Environment)
	}

	if len(cfg.Routes) != 1 {
		t.Errorf("Expected 1 route, got %d", len(cfg.Routes))
	}

	// Test version
	version := cm.GetVersion()
	if version == 0 {
		t.Error("Expected non-zero version")
	}
}

func TestConfigManager_Reload(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.yaml")

	initialConfig := `
environment: test
backends:
  billing: https://billing-test.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
    tokenCost: 5
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://test.supabase.co
  issuer: https://test.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 20
`

	if err := os.WriteFile(configPath, []byte(initialConfig), 0644); err != nil {
		t.Fatalf("Failed to write initial config: %v", err)
	}

	// Create config manager
	cm, err := NewConfigManager(configPath)
	if err != nil {
		t.Fatalf("Failed to create config manager: %v", err)
	}

	initialVersion := cm.GetVersion()
	initialRouteCount := len(cm.Get().Routes)

	if initialRouteCount != 1 {
		t.Fatalf("Expected 1 initial route, got %d", initialRouteCount)
	}

	// Update config file
	time.Sleep(10 * time.Millisecond) // Ensure version timestamp changes

	updatedConfig := `
environment: test
backends:
  billing: https://billing-test.example.com
  offer: https://offer-test.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
    tokenCost: 5
  - prefix: /api/v1/offers
    backend: offer
    methods: [GET, POST]
    tokenCost: 10
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://test.supabase.co
  issuer: https://test.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 20
`

	if err := os.WriteFile(configPath, []byte(updatedConfig), 0644); err != nil {
		t.Fatalf("Failed to write updated config: %v", err)
	}

	// Reload configuration
	ctx := context.Background()
	if err := cm.Reload(ctx); err != nil {
		t.Fatalf("Failed to reload config: %v", err)
	}

	// Verify config was updated
	newVersion := cm.GetVersion()
	if newVersion <= initialVersion {
		t.Errorf("Expected version to increase, got initial=%d new=%d", initialVersion, newVersion)
	}

	newRouteCount := len(cm.Get().Routes)
	if newRouteCount != 2 {
		t.Errorf("Expected 2 routes after reload, got %d", newRouteCount)
	}

	newBackendCount := len(cm.Get().Backends)
	if newBackendCount != 2 {
		t.Errorf("Expected 2 backends after reload, got %d", newBackendCount)
	}
}

func TestConfigManager_ReloadCallback(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.yaml")

	initialConfig := `
environment: test
backends:
  billing: https://billing-test.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://test.supabase.co
  issuer: https://test.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 20
`

	if err := os.WriteFile(configPath, []byte(initialConfig), 0644); err != nil {
		t.Fatalf("Failed to write initial config: %v", err)
	}

	// Create config manager
	cm, err := NewConfigManager(configPath)
	if err != nil {
		t.Fatalf("Failed to create config manager: %v", err)
	}

	// Register callback
	callbackCalled := false
	var oldEnv, newEnv string

	cm.OnReload(func(oldConfig, newConfig *Config) {
		callbackCalled = true
		oldEnv = oldConfig.Environment
		newEnv = newConfig.Environment
	})

	// Update config
	updatedConfig := `
environment: production
backends:
  billing: https://billing-prod.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://prod.supabase.co
  issuer: https://prod.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 1000
  burstSize: 200
`

	if err := os.WriteFile(configPath, []byte(updatedConfig), 0644); err != nil {
		t.Fatalf("Failed to write updated config: %v", err)
	}

	// Reload
	ctx := context.Background()
	if err := cm.Reload(ctx); err != nil {
		t.Fatalf("Failed to reload config: %v", err)
	}

	// Verify callback was called
	if !callbackCalled {
		t.Error("Expected callback to be called")
	}

	if oldEnv != "test" {
		t.Errorf("Expected old environment 'test', got '%s'", oldEnv)
	}

	if newEnv != "production" {
		t.Errorf("Expected new environment 'production', got '%s'", newEnv)
	}
}

func TestConfigManager_InvalidConfigReload(t *testing.T) {
	// Create temporary config file
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "test-config.yaml")

	validConfig := `
environment: test
backends:
  billing: https://billing-test.example.com
routes:
  - prefix: /api/v1/test
    backend: billing
    methods: [GET]
redis:
  address: localhost:6379
  db: 0
  cacheExpiry:
    subscription: 300s
    permissions: 300s
    tokenBalance: 60s
jwt:
  projectURL: https://test.supabase.co
  issuer: https://test.supabase.co/auth/v1
  audience: authenticated
rateLimit:
  enabled: true
  requestsPerMinute: 100
  burstSize: 20
`

	if err := os.WriteFile(configPath, []byte(validConfig), 0644); err != nil {
		t.Fatalf("Failed to write valid config: %v", err)
	}

	// Create config manager
	cm, err := NewConfigManager(configPath)
	if err != nil {
		t.Fatalf("Failed to create config manager: %v", err)
	}

	initialVersion := cm.GetVersion()
	initialEnvironment := cm.Get().Environment

	// Write invalid config
	invalidConfig := `
environment: test
backends: {}
routes: []
`

	if err := os.WriteFile(configPath, []byte(invalidConfig), 0644); err != nil {
		t.Fatalf("Failed to write invalid config: %v", err)
	}

	// Try to reload (should fail)
	ctx := context.Background()
	err = cm.Reload(ctx)
	if err == nil {
		t.Fatal("Expected error when reloading invalid config")
	}

	// Verify old config is still active
	if cm.GetVersion() != initialVersion {
		t.Error("Config version should not change on failed reload")
	}

	if cm.Get().Environment != initialEnvironment {
		t.Error("Config should not change on failed reload")
	}
}
