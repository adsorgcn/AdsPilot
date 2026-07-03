package provider

// NetworkCapabilities describes a network's sub-id and deep-link characteristics.
// This is the network capability registry from docs/affiliate-design.md: it
// captures the per-network differences the adaptation layer must normalize.
type NetworkCapabilities struct {
	// Network is the network identifier, e.g. "cj".
	Network string
	// SubIDParam is the URL parameter used to set the sub-id, e.g. "sid" for CJ.
	SubIDParam string
	// SubIDReadField is the field name to read the sub-id back from the network's
	// commission API, when it differs from SubIDParam. For CJ this is "shopperId"
	// (the commission API's "sid" field is deprecated). Empty means it matches
	// SubIDParam.
	SubIDReadField string
	// SubIDSlots is how many sub-id parameters the network accepts (CJ: 1).
	SubIDSlots int
	// SubIDMaxLen is the max sub-id length in characters (0 = unknown/unspecified).
	SubIDMaxLen int
	// Notes records deprecations and special cases.
	Notes string
}

// PortableSubIDMaxLen is the safe sub-id length ceiling across networks. An
// alphanumeric token at or below this length fits every supported network's
// sub-id parameter, so tokens are generated to this bound (see subid.NewToken).
const PortableSubIDMaxLen = 32

// KnownNetworks is a reference registry of sub-id characteristics for major
// affiliate networks, compiled from public documentation. Each provider treats
// its own Capabilities() as authoritative; this table is for reference and
// portability checks and must be verified against each network's current docs.
var KnownNetworks = map[string]NetworkCapabilities{
	"cj": {
		Network:        "cj",
		SubIDParam:     "sid",
		SubIDReadField: "shopperId",
		SubIDSlots:     1,
		Notes:          "commission API field 'sid' is deprecated; read 'shopperId'. Verify max length against CJ docs.",
	},
	"rakuten":      {Network: "rakuten", SubIDParam: "u1", SubIDSlots: 1, SubIDMaxLen: 72},
	"awin":         {Network: "awin", SubIDParam: "clickref", SubIDSlots: 6, SubIDMaxLen: 50},
	"shareasale":   {Network: "shareasale", SubIDParam: "afftrack", SubIDSlots: 1},
	"impact":       {Network: "impact", SubIDParam: "subId1", SubIDSlots: 5, SubIDMaxLen: 64},
	"tradedoubler": {Network: "tradedoubler", SubIDParam: "epi", SubIDSlots: 2},
	"ebay":         {Network: "ebay", SubIDParam: "customid", SubIDSlots: 1},
	"amazon":       {Network: "amazon", SubIDSlots: 0, Notes: "no sub-id support; uses Tracking IDs (tags)"},
}
