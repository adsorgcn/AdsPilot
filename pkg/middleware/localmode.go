package middleware

import (
	"net"
	"net/http"
	"os"
	"strings"
)

// LocalModeUserID is the fixed identity attached to every request in the
// single-user local model. Handlers that key data by user ID keep working
// without a login system or gateway.
const LocalModeUserID = "local"

// LocalMode reports whether the process runs in the single-user local model
// (ADSPILOT_LOCAL=1): no gateway, no login, services listen on loopback only,
// and requests from this machine are attributed to LocalModeUserID.
func LocalMode() bool {
	v := strings.TrimSpace(os.Getenv("ADSPILOT_LOCAL"))
	return v == "1" || strings.EqualFold(v, "true")
}

// isLoopbackRequest reports whether the request came from this machine.
// In local mode servers bind to 127.0.0.1, so this is a second line of
// defense in case a caller runs the binary bound to a public interface.
func isLoopbackRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
