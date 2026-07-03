package config

import (
	"context"
	"fmt"
	"os"
	"strings"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
)

// GetRedisURL retrieves Redis connection URL from environment variable or Secret Manager.
// Priority:
//  1. REDIS_URL environment variable (direct value)
//  2. REDIS_URL_SECRET_NAME environment variable (Secret Manager path)
//  3. Default: "localhost:6379"
func GetRedisURL(ctx context.Context) (string, error) {
	// Try direct environment variable first
	if redisURL := strings.TrimSpace(os.Getenv("REDIS_URL")); redisURL != "" {
		return redisURL, nil
	}

	// Try Secret Manager
	if secretName := strings.TrimSpace(os.Getenv("REDIS_URL_SECRET_NAME")); secretName != "" {
		redisURL, err := getSecretFromManager(ctx, secretName)
		if err != nil {
			return "", fmt.Errorf("failed to get Redis URL from Secret Manager: %w", err)
		}
		return redisURL, nil
	}

	// Default fallback for local development
	return "localhost:6379", nil
}

// getSecretFromManager retrieves a secret from Google Cloud Secret Manager.
// The name should be in the format: "projects/<project>/secrets/<name>/versions/latest".
func getSecretFromManager(ctx context.Context, secretName string) (string, error) {
	if secretName == "" {
		return "", fmt.Errorf("secret name is empty")
	}

	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to create Secret Manager client: %w", err)
	}
	defer client.Close()

	req := &secretmanagerpb.AccessSecretVersionRequest{
		Name: secretName,
	}

	result, err := client.AccessSecretVersion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to access secret version: %w", err)
	}

	return string(result.Payload.Data), nil
}
