// Package localcreds stores the user's Google Ads OAuth refresh token on the
// user's own machine, with restrictive file permissions and zero server-side
// retention.
//
// This follows the same principle as the Claude Code CLI, which keeps
// credentials in a local file (for example ~/.claude/.credentials.json, mode
// 0600) rather than on any server. The token never leaves the user's device.
package localcreds

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Credential is the locally stored OAuth material. It never leaves the machine.
type Credential struct {
	RefreshToken string    `json:"refresh_token"`
	Scope        string    `json:"scope,omitempty"`
	ObtainedAt   time.Time `json:"obtained_at"`
	ClientID     string    `json:"client_id,omitempty"`
}

// ErrNotFound is returned by Load when no credential file exists yet.
var ErrNotFound = errors.New("localcreds: no stored credential")

// Path returns the credential file path. It honors ADSPILOT_CREDENTIALS_PATH,
// otherwise defaults to ~/.adspilot/credentials.json.
func Path() (string, error) {
	if p := strings.TrimSpace(os.Getenv("ADSPILOT_CREDENTIALS_PATH")); p != "" {
		return p, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".adspilot", "credentials.json"), nil
}

// Save writes the credential to the local file with mode 0600, creating the
// parent directory (mode 0700) if needed. It writes to a temp file and renames,
// so the destination is never left partially written.
func Save(c Credential) error {
	p, err := Path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	tmp := p + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// Load reads the credential from the local file. It returns ErrNotFound if the
// file does not exist.
func Load() (Credential, error) {
	var c Credential
	p, err := Path()
	if err != nil {
		return c, err
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return c, ErrNotFound
		}
		return c, err
	}
	if err := json.Unmarshal(data, &c); err != nil {
		return c, err
	}
	return c, nil
}

// Delete removes the local credential file. A missing file is not an error.
func Delete() error {
	p, err := Path()
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
