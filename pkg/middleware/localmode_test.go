package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func callAuthed(t *testing.T, remoteAddr, headerUserID string) (int, string) {
	t.Helper()
	var gotUserID string
	h := GatewayAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUserID, _ = r.Context().Value(UserIDKey).(string)
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = remoteAddr
	if headerUserID != "" {
		req.Header.Set("X-User-ID", headerUserID)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code, gotUserID
}

func TestGatewayAuthRejectsWithoutHeaderByDefault(t *testing.T) {
	t.Setenv("ADSPILOT_LOCAL", "")
	code, _ := callAuthed(t, "127.0.0.1:54321", "")
	if code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", code)
	}
}

func TestLocalModeInjectsLocalUserForLoopback(t *testing.T) {
	t.Setenv("ADSPILOT_LOCAL", "1")
	code, user := callAuthed(t, "127.0.0.1:54321", "")
	if code != http.StatusOK {
		t.Fatalf("expected 200, got %d", code)
	}
	if user != LocalModeUserID {
		t.Fatalf("expected user %q, got %q", LocalModeUserID, user)
	}

	// IPv6 loopback works too
	code, user = callAuthed(t, "[::1]:54321", "")
	if code != http.StatusOK || user != LocalModeUserID {
		t.Fatalf("ipv6 loopback: expected 200/%q, got %d/%q", LocalModeUserID, code, user)
	}
}

func TestLocalModeStillRejectsNonLoopback(t *testing.T) {
	t.Setenv("ADSPILOT_LOCAL", "1")
	code, _ := callAuthed(t, "192.168.1.50:54321", "")
	if code != http.StatusUnauthorized {
		t.Fatalf("expected 401 for non-loopback in local mode, got %d", code)
	}
}

func TestLocalModeHeaderStillWins(t *testing.T) {
	t.Setenv("ADSPILOT_LOCAL", "1")
	code, user := callAuthed(t, "127.0.0.1:54321", "user-from-gateway")
	if code != http.StatusOK || user != "user-from-gateway" {
		t.Fatalf("expected 200/user-from-gateway, got %d/%q", code, user)
	}
}
