// Package secrets resolves Google Ads credential secret names to their values.
//
// It is a thin wrapper over pkg/config's Secret Manager helper so that secret
// resolution (full resource path, or "<name>" / "<name>:<version>" shorthand)
// stays consistent across services. Callers pass the value of a *_SECRET_NAME
// environment variable and receive the secret payload.
//
// This directory is force-added to git: .gitignore excludes any "secrets/"
// directory, so committing files here requires `git add -f`.
package secrets

import (
	"context"

	appconfig "github.com/ScientificInternet/Google-Monetize/pkg/config"
)

// Get resolves a Secret Manager secret name to its string payload. It accepts a
// full resource name (projects/<project>/secrets/<name>/versions/<ver>) or the
// shorthand "<name>" (latest) / "<name>:<version>".
func Get(ctx context.Context, name string) (string, error) {
	return appconfig.Secret(ctx, name)
}
