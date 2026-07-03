// Package provider defines the AffiliateProvider adapter contract and the shared
// data types used across affiliate networks. Each network (CJ first) implements
// AffiliateProvider; the rest of the system talks only to this interface, so
// per-network quirks (sub-id parameter name, deep-link format, length limits,
// deprecations) stay inside each implementation and its NetworkCapabilities.
//
// This is the upstream adaptation layer. See docs/affiliate-design.md.
package provider

import (
	"context"
	"time"
)

// AffiliateProvider is the per-network adapter contract.
type AffiliateProvider interface {
	// Name returns the network identifier, e.g. "cj".
	Name() string

	// Capabilities returns this network's sub-id and deep-link characteristics.
	Capabilities() NetworkCapabilities

	// BuildDeepLink returns a trackable affiliate deep link for the destination
	// URL, with the sub-id token placed in the network's sub-id parameter. This
	// is pure URL construction and involves no network call.
	BuildDeepLink(req DeepLinkRequest) (string, error)

	// ListAdvertisers returns advertisers/programs available to the account, for
	// offer discovery. It returns data only; ranking and selection are the AI's
	// job, not this layer's.
	ListAdvertisers(ctx context.Context, q AdvertiserQuery) ([]Advertiser, error)

	// SearchProducts returns products from advertiser feeds, for offer discovery.
	SearchProducts(ctx context.Context, q ProductQuery) ([]Product, error)

	// FetchCommissions returns commission/transaction records for reconciliation.
	// Each record carries the sub-id token back (Commission.SubID); the caller
	// joins it to the mapping store to recover the gclid and dimensions.
	FetchCommissions(ctx context.Context, q CommissionQuery) ([]Commission, error)
}

// DeepLinkRequest asks a provider to build a trackable deep link.
type DeepLinkRequest struct {
	// DestinationURL is the merchant/landing URL the user should end up at.
	DestinationURL string
	// AdvertiserID identifies the program/advertiser (network-specific id).
	AdvertiserID string
	// SubID is the portable tracking token to place in the network's sub-id
	// parameter. It should be at or below PortableSubIDMaxLen characters.
	SubID string
}

// AdvertiserQuery filters an advertiser lookup.
type AdvertiserQuery struct {
	// JoinedOnly, when true, limits results to advertisers the account has joined.
	JoinedOnly bool
	// Keyword is an optional free-text filter.
	Keyword string
	// Limit caps the number of results (0 = provider default).
	Limit int
}

// Advertiser is a program/advertiser available in a network.
type Advertiser struct {
	ID          string
	Name        string
	Category    string
	Joined      bool
	NetworkRank int
	SevenDayEPC float64
	ThreeMoEPC  float64
}

// ProductQuery filters a product search.
type ProductQuery struct {
	AdvertiserID string
	Keyword      string
	Limit        int
	// ColdDiscovery, when true, searches across the whole network's feeds rather
	// than only joined advertisers (e.g. CJ shoppingProductFeeds).
	ColdDiscovery bool
}

// Product is an offer from an advertiser feed.
type Product struct {
	ID           string
	AdvertiserID string
	Title        string
	Category     string
	Price        float64
	Currency     string
	LinkURL      string
	ImageURL     string
}

// CommissionQuery filters a commission/transaction pull for reconciliation.
type CommissionQuery struct {
	// Since and Before bound the posting-date range. Networks typically cap the
	// window (CJ: 31 days).
	Since  time.Time
	Before time.Time
}

// Commission is one commission/transaction record.
type Commission struct {
	CommissionID string
	OrderID      string
	AdvertiserID string
	// SubID is the tracking token that was set on the click's affiliate link. For
	// CJ this is read from the commission API's shopperId field.
	SubID string
	// Original is false for correction/reversal (chargeback) records. A reversal
	// shares OrderID with the original but has a different CommissionID and
	// negative amounts. Anti-fraud (design section III, layer 4) keys off this.
	Original      bool
	SaleAmountUSD float64
	CommissionUSD float64
	Currency      string
	PostingDate   time.Time
}
