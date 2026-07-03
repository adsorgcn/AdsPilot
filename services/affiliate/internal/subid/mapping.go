package subid

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// MappingRecord is what a tracking token points to. The token goes into the
// affiliate sub-id; everything else stays here. GCLID is the join key back to
// Google Ads (offline conversion import and report-level attribution).
type MappingRecord struct {
	Token     string    `json:"token"`
	GCLID     string    `json:"gclid,omitempty"`
	Network   string    `json:"network,omitempty"`
	OfferID   string    `json:"offer_id,omitempty"`
	Campaign  string    `json:"campaign,omitempty"`
	AdGroup   string    `json:"ad_group,omitempty"`
	Keyword   string    `json:"keyword,omitempty"`
	Page      string    `json:"page,omitempty"`
	IP        string    `json:"ip,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// ErrNotFound is returned by a MappingStore when a token is not present.
var ErrNotFound = errors.New("subid: token not found")

// MappingStore persists the token to MappingRecord mapping. The concrete backend
// (local file, local SQLite, or the user's edge storage) is a deployment choice,
// deferred per docs/affiliate-design.md; this interface keeps callers
// backend-agnostic.
type MappingStore interface {
	Put(ctx context.Context, rec MappingRecord) error
	Get(ctx context.Context, token string) (MappingRecord, error)
}

// FileStore is a provisional local, file-backed MappingStore for development. It
// keeps records in memory and persists them to a single JSON file (mode 0600,
// zero server retention, consistent with the credential model). It is not
// intended for high click volume; a local SQLite or edge-backed store will
// replace it (see design spec open items).
type FileStore struct {
	mu   sync.Mutex
	path string
	recs map[string]MappingRecord
}

// OpenFileStore opens (or creates) a file-backed store at path. If path is empty
// it defaults to ~/.adspilot/subid.json.
func OpenFileStore(path string) (*FileStore, error) {
	if strings.TrimSpace(path) == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		path = filepath.Join(home, ".adspilot", "subid.json")
	}
	fs := &FileStore{path: path, recs: map[string]MappingRecord{}}
	if err := fs.load(); err != nil {
		return nil, err
	}
	return fs, nil
}

func (s *FileStore) load() error {
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	return json.Unmarshal(data, &s.recs)
}

func (s *FileStore) persist() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.recs, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

// Put stores a record, stamping CreatedAt if unset.
func (s *FileStore) Put(ctx context.Context, rec MappingRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = time.Now()
	}
	s.recs[rec.Token] = rec
	return s.persist()
}

// Get returns the record for a token, or ErrNotFound.
func (s *FileStore) Get(ctx context.Context, token string) (MappingRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec, ok := s.recs[token]
	if !ok {
		return MappingRecord{}, ErrNotFound
	}
	return rec, nil
}

// compile-time check that FileStore implements MappingStore.
var _ MappingStore = (*FileStore)(nil)
