package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/ScientificInternet/Google-Monetize/pkg/errorreporting"
	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"

	"github.com/ScientificInternet/Google-Monetize/services/aicore/internal/provider"
)

var router *provider.Router

func main() {
	ctx := context.Background()

	router = provider.NewRouter()
	log.Printf("aicore: providers=%v", router.Providers())

	shutdownTracing := telemetry.SetupTracing("aicore")
	defer func() { _ = shutdownTracing(ctx) }()

	closeErrorReporting := errorreporting.Setup(ctx, "aicore")
	defer closeErrorReporting()

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	telemetry.RegisterDefaultMetrics("aicore")
	r.Use(telemetry.ChiMiddleware("aicore"))
	r.Use(middleware.LoggingMiddleware("aicore"))
	r.Use(middleware.SecurityHeaders())

	r.Handle("/metrics", telemetry.MetricsHandler())
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	// 内部接口,需鉴权(由 affiliate / antifraud 等服务调用)
	r.Handle("/api/v1/aicore/complete", middleware.AuthMiddleware(http.HandlerFunc(completeHandler)))

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	log.Printf("aicore v0.1.0 listening on :%s", port)
	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Fatal(srv.ListenAndServe())
}

// completeRequest 是 /complete 的请求体。
type completeRequest struct {
	Task      string             `json:"task"` // select_offer | design_ad | antifraud | 空=default
	System    string             `json:"system"`
	Messages  []provider.Message `json:"messages"`
	JSON      bool               `json:"json"`
	MaxTokens int                `json:"maxTokens"`
}

// POST /api/v1/aicore/complete
func completeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	var body completeRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	if len(body.Messages) == 0 && strings.TrimSpace(body.System) == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "messages or system required", nil)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 100*time.Second)
	defer cancel()

	resp, err := router.Complete(ctx, body.Task, provider.CompletionRequest{
		System:    body.System,
		Messages:  body.Messages,
		JSON:      body.JSON,
		MaxTokens: body.MaxTokens,
	})
	if err != nil {
		apperr.Write(w, r, http.StatusBadGateway, "AI_PROVIDER_ERROR", err.Error(), nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
