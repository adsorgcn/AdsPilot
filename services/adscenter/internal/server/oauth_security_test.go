package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOAuthAuthExemptionIsLocalOnly(t *testing.T) {
	for _, tc := range []struct {
		name, mode, peer, host string
		want                   int
	}{
		{"local loopback", "1", "127.0.0.1:45000", "127.0.0.1:8080", 204},
		{"nonlocal adapter", "0", "127.0.0.1:45000", "127.0.0.1:8080", 404},
		{"remote caller", "1", "203.0.113.4:45000", "127.0.0.1:8080", 403},
		{"untrusted host", "1", "127.0.0.1:45000", "attacker.example", 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("ADSPILOT_LOCAL", tc.mode)
			called := false
			h := authExceptLocalOAuth(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { called = true; w.WriteHeader(204) }))
			r := httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/v1/adscenter/oauth/revoke", nil)
			r.RemoteAddr, r.Host = tc.peer, tc.host
			r.Header.Set("X-User-ID", "forged-local-user")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != tc.want || called != (tc.want == 204) {
				t.Fatalf("OAuth exemption escaped boundary: %d called=%v", w.Code, called)
			}
		})
	}
}
