// Package localpg boots an embedded PostgreSQL for the single-user local
// model (ADSPILOT_LOCAL=1), so a non-technical user never has to install or
// configure a database. Binaries are fetched once and cached under
// ~/.adspilot/pg; data persists across runs in ~/.adspilot/pg/data.
package localpg

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
)

const (
	defaultPort = 5517 // uncommon port to avoid clashing with a system PostgreSQL
	dbUser      = "adspilot"
	dbPassword  = "adspilot" // loopback-only, single-user; not a secret
	dbName      = "adspilot"
)

// StartIfNeeded starts an embedded PostgreSQL and returns its DSN plus a stop
// function. The port can be overridden with ADSPILOT_PG_PORT.
func StartIfNeeded() (string, func(), error) {
	port := defaultPort
	if v := strings.TrimSpace(os.Getenv("ADSPILOT_PG_PORT")); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil || p < 1 || p > 65535 {
			return "", nil, fmt.Errorf("invalid ADSPILOT_PG_PORT %q", v)
		}
		port = p
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", nil, fmt.Errorf("resolve home dir: %w", err)
	}
	baseDir := filepath.Join(home, ".adspilot", "pg")
	if err := os.MkdirAll(baseDir, 0o700); err != nil {
		return "", nil, fmt.Errorf("create %s: %w", baseDir, err)
	}

	cfg := embeddedpostgres.DefaultConfig().
		Version(embeddedpostgres.V16).
		Port(uint32(port)).
		Username(dbUser).
		Password(dbPassword).
		Database(dbName).
		// UTF-8 regardless of OS locale (migrations contain UTF-8 text; e.g.
		// Windows initdb would otherwise pick WIN1252 from a CJK system locale).
		// The C locale is compatible with any encoding.
		Encoding("UTF8").
		Locale("C").
		RuntimePath(filepath.Join(baseDir, "runtime")).
		DataPath(filepath.Join(baseDir, "data")).
		CachePath(filepath.Join(baseDir, "cache")).
		StartTimeout(90 * time.Second).
		Logger(log.Writer())

	pg := embeddedpostgres.NewDatabase(cfg)
	log.Printf("localpg: starting embedded PostgreSQL on 127.0.0.1:%d (data: %s)", port, filepath.Join(baseDir, "data"))
	if err := pg.Start(); err != nil {
		return "", nil, fmt.Errorf("start embedded postgres (try a different ADSPILOT_PG_PORT if the port is busy): %w", err)
	}

	stop := func() {
		if err := pg.Stop(); err != nil {
			log.Printf("localpg: stop embedded postgres: %v", err)
		}
	}
	dsn := fmt.Sprintf("postgres://%s:%s@127.0.0.1:%d/%s?sslmode=disable", dbUser, dbPassword, port, dbName)
	return dsn, stop, nil
}
