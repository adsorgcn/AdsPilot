package events

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/pubsub"
	"github.com/ScientificInternet/Google-Monetize/pkg/idempotency"
)

// HandlerFunc processes a single event envelope.
// Return nil on success to ack; return an error to nack with backoff.
type HandlerFunc func(ctx context.Context, env Envelope) error

// Subscriber is a minimal Pub/Sub pull subscriber that decodes Envelope messages
// and propagates X-Idempotency-Key (if present) into context for handlers.
type Subscriber struct {
	client  *pubsub.Client
	sub     *pubsub.Subscription
	handler HandlerFunc
}

// NewSubscriber initializes a subscriber using env vars:
//
//	GOOGLE_CLOUD_PROJECT, PUBSUB_SUBSCRIPTION_ID
//
// Optional tuning:
//
//	PUBSUB_CONCURRENCY (default 4), PUBSUB_MAX_OUTSTANDING (default 100)
func NewSubscriber(ctx context.Context, handler HandlerFunc) (*Subscriber, error) {
	projectID := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	subID := strings.TrimSpace(os.Getenv("PUBSUB_SUBSCRIPTION_ID"))
	if projectID == "" || subID == "" {
		return nil, fmt.Errorf("missing GOOGLE_CLOUD_PROJECT or PUBSUB_SUBSCRIPTION_ID")
	}
	c, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}
	s := c.Subscription(subID)
	// configure defaults (do not create subscription here to avoid unintended infra writes)
	s.ReceiveSettings.NumGoroutines = getEnvInt("PUBSUB_CONCURRENCY", 4)
	s.ReceiveSettings.MaxOutstandingMessages = getEnvInt("PUBSUB_MAX_OUTSTANDING", 100)
	return &Subscriber{client: c, sub: s, handler: handler}, nil
}

// Start begins receiving messages until ctx is cancelled.
func (s *Subscriber) Start(ctx context.Context) error {
	if s == nil || s.sub == nil || s.handler == nil {
		return fmt.Errorf("subscriber not initialized")
	}
	return s.sub.Receive(ctx, func(cctx context.Context, m *pubsub.Message) {
		// Extract idempotency key and attach to context
		if k := strings.TrimSpace(m.Attributes["idempotencyKey"]); k != "" {
			if idempotency.Validate(k) {
				cctx = idempotency.WithContext(cctx, k)
			}
		}
		// Try to parse as Envelope; if not, wrap raw payload
		var env Envelope
		if err := json.Unmarshal(m.Data, &env); err != nil || env.Type == "" {
			// wrap as envelope using attribute eventType
			env = Envelope{
				SpecVersion: "1.0",
				ID:          fmt.Sprintf("%d", time.Now().UnixNano()),
				Source:      m.Attributes["source"],
				Type:        m.Attributes["eventType"],
				Subject:     m.Attributes["subject"],
				Time:        time.Now().UTC(),
				Data:        json.RawMessage(m.Data),
			}
		}
		if err := s.handler(cctx, env); err != nil {
			m.Nack()
			return
		}
		m.Ack()
	})
}

// Close stops the subscriber client.
func (s *Subscriber) Close() error {
	if s == nil {
		return nil
	}
	if s.client != nil {
		return s.client.Close()
	}
	return nil
}

func getEnvInt(key string, def int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
