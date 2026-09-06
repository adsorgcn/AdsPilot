//go:build !ads_live

package ads

import (
	"context"
	"errors"
	"testing"
)

func TestStubReportsUnavailable(t *testing.T) {
	ctx := context.Background()
	if client, err := NewClient(ctx, LiveConfig{DeveloperToken: "present"}); client != nil || !errors.Is(err, ErrLiveUnavailable) {
		t.Fatalf("live constructor silently returned a stub: %v %v", client, err)
	}
	client := NewClientStub()
	for name, call := range map[string]func() error{
		"invite": func() error { return client.SendManagerLinkInvitation(ctx, "123") },
		"remove": func() error { return client.RemoveManagerLink(ctx, "123") },
		"pause":  func() error { return client.SetAdGroupStatus(ctx, "123", "456", true) },
		"ping":   func() error { return client.AdsAPIPing(ctx) },
	} {
		if err := call(); !errors.Is(err, ErrLiveUnavailable) {
			t.Fatalf("%s falsely succeeded: %v", name, err)
		}
	}
	if id, err := client.CopyAdGroupMinimal(ctx, "123", "456", "_B"); id != "" || !errors.Is(err, ErrLiveUnavailable) {
		t.Fatalf("synthetic ad group returned: %q %v", id, err)
	}
	if ideas, err := client.KeywordIdeas(ctx, "example.com", []string{"cars"}); len(ideas) != 0 || !errors.Is(err, ErrLiveUnavailable) {
		t.Fatalf("fabricated keyword metrics returned: %v %v", ideas, err)
	}
	if customers, err := client.ListAccessibleCustomers(ctx); customers != nil || !errors.Is(err, ErrLiveUnavailable) {
		t.Fatalf("unavailable customer list falsely succeeded: %v %v", customers, err)
	}
}
