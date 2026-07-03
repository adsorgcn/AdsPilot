package logger

import (
	"os"
	"sync"

	"github.com/rs/zerolog"
)

var (
	once sync.Once
	lg   zerolog.Logger
)

// Get returns a process-wide zerolog JSON logger with sane defaults.
func Get() zerolog.Logger {
	once.Do(func() {
		// JSON logs; level via LOG_LEVEL, default info
		lvl := os.Getenv("LOG_LEVEL")
		level, err := zerolog.ParseLevel(lvl)
		if err != nil {
			level = zerolog.InfoLevel
		}
		zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
		l := zerolog.New(os.Stdout).With().Timestamp().Logger().Level(level)
		lg = l
	})
	return lg
}
