package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	ev "github.com/ScientificInternet/Google-Monetize/pkg/events"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	"github.com/ScientificInternet/Google-Monetize/services/projector/internal/storage"
	"github.com/go-chi/chi/v5"
)

type Projector struct {
	adapter *storage.Adapter
}

// 移除ensureDDL函数，现在通过适配器管理DDL

func (p *Projector) pushHandler(w http.ResponseWriter, r *http.Request) {
	// Pub/Sub push => { message: { data: base64 }, subscription: "..." }
	var body struct {
		Message struct {
			Data       string            `json:"data"`
			Attributes map[string]string `json:"attributes"`
		} `json:"message"`
		Subscription string `json:"subscription"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid push body", nil)
		return
	}
	raw, err := base64.StdEncoding.DecodeString(body.Message.Data)
	if err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid base64", nil)
		return
	}
	var env ev.Envelope
	if err := json.Unmarshal(raw, &env); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid event envelope", nil)
		return
	}
	// idempotency: insert into event_projection if not exists
	if p.adapter != nil {
		// Ensure DDL exists
		_ = p.adapter.EnsureDDL(r.Context())
		// Record event projection
		_ = p.adapter.RecordEventProjection(r.Context(), env.ID, env.Type, strings.TrimSpace(env.Source), env.Subject)
	}
	// Apply minimal read-model projections for core events（统一幂等最佳努力）
	if p.adapter != nil {
		switch env.Type {
		case ev.EventOfferCreated:
			// Local struct to avoid cross-module import
			type offerCreated struct{ OfferID, UserID, Name, OriginalUrl, Status string }
			var oc offerCreated
			_ = ev.UnmarshalData(env, &oc)
			if strings.TrimSpace(oc.OfferID) != "" && strings.TrimSpace(oc.UserID) != "" {
				// Use adapter to insert offer (handles both camelCase and legacy lowercase)
				_ = p.adapter.InsertOffer(r.Context(), oc.OfferID, oc.UserID, oc.Name, oc.OriginalUrl, oc.Status)
			}
		case ev.EventSiterankCompleted:
			var data map[string]any
			_ = ev.UnmarshalData(env, &data)
			offID, _ := data["offerId"].(string)
			uid, _ := data["userId"].(string)
			// score can be float64 or numeric in string
			var score *float64
			switch v := data["score"].(type) {
			case float64:
				score = &v
			case string:
				if f, err := parseFloat(v); err == nil {
					score = &f
				}
			}
			if strings.TrimSpace(offID) != "" && strings.TrimSpace(uid) != "" {
				// Use adapter to update offer status
				_ = p.adapter.UpdateOfferStatus(r.Context(), offID, uid, score)
			}
		}
	}

	// Firestore UI cache (optional): write recent events per user (if userId present in data)
	if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) == "1" {
		var userID string
		// attempt to extract userId from data (best-effort)
		var m map[string]any
		if b, err := json.Marshal(env.Data); err == nil {
			_ = json.Unmarshal(b, &m)
			if v, ok := m["userId"].(string); ok {
				userID = v
			}
		}
		pid := os.Getenv("GOOGLE_CLOUD_PROJECT")
		if pid == "" {
			pid = os.Getenv("PROJECT_ID")
		}
		if pid != "" && userID != "" {
			ctx, cancel := context.WithTimeout(r.Context(), 1500*time.Millisecond)
			defer cancel()
			if cli, err := firestore.NewClient(ctx, pid); err == nil {
				_, _ = cli.Collection(fmt.Sprintf("users/%s/events", userID)).NewDoc().Set(ctx, map[string]any{"id": env.ID, "type": env.Type, "source": env.Source, "subject": env.Subject, "time": env.Time, "data": env.Data})
				_ = cli.Close()
			}
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseFloat(s string) (float64, error) {
	// trim and parse decimal
	ss := strings.TrimSpace(s)
	var f float64
	_, err := fmt.Sscan(ss, &f)
	return f, err
}

func health(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) }

func main() {
	// Setup OpenTelemetry tracing (optional, enabled via TRACES_ENABLED=1)
	shutdown := telemetry.SetupTracing("projector")
	defer func() { _ = shutdown(context.Background()) }()

	log.Println("Starting projector service...")

	// Initialize database adapter
	dsn := os.Getenv("DATABASE_URL")
	var adapter *storage.Adapter
	var err error
	if dsn != "" {
		adapter, err = storage.NewAdapter(dsn)
		if err != nil {
			log.Fatalf("failed to create database adapter: %v", err)
		}
		defer adapter.Close()

		// Test connection
		if err := adapter.Ping(context.Background()); err != nil {
			log.Fatalf("adapter ping: %v", err)
		}

		// Ensure DDL schema
		if err := adapter.EnsureDDL(context.Background()); err != nil {
			log.Printf("ensure ddl: %v", err)
		}

		log.Printf("Database adapter initialized (mode: %v)", adapter.GetMode())
	} else {
		log.Println("DATABASE_URL not set, running without database")
	}
	p := &Projector{adapter: adapter}
	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	r.Get("/health", health)
	r.Post("/push", p.pushHandler)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
