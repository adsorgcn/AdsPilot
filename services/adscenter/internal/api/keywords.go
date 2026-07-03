package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
)

// KeywordsHandler handles keyword expansion operations
type KeywordsHandler struct {
	DB *sql.DB
}

// NewKeywordsHandler creates a new keywords handler
func NewKeywordsHandler(db *sql.DB) *KeywordsHandler {
	return &KeywordsHandler{DB: db}
}

// HandleExpand expands seed keywords using rule-based strategies
// POST /api/v1/adscenter/keywords/expand
func (h *KeywordsHandler) HandleExpand(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	var req struct {
		SeedKeywords []string `json:"seedKeywords"`
		SeedDomain   string   `json:"seedDomain"`
		MaxResults   *int     `json:"maxResults"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	maxResults := 50
	if req.MaxResults != nil && *req.MaxResults > 0 && *req.MaxResults <= 200 {
		maxResults = *req.MaxResults
	}

	// Tokenize domain
	tokens := tokenizeDomain(req.SeedDomain)

	// Build seed set from domain tokens + seed keywords
	seeds := map[string]struct{}{}
	for _, t := range tokens {
		if t != "" {
			seeds[t] = struct{}{}
		}
	}

	// Add user-provided seed keywords
	for _, kw := range req.SeedKeywords {
		kw = strings.TrimSpace(kw)
		if kw != "" {
			seeds[kw] = struct{}{}
		}
	}

	if len(seeds) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"keywords": []map[string]any{}})
		return
	}

	baseSeeds := keys(seeds)

	// Candidate storage with scoring
	candidates := make(map[string]struct {
		score  int
		source string
	})

	add := func(k string, base int, src string) {
		k = strings.ToLower(strings.TrimSpace(k))
		if k == "" {
			return
		}
		// Avoid duplicates by taking max score
		if ex, ok := candidates[k]; ok {
			if base > ex.score {
				candidates[k] = struct {
					score  int
					source string
				}{score: base, source: src}
			}
		} else {
			candidates[k] = struct {
				score  int
				source string
			}{score: base, source: src}
		}
	}

	// Generate candidates by rule library

	// 1) brand + suffix
	brand := brandFromTokens(tokens)

	suffixes := []string{
		"review", "reviews", "price", "discount", "coupon", "coupons",
		"deals", "best", "cheap", "sale", "online", "buy", "store",
		"shop", "guide", "comparison", "vs", "alternative", "alternatives",
	}

	suffixesCN := []string{
		"测评", "评测", "价格", "优惠", "优惠券", "折扣",
		"便宜", "购买", "商店", "导购", "对比", "替代品",
	}

	if brand != "" {
		for _, sfx := range suffixes {
			add(brand+" "+sfx, 70, "brand+suffix")
		}
		for _, sfx := range suffixesCN {
			add(brand+" "+sfx, 70, "brand+suffix_cn")
		}
	}

	// 2) combine seed tokens pairwise (if >1 token)
	if len(baseSeeds) > 1 {
		for i := 0; i < len(baseSeeds); i++ {
			for j := i + 1; j < len(baseSeeds); j++ {
				add(baseSeeds[i]+" "+baseSeeds[j], 55, "seeds-pair")
			}
		}
	}

	// 3) add synonyms for common terms (minimal expansion)
	synonyms := map[string][]string{
		"review":   {"reviews", "rating", "ratings"},
		"discount": {"sale", "deal", "deals", "coupon"},
		"cheap":    {"affordable", "low cost", "budget"},
		"best":     {"top", "leading", "recommended"},
	}

	for _, s := range baseSeeds {
		if syns, ok := synonyms[strings.ToLower(s)]; ok {
			for _, syn := range syns {
				add(syn, 50, "synonym")
			}
		}
	}

	// 4) token + suffix (if >=2 meaningful tokens)
	if len(tokens) >= 2 {
		for _, tok := range tokens {
			if len(tok) < 3 {
				continue
			}
			for _, sfx := range suffixes[:5] {
				add(tok+" "+sfx, 45, "token+suffix")
			}
		}
	}

	// Score using Jaccard similarity with original domain tokens
	scored := []map[string]any{}

	for k, v := range candidates {
		overlap := jaccard(tokens, tokenizeKeyword(k))
		s := v.score + int(30*overlap)

		scored = append(scored, map[string]any{
			"keyword": k,
			"score":   s,
			"source":  v.source,
		})
	}

	// Sort by score desc (simple bubble sort for small sets)
	for i := 0; i < len(scored); i++ {
		for j := i + 1; j < len(scored); j++ {
			si := scored[i]["score"].(int)
			sj := scored[j]["score"].(int)
			if sj > si {
				scored[i], scored[j] = scored[j], scored[i]
			}
		}
	}

	// Limit results
	if len(scored) > maxResults {
		scored = scored[:maxResults]
	}

	writeJSON(w, http.StatusOK, map[string]any{"keywords": scored})
}

// --- Helper functions ---

// tokenizeDomain splits domain into meaningful tokens
func tokenizeDomain(domain string) []string {
	domain = strings.TrimSpace(domain)
	domain = strings.TrimPrefix(domain, "http://")
	domain = strings.TrimPrefix(domain, "https://")
	domain = strings.TrimPrefix(domain, "www.")

	// Split by dots
	parts := strings.Split(domain, ".")
	if len(parts) == 0 {
		return []string{}
	}

	// Take first part (e.g., "example" from "example.com")
	main := parts[0]

	// Split by hyphens and underscores
	tokens := []string{}
	for _, t := range strings.FieldsFunc(main, func(r rune) bool {
		return r == '-' || r == '_'
	}) {
		t = strings.ToLower(strings.TrimSpace(t))
		if len(t) >= 2 {
			tokens = append(tokens, t)
		}
	}

	return tokens
}

// tokenizeKeyword splits keyword into tokens
func tokenizeKeyword(kw string) []string {
	kw = strings.ToLower(strings.TrimSpace(kw))
	tokens := []string{}

	for _, t := range strings.Fields(kw) {
		t = strings.TrimSpace(t)
		if len(t) >= 2 {
			tokens = append(tokens, t)
		}
	}

	return tokens
}

// jaccard computes Jaccard similarity between two token sets
func jaccard(a, b []string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	setA := make(map[string]struct{})
	for _, t := range a {
		setA[t] = struct{}{}
	}

	setB := make(map[string]struct{})
	for _, t := range b {
		setB[t] = struct{}{}
	}

	inter := 0
	for t := range setA {
		if _, ok := setB[t]; ok {
			inter++
		}
	}

	union := len(setA) + len(setB) - inter
	if union == 0 {
		return 0.0
	}

	return float64(inter) / float64(union)
}

// brandFromTokens extracts the likely brand name from domain tokens
func brandFromTokens(tokens []string) string {
	if len(tokens) == 0 {
		return ""
	}

	// Take longest token as brand heuristic
	brand := ""
	for _, t := range tokens {
		if len(t) > len(brand) {
			brand = t
		}
	}

	return brand
}

// keys extracts keys from a map into a slice
func keys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
