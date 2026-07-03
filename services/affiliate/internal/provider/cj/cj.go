// Package cj implements the AffiliateProvider interface for CJ (Commission
// Junction). Authentication is BYOC: the user supplies their own Personal Access
// Token and Company ID, which are held locally with zero server retention.
//
// See docs/affiliate-design.md. This is the first-implementation skeleton: the
// deep-link builder is complete; the data-access methods (advertiser lookup,
// product search, commission detail) are stubbed and wired to CJ's GraphQL/REST
// endpoints in a later step.
package cj

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/services/affiliate/internal/provider"
)

// CJ API endpoints (wired in a later step).
const (
	// productsEndpoint is the GraphQL endpoint for products, feeds, and advertiser
	// discovery.
	productsEndpoint = "https://ads.api.cj.com/query"
	// commissionsEndpoint is the GraphQL endpoint for commission detail.
	commissionsEndpoint = "https://commissions.api.cj.com/query"
	// advertiserLookupURL is the REST advertiser lookup endpoint.
	advertiserLookupURL = "https://advertiser-lookup.api.cj.com/v2/advertiser-lookup"
	// deepLinkBase is CJ's click/deep-link host.
	deepLinkBase = "https://www.anrdoezrs.net"
)

// errNotImplemented marks methods whose network wiring is not built yet.
var errNotImplemented = errors.New("cj: not implemented yet")

// Provider is the CJ implementation of provider.AffiliateProvider.
type Provider struct {
	pat        string // Personal Access Token (Bearer)
	companyID  string // Company ID (CID)
	httpClient *http.Client
}

// New creates a CJ provider. pat is the user's Personal Access Token, companyID
// is their CID. Both are BYOC and should be sourced from local credential
// storage, never retained server-side.
func New(pat, companyID string) *Provider {
	return &Provider{
		pat:        strings.TrimSpace(pat),
		companyID:  strings.TrimSpace(companyID),
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Name returns "cj".
func (p *Provider) Name() string { return "cj" }

// Capabilities returns CJ's sub-id and deep-link characteristics.
func (p *Provider) Capabilities() provider.NetworkCapabilities {
	return provider.KnownNetworks["cj"]
}

// BuildDeepLink builds a CJ deep link to the destination URL with the tracking
// token in CJ's sub-id parameter (sid). The URL parameter stays "sid"; only the
// commission-read side uses the newer shopperId field.
//
// CJ deep-link form:
//
//	https://www.anrdoezrs.net/links/<advertiser>/type/dlg/sid/<token>/<destination>
//
// where <destination> is URL-encoded.
func (p *Provider) BuildDeepLink(req provider.DeepLinkRequest) (string, error) {
	dest := strings.TrimSpace(req.DestinationURL)
	if dest == "" {
		return "", errors.New("cj: destination URL is required")
	}
	if strings.TrimSpace(req.AdvertiserID) == "" {
		return "", errors.New("cj: advertiser id is required")
	}
	var b strings.Builder
	b.WriteString(deepLinkBase)
	b.WriteString("/links/")
	b.WriteString(url.PathEscape(req.AdvertiserID))
	b.WriteString("/type/dlg/sid/")
	b.WriteString(url.PathEscape(req.SubID))
	b.WriteString("/")
	b.WriteString(url.QueryEscape(dest))
	return b.String(), nil
}

// ListAdvertisers is not implemented yet. Wiring uses CJ's Advertiser Lookup REST
// endpoint plus Program Terms for accurate commission rates.
func (p *Provider) ListAdvertisers(ctx context.Context, q provider.AdvertiserQuery) ([]provider.Advertiser, error) {
	return nil, errNotImplemented
}

// SearchProducts is not implemented yet. Wiring uses CJ's Product Feed GraphQL:
// cold discovery via shoppingProductFeeds, joined-only via products.
func (p *Provider) SearchProducts(ctx context.Context, q provider.ProductQuery) ([]provider.Product, error) {
	return nil, errNotImplemented
}

// FetchCommissions is not implemented yet. Wiring uses CJ's Commission Detail
// GraphQL; the sub-id is read from the shopperId field, and original=false
// records are reversals/chargebacks.
func (p *Provider) FetchCommissions(ctx context.Context, q provider.CommissionQuery) ([]provider.Commission, error) {
	return nil, errNotImplemented
}

// compile-time check that Provider implements AffiliateProvider.
var _ provider.AffiliateProvider = (*Provider)(nil)
