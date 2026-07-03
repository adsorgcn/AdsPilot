package config

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"cloud.google.com/go/pubsub"
	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
)

var zlog = logger.Get()

// ConfigUpdateMessage represents a configuration update notification
type ConfigUpdateMessage struct {
	Action     string    `json:"action"`
	ConfigPath string    `json:"config_path"`
	Timestamp  time.Time `json:"timestamp"`
	Version    string    `json:"version"`
}

// ConfigSubscriber listens for configuration update messages via Pub/Sub
type ConfigSubscriber struct {
	client         *pubsub.Client
	subscription   *pubsub.Subscription
	configManager  *ConfigManager
	subscriptionID string
}

// NewConfigSubscriber creates a new configuration subscriber
func NewConfigSubscriber(ctx context.Context, projectID, subscriptionID string, configManager *ConfigManager) (*ConfigSubscriber, error) {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create pubsub client: %w", err)
	}

	subscription := client.Subscription(subscriptionID)

	// Check if subscription exists
	exists, err := subscription.Exists(ctx)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to check subscription existence: %w", err)
	}

	if !exists {
		zlog.Warn().
			Str("subscription_id", subscriptionID).
			Msg("Pub/Sub subscription does not exist - config hot reload disabled")
		client.Close()
		return nil, fmt.Errorf("subscription %s does not exist", subscriptionID)
	}

	return &ConfigSubscriber{
		client:         client,
		subscription:   subscription,
		configManager:  configManager,
		subscriptionID: subscriptionID,
	}, nil
}

// Start begins listening for configuration update messages
func (cs *ConfigSubscriber) Start(ctx context.Context) error {
	zlog.Info().
		Str("subscription_id", cs.subscriptionID).
		Msg("Starting config update subscriber")

	err := cs.subscription.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		// Parse message
		var updateMsg ConfigUpdateMessage
		if err := json.Unmarshal(msg.Data, &updateMsg); err != nil {
			zlog.Error().
				Err(err).
				Str("message_id", msg.ID).
				Msg("Failed to parse config update message")
			msg.Nack()
			return
		}

		zlog.Info().
			Str("action", updateMsg.Action).
			Str("config_path", updateMsg.ConfigPath).
			Time("timestamp", updateMsg.Timestamp).
			Str("version", updateMsg.Version).
			Msg("Received config update message")

		// Handle reload action
		if updateMsg.Action == "reload_config" {
			if err := cs.handleConfigReload(ctx, &updateMsg); err != nil {
				zlog.Error().
					Err(err).
					Str("message_id", msg.ID).
					Msg("Failed to reload config")
				msg.Nack()
				return
			}

			zlog.Info().
				Str("message_id", msg.ID).
				Int64("new_version", cs.configManager.GetVersion()).
				Msg("Config reloaded successfully")
			msg.Ack()
		} else {
			zlog.Warn().
				Str("action", updateMsg.Action).
				Msg("Unknown config update action")
			msg.Ack() // Ack unknown messages to prevent redelivery
		}
	})

	if err != nil {
		return fmt.Errorf("failed to receive messages: %w", err)
	}

	return nil
}

// handleConfigReload performs the configuration reload
func (cs *ConfigSubscriber) handleConfigReload(ctx context.Context, msg *ConfigUpdateMessage) error {
	// Reload configuration from disk
	if err := cs.configManager.Reload(ctx); err != nil {
		return fmt.Errorf("failed to reload config: %w", err)
	}

	zlog.Info().
		Str("config_path", msg.ConfigPath).
		Str("version", msg.Version).
		Int64("manager_version", cs.configManager.GetVersion()).
		Msg("Configuration reloaded successfully")

	return nil
}

// Close closes the subscriber and releases resources
func (cs *ConfigSubscriber) Close() error {
	if cs.client != nil {
		return cs.client.Close()
	}
	return nil
}

// PublishConfigUpdate publishes a configuration update message (for testing/manual triggers)
func PublishConfigUpdate(ctx context.Context, projectID, topicID, configPath, version string) error {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return fmt.Errorf("failed to create pubsub client: %w", err)
	}
	defer client.Close()

	topic := client.Topic(topicID)

	msg := ConfigUpdateMessage{
		Action:     "reload_config",
		ConfigPath: configPath,
		Timestamp:  time.Now(),
		Version:    version,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	result := topic.Publish(ctx, &pubsub.Message{
		Data: data,
	})

	// Wait for publish to complete
	_, err = result.Get(ctx)
	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	zlog.Info().
		Str("topic_id", topicID).
		Str("config_path", configPath).
		Str("version", version).
		Msg("Published config update message")

	return nil
}
