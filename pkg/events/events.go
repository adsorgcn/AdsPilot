package events

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"cloud.google.com/go/pubsub"
	"github.com/ScientificInternet/Google-Monetize/pkg/idempotency"
)

// Envelope is a minimal, versioned event envelope for cross-service publishing.
// It keeps the payload flexible while enforcing common metadata.
type Envelope struct {
	SpecVersion string      `json:"specVersion"`
	ID          string      `json:"id"`
	Source      string      `json:"source,omitempty"`
	Type        string      `json:"type"`
	Subject     string      `json:"subject,omitempty"`
	Time        time.Time   `json:"time"`
	Data        interface{} `json:"data"`
}

// NewEnvelope creates a new envelope for the given event name and data.
func NewEnvelope(eventType string, data interface{}, opts ...Option) Envelope {
	e := Envelope{SpecVersion: "1.0", ID: fmt.Sprintf("%d", time.Now().UnixNano()), Type: eventType, Time: time.Now().UTC(), Data: data}
	cfg := &config{}
	for _, o := range opts {
		o(cfg)
	}
	if cfg.source != "" {
		e.Source = cfg.source
	}
	if cfg.subject != "" {
		e.Subject = cfg.subject
	}
	return e
}

// UnmarshalData decodes the Envelope.Data field into the provided generic type.
// If Data is already a map or []byte/JSON string, it attempts to decode accordingly.
func UnmarshalData[T interface{}](e Envelope, dst *T) error {
	if dst == nil {
		return fmt.Errorf("nil dst")
	}
	switch v := e.Data.(type) {
	case nil:
		var zero T
		*dst = zero
		return nil
	case json.RawMessage:
		return json.Unmarshal(v, dst)
	case []byte:
		return json.Unmarshal(v, dst)
	case string:
		return json.Unmarshal([]byte(v), dst)
	default:
		// marshal then unmarshal to target
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		return json.Unmarshal(b, dst)
	}
}

type Publisher struct {
	client *pubsub.Client
	topic  *pubsub.Topic
}

// NewPublisher initializes a Pub/Sub publisher using env vars:
//
//	GOOGLE_CLOUD_PROJECT, PUBSUB_TOPIC_ID
func NewPublisher(ctx context.Context) (*Publisher, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	topicID := os.Getenv("PUBSUB_TOPIC_ID")
	if projectID == "" || topicID == "" {
		return nil, fmt.Errorf("missing GOOGLE_CLOUD_PROJECT or PUBSUB_TOPIC_ID")
	}
	c, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}
	t := c.Topic(topicID)
	return &Publisher{client: c, topic: t}, nil
}

// Publish wraps the data into an Envelope and publishes.
func (p *Publisher) Publish(ctx context.Context, eventType string, data interface{}, opts ...Option) error {
	if p == nil || p.topic == nil {
		return nil
	}
	env := NewEnvelope(eventType, data, opts...)
	b, err := json.Marshal(env)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}
	attrs := map[string]string{"eventType": eventType, "specVersion": env.SpecVersion}
	if k, ok := idempotency.FromContext(ctx); ok && k != "" {
		attrs["idempotencyKey"] = k
	}
	msg := &pubsub.Message{Data: b, Attributes: attrs}
	_, err = p.topic.Publish(ctx, msg).Get(ctx)
	return err
}

func (p *Publisher) Close() {
	if p == nil {
		return
	}
	if p.topic != nil {
		p.topic.Stop()
	}
	if p.client != nil {
		_ = p.client.Close()
	}
}

// Common event names (B1.2 标准事件集)
const (
	EventUserRegistered           = "UserRegistered"
	EventOfferCreated             = "OfferCreated"
	EventSiterankRequested        = "SiterankRequested"
	EventSiterankCompleted        = "SiterankCompleted"
	EventBatchOpsTaskQueued       = "BatchOpsTaskQueued"
	EventBatchOpsTaskStarted      = "BatchOpsTaskStarted"
	EventBatchOpsTaskCompleted    = "BatchOpsTaskCompleted"
	EventBatchOpsTaskFailed       = "BatchOpsTaskFailed"
	EventBrowserExecRequested     = "BrowserExecRequested"
	EventBrowserExecCompleted     = "BrowserExecCompleted"
	EventTokenReserved            = "TokenReserved"
	EventTokenDebited             = "TokenDebited"
	EventTokenReverted            = "TokenReverted"
	EventWorkflowStarted          = "WorkflowStarted"
	EventWorkflowStepCompleted    = "WorkflowStepCompleted"
	EventWorkflowCompleted        = "WorkflowCompleted"
	EventNotificationCreated      = "NotificationCreated"
	EventNotificationSent         = "NotificationSent"
	EventTokenConsistencyRepaired = "TokenConsistencyRepaired"
)

// Options for envelope metadata
type Option func(*config)
type config struct{ source, subject string }

func WithSource(s string) Option  { return func(c *config) { c.source = s } }
func WithSubject(s string) Option { return func(c *config) { c.subject = s } }
