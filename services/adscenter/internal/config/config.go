package config

import (
	"context"
	"fmt"
	"os"

	secretmanager "cloud.google.com/go/secretmanager/apiv1"
	"cloud.google.com/go/secretmanager/apiv1/secretmanagerpb"
	"github.com/ScientificInternet/Google-Monetize/pkg/dburl"
)

type Config struct {
	DatabaseURL  string
	DBAdminURL   string
	DBAdminToken string
	Port         string
	ProjectID    string
}

func Load(ctx context.Context) (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	var databaseURL string
	if sec := os.Getenv("DATABASE_URL_SECRET_NAME"); sec != "" {
		s, err := accessSecretVersion(ctx, sec)
		if err != nil {
			return nil, fmt.Errorf("read secret: %w", err)
		}
		databaseURL = s
	} else {
		databaseURL = os.Getenv("DATABASE_URL")
	}
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set (or DATABASE_URL_SECRET_NAME missing)")
	}

	// Apply DB_NAME override if specified (for logical database isolation)
	databaseURL = dburl.RewriteIfNeeded(databaseURL)

	// Load DBAdmin configuration
	var dbAdminURL, dbAdminToken string
	if sec := os.Getenv("DB_ADMIN_URL_SECRET_NAME"); sec != "" {
		s, err := accessSecretVersion(ctx, sec)
		if err != nil {
			return nil, fmt.Errorf("read DB admin URL secret: %w", err)
		}
		dbAdminURL = s
	} else {
		dbAdminURL = os.Getenv("DB_ADMIN_URL")
	}

	if sec := os.Getenv("DB_ADMIN_TOKEN_SECRET_NAME"); sec != "" {
		s, err := accessSecretVersion(ctx, sec)
		if err != nil {
			return nil, fmt.Errorf("read DB admin token secret: %w", err)
		}
		dbAdminToken = s
	} else {
		dbAdminToken = os.Getenv("DB_ADMIN_TOKEN")
	}

	return &Config{
		DatabaseURL:  databaseURL,
		DBAdminURL:   dbAdminURL,
		DBAdminToken: dbAdminToken,
		Port:         port,
		ProjectID:    os.Getenv("GOOGLE_CLOUD_PROJECT"),
	}, nil
}

func accessSecretVersion(ctx context.Context, name string) (string, error) {
	client, err := secretmanager.NewClient(ctx)
	if err != nil {
		return "", err
	}
	defer client.Close()
	res, err := client.AccessSecretVersion(ctx, &secretmanagerpb.AccessSecretVersionRequest{Name: name})
	if err != nil {
		return "", err
	}
	return string(res.Payload.Data), nil
}
