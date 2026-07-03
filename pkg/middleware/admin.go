package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
)

// AdminOnly ensures the requester is an admin based on allowlists.
// Allow sources:
// - SUPER_ADMIN_EMAIL (single)
// - ADMIN_EMAILS (comma-separated)
// - ADMIN_UIDS (comma-separated uid list)
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Allow internal automation via X-Service-Token when matches INTERNAL_SERVICE_TOKEN
		if tok := strings.TrimSpace(r.Header.Get("X-Service-Token")); tok != "" && tok == strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")) {
			next.ServeHTTP(w, r)
			return
		}
		uid, ok := GetUserIDFromContext(r.Context())
		email, _ := GetUserEmailFromContext(r.Context())
		if !ok {
			if claims, ok := supabaseauth.ClaimsFromContext(r.Context()); ok {
				uid = claims.UserID
				email = claims.Email
			} else {
				claims, err := supabaseauth.DefaultVerifier().VerifyRequest(r.Context(), r)
				if err != nil || strings.TrimSpace(claims.UserID) == "" {
					errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required", nil)
					return
				}
				uid = claims.UserID
				email = claims.Email
			}
		}

		// email-based checks
		if isEmailAdmin(email) || isUIDAdmin(uid) {
			next.ServeHTTP(w, r)
			return
		}
		errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "Admin role required", nil)
	})
}

func isEmailAdmin(email string) bool {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return false
	}
	if sa := strings.TrimSpace(strings.ToLower(os.Getenv("SUPER_ADMIN_EMAIL"))); sa != "" && sa == email {
		return true
	}
	if list := os.Getenv("ADMIN_EMAILS"); list != "" {
		for _, e := range strings.Split(list, ",") {
			if strings.TrimSpace(strings.ToLower(e)) == email {
				return true
			}
		}
	}
	return false
}

func isUIDAdmin(uid string) bool {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return false
	}
	if list := os.Getenv("ADMIN_UIDS"); list != "" {
		for _, u := range strings.Split(list, ",") {
			if strings.TrimSpace(u) == uid {
				return true
			}
		}
	}
	return false
}
