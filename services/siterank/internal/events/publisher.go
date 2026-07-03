// github.com/ScientificInternet/Google-Monetize/services/siterank/internal/events/publisher.go
package events

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"cloud.google.com/go/pubsub"
)

type Publisher struct {
	client *pubsub.Client
	topic  *pubsub.Topic
}

func NewPublisher(ctx context.Context) (*Publisher, error) {
	projectID := GetProjectID()
	topicID := os.Getenv("PUBSUB_TOPIC_ID")

	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}
	topic := client.Topic(topicID)

	return &Publisher{client: client, topic: topic}, nil
}

func (p *Publisher) Publish(ctx context.Context, eventType string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}
	msg := &pubsub.Message{
		Data:       data,
		Attributes: map[string]string{"eventType": eventType},
	}
	_, err = p.topic.Publish(ctx, msg).Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	return nil
}

func (p *Publisher) Close() {
	if p.topic != nil {
		p.topic.Stop()
	}
	if p.client != nil {
		p.client.Close()
	}
}
