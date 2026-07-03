package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Handler returns an HTTP handler for the Prometheus metrics endpoint
func Handler() http.Handler {
	return promhttp.Handler()
}
