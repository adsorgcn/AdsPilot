package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
)

func TestUnimplementedWorkerEndpointsNeverSucceed(t *testing.T) {
	handler := NewExecutorHandler(nil)
	for name, handle := range map[string]http.HandlerFunc{
		"next shard":  handler.HandleExecuteNextShard,
		"tick":        handler.HandleExecuteTick,
		"retry":       handler.HandleRetryDeadLetter,
		"retry batch": handler.HandleRetryDeadLetterBatch,
	} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/adscenter/bulk-actions/operation/execute-next", nil)
			req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "test-user"))
			w := httptest.NewRecorder()
			handle(w, req)
			if w.Code != http.StatusNotImplemented {
				t.Fatalf("false worker success: %d %s", w.Code, w.Body.String())
			}
		})
	}
}
