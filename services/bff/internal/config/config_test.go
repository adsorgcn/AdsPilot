package config

import (
	"context"
	"testing"
)

// TestGetRedisURL_FromEnv tests Redis URL retrieval from environment variable
func TestGetRedisURL_FromEnv(t *testing.T) {
	ctx := context.Background()

	// Set environment variable
	t.Setenv("REDIS_URL", "redis://test:6379")

	url, err := GetRedisURL(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	expected := "redis://test:6379"
	if url != expected {
		t.Errorf("Expected URL %s, got %s", expected, url)
	}
}

// TestGetRedisURL_Default tests default fallback
func TestGetRedisURL_Default(t *testing.T) {
	ctx := context.Background()

	// Clear environment variables
	t.Setenv("REDIS_URL", "")
	t.Setenv("REDIS_URL_SECRET_NAME", "")

	url, err := GetRedisURL(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	expected := "localhost:6379"
	if url != expected {
		t.Errorf("Expected default URL %s, got %s", expected, url)
	}
}

// TestGetRedisURL_Priority tests environment variable takes priority over Secret Manager
func TestGetRedisURL_Priority(t *testing.T) {
	ctx := context.Background()

	// Set both environment variable and secret name
	t.Setenv("REDIS_URL", "redis://env:6379")
	t.Setenv("REDIS_URL_SECRET_NAME", "projects/test/secrets/redis/versions/latest")

	url, err := GetRedisURL(ctx)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Environment variable should take priority
	expected := "redis://env:6379"
	if url != expected {
		t.Errorf("Expected environment variable to take priority, got %s", url)
	}
}

// TestGetRedisURL_EmptyValues tests handling of empty values
func TestGetRedisURL_EmptyValues(t *testing.T) {
	tests := []struct {
		name          string
		redisURL      string
		secretName    string
		expectedURL   string
		expectedError bool
	}{
		{
			name:          "Empty string for REDIS_URL",
			redisURL:      "",
			secretName:    "",
			expectedURL:   "localhost:6379",
			expectedError: false,
		},
		{
			name:          "Whitespace-only REDIS_URL",
			redisURL:      "   ",
			secretName:    "",
			expectedURL:   "localhost:6379",
			expectedError: false,
		},
		{
			name:          "Valid REDIS_URL with spaces",
			redisURL:      "  redis://host:6379  ",
			secretName:    "",
			expectedURL:   "redis://host:6379",
			expectedError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			t.Setenv("REDIS_URL", tt.redisURL)
			t.Setenv("REDIS_URL_SECRET_NAME", tt.secretName)

			url, err := GetRedisURL(ctx)

			if tt.expectedError && err == nil {
				t.Error("Expected error, got nil")
			}

			if !tt.expectedError && err != nil {
				t.Errorf("Expected no error, got: %v", err)
			}

			if url != tt.expectedURL {
				t.Errorf("Expected URL %s, got %s", tt.expectedURL, url)
			}
		})
	}
}

// TestGetSecretFromManager_EmptyName tests error handling for empty secret name
func TestGetSecretFromManager_EmptyName(t *testing.T) {
	ctx := context.Background()

	_, err := getSecretFromManager(ctx, "")
	if err == nil {
		t.Error("Expected error for empty secret name, got nil")
	}

	if err != nil && err.Error() != "secret name is empty" {
		t.Errorf("Expected 'secret name is empty' error, got: %v", err)
	}
}

// Note: Testing actual Secret Manager integration requires GCP credentials
// and is typically done in integration tests, not unit tests.
