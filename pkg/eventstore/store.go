package eventstore

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

var (
	// ErrConcurrencyConflict indicates the expected aggregate version does not match the stored version.
	ErrConcurrencyConflict = errors.New("eventstore: concurrency conflict")
)

// Event represents a persisted domain event.
type Event struct {
	ID            string
	Name          string
	AggregateID   string
	AggregateType string
	Version       int
	Payload       json.RawMessage
	Metadata      json.RawMessage
	OccurredAt    time.Time
}

// UncommittedEvent carries event data before persistence.
type UncommittedEvent struct {
	ID         string
	Name       string
	Version    int
	Payload    any
	Metadata   map[string]any
	OccurredAt time.Time
}

// Snapshot captures an aggregate snapshot for faster rebuild.
type Snapshot struct {
	AggregateType string
	AggregateID   string
	Version       int
	State         json.RawMessage
	Metadata      json.RawMessage
	UpdatedAt     time.Time
}

// AppendResult contains metadata returned after appending events.
type AppendResult struct {
	Events         []Event
	CurrentVersion int
}

// Store defines the contract for an event store backend.
type Store interface {
	// EnsureSchema guarantees the underlying tables/indexes exist.
	EnsureSchema(ctx context.Context) error

	// Append appends events to an aggregate stream. expectedVersion is the current version
	// prior to appending (0 for new aggregates). It returns persisted events and the new version.
	Append(ctx context.Context, aggregateType, aggregateID string, expectedVersion int, events []UncommittedEvent) (AppendResult, error)

	// Load retrieves events for an aggregate starting from the specified version (inclusive).
	Load(ctx context.Context, aggregateType, aggregateID string, fromVersion int) ([]Event, error)

	// LoadSnapshot returns the most recent snapshot for an aggregate, if any.
	LoadSnapshot(ctx context.Context, aggregateType, aggregateID string) (*Snapshot, error)

	// SaveSnapshot persists a snapshot.
	SaveSnapshot(ctx context.Context, snap Snapshot) error
}
