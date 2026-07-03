//go:build integration
// +build integration

package main

import (
	"net/http"
	"testing"
)

const previewURL = "https://adscenter-preview-yt54xvsg5q-an.a.run.app"

func TestPreviewHealth(t *testing.T) {
	resp, err := http.Get(previewURL + "/health")
	if err != nil {
		t.Fatalf("Failed to call health endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Health check passed: %d", resp.StatusCode)
}

func TestPreviewReadiness(t *testing.T) {
	resp, err := http.Get(previewURL + "/readyz")
	if err != nil {
		t.Fatalf("Failed to call readyz endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Readiness check passed: %d", resp.StatusCode)
}

func TestPreviewMetrics(t *testing.T) {
	resp, err := http.Get(previewURL + "/metrics")
	if err != nil {
		t.Fatalf("Failed to call metrics endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200, got %d", resp.StatusCode)
	}
	t.Logf("✅ Metrics endpoint passed: %d", resp.StatusCode)
}
