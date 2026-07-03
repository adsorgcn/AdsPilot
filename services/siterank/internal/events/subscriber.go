// github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events/subscriber.go
package events

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"

	"cloud.google.com/go/pubsub"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
)

type Subscriber struct {
	client        *pubsub.Client
	db            *sql.DB
	publisher     *Publisher
	evalService   interface{} // *evaluation.Service
	billingClient interface{} // *billing.Client
}

func NewSubscriber(
	ctx context.Context,
	db *sql.DB,
	publisher *Publisher,
	evalService interface{},
	billingClient interface{},
) (*Subscriber, error) {
	projectID := GetProjectID()
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}
	return &Subscriber{
		client:        client,
		db:            db,
		publisher:     publisher,
		evalService:   evalService,
		billingClient: billingClient,
	}, nil
}

func (s *Subscriber) StartListening(ctx context.Context) {
	subscriptionID := os.Getenv("PUBSUB_SUBSCRIPTION")
	if subscriptionID == "" {
		log.Printf("PUBSUB_SUBSCRIPTION not set, skipping Pub/Sub listener")
		return
	}

	sub := s.client.Subscription(subscriptionID)
	log.Printf("Starting to listen for events on subscription: %s", subscriptionID)

	err := sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
		eventType := msg.Attributes["eventType"]
		log.Printf("Received event of type: %s", eventType)
		metrics.PubSubMessagesReceived.WithLabelValues(eventType).Inc()

		var err error
		switch eventType {
		case "WorkflowStepStarted":
			err = HandleWorkflowStepStarted(cctx, s.db, s.publisher, msg.Data)
		case "EvaluationTaskCreated":
			err = HandleEvaluationTaskCreated(cctx, s.evalService, s.billingClient, msg.Data)
		default:
			msg.Ack()
			return
		}

		if err != nil {
			log.Printf("Error processing event '%s': %v", eventType, err)
			metrics.PubSubMessagesProcessed.WithLabelValues(eventType, "failed").Inc()
			msg.Nack()
		} else {
			msg.Ack()
		}
	})
	if err != nil {
		log.Fatalf("Pub/Sub Receive error: %v", err)
	}
}
