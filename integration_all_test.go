//go:build integration
// +build integration

package main

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

var services = map[string]string{
	"adscenter":    "https://adscenter-preview-yt54xvsg5q-an.a.run.app",
	"offer":        "https://offer-preview-yt54xvsg5q-an.a.run.app",
	"browser-exec": "https://browser-exec-preview-yt54xvsg5q-an.a.run.app",
}

func TestAllServicesHealth(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	for name, url := range services {
		t.Run(name, func(t *testing.T) {
			resp, err := client.Get(url + "/health")
			if err != nil {
				t.Fatalf("%s: Failed to call health: %v", name, err)
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				t.Errorf("%s: Expected 200, got %d", name, resp.StatusCode)
			} else {
				t.Logf("✅ %s health check passed", name)
			}
		})
	}
}

func TestAllServicesReadiness(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	for name, url := range services {
		t.Run(name, func(t *testing.T) {
			resp, err := client.Get(url + "/readyz")
			if err != nil {
				t.Logf("%s: readyz endpoint not available: %v", name, err)
				t.Skip()
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				t.Errorf("%s: Expected 200, got %d", name, resp.StatusCode)
			} else {
				t.Logf("✅ %s readiness check passed", name)
			}
		})
	}
}

func TestAllServicesMetrics(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	for name, url := range services {
		t.Run(name, func(t *testing.T) {
			resp, err := client.Get(url + "/metrics")
			if err != nil {
				t.Logf("%s: metrics endpoint not available: %v", name, err)
				t.Skip()
			}
			defer resp.Body.Close()

			if resp.StatusCode != 200 {
				t.Errorf("%s: Expected 200, got %d", name, resp.StatusCode)
			} else {
				t.Logf("✅ %s metrics endpoint passed", name)
			}
		})
	}
}

func TestServiceLatency(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	for name, url := range services {
		t.Run(name, func(t *testing.T) {
			start := time.Now()
			resp, err := client.Get(url + "/health")
			latency := time.Since(start)

			if err != nil {
				t.Fatalf("%s: Failed: %v", name, err)
			}
			defer resp.Body.Close()

			t.Logf("✅ %s latency: %v", name, latency)

			if latency > 2*time.Second {
				t.Logf("⚠️  %s: High latency detected: %v", name, latency)
			}
		})
	}
}

func TestConcurrentRequests(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	for name, url := range services {
		t.Run(name, func(t *testing.T) {
			concurrency := 5
			done := make(chan bool, concurrency)
			errors := make(chan error, concurrency)

			for i := 0; i < concurrency; i++ {
				go func(id int) {
					resp, err := client.Get(url + "/health")
					if err != nil {
						errors <- fmt.Errorf("request %d failed: %v", id, err)
						done <- false
						return
					}
					resp.Body.Close()

					if resp.StatusCode != 200 {
						errors <- fmt.Errorf("request %d got status %d", id, resp.StatusCode)
						done <- false
						return
					}
					done <- true
				}(i)
			}

			success := 0
			for i := 0; i < concurrency; i++ {
				if <-done {
					success++
				}
			}
			close(errors)

			for err := range errors {
				t.Logf("Error: %v", err)
			}

			t.Logf("✅ %s: %d/%d concurrent requests succeeded", name, success, concurrency)

			if success < concurrency {
				t.Errorf("%s: Only %d/%d requests succeeded", name, success, concurrency)
			}
		})
	}
}
