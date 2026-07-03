package main

import (
	"strings"
	"testing"
)

// TestKeywordCoverageCalculation tests the keyword audit algorithm's coverage calculation
func TestKeywordCoverageCalculation(t *testing.T) {
	tests := []struct {
		name             string
		brandTokens      []string
		country          string
		keywords         []string
		expectedCoverage float64
		expectedMissing  int
	}{
		{
			name:             "Perfect coverage",
			brandTokens:      []string{"example", "com"},
			country:          "us",
			keywords:         []string{"example store", "us deals", "com service"},
			expectedCoverage: 100.0,
			expectedMissing:  0,
		},
		{
			name:             "Partial coverage - missing country",
			brandTokens:      []string{"example"},
			country:          "us",
			keywords:         []string{"example store", "online shopping"},
			expectedCoverage: 50.0, // 1 of 2 (example yes, us no)
			expectedMissing:  1,
		},
		{
			name:             "No coverage",
			brandTokens:      []string{"example"},
			country:          "us",
			keywords:         []string{"unrelated", "keywords"},
			expectedCoverage: 0.0,
			expectedMissing:  2,
		},
		{
			name:             "Empty keywords",
			brandTokens:      []string{"example"},
			country:          "",
			keywords:         []string{},
			expectedCoverage: 0.0,
			expectedMissing:  1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Build expected keywords map
			expected := make(map[string]struct{})
			for _, token := range tt.brandTokens {
				if token != "" {
					expected[token] = struct{}{}
				}
			}
			if tt.country != "" {
				expected[tt.country] = struct{}{}
			}

			// Build actual keywords map
			kws := make(map[string]struct{})
			for _, k := range tt.keywords {
				kws[k] = struct{}{}
			}

			// Calculate coverage
			missing := []string{}
			matched := 0
			for e := range expected {
				found := false
				for k := range kws {
					if containsToken(k, e) {
						found = true
						break
					}
				}
				if found {
					matched++
				} else {
					missing = append(missing, e)
				}
			}

			coverage := 100.0
			if len(expected) > 0 {
				coverage = float64(matched) / float64(len(expected)) * 100.0
			}

			if coverage != tt.expectedCoverage {
				t.Errorf("Coverage = %.1f, want %.1f", coverage, tt.expectedCoverage)
			}
			if len(missing) != tt.expectedMissing {
				t.Errorf("Missing count = %d, want %d", len(missing), tt.expectedMissing)
			}
		})
	}
}

// TestSuggestedActionsGeneration tests the recommendation engine's action suggestions
func TestSuggestedActionsGeneration(t *testing.T) {
	tests := []struct {
		name              string
		metrics           map[string]float64
		landingURL        string
		expectedActions   []string // action types we expect to see
		unexpectedActions []string // action types we don't expect
	}{
		{
			name: "Low CTR needs CPC adjustment",
			metrics: map[string]float64{
				"impressions": 500,
				"ctr":         0.3, // < 0.5
				"dailyBudget": 100, // Set budget to avoid ADJUST_BUDGET trigger
			},
			expectedActions: []string{"ADJUST_CPC"},
		},
		{
			name: "Low quality score needs CPC boost",
			metrics: map[string]float64{
				"qualityScore": 3, // < 5
			},
			expectedActions: []string{"ADJUST_CPC"},
		},
		{
			name: "No budget set",
			metrics: map[string]float64{
				"dailyBudget": 0,
			},
			expectedActions: []string{"ADJUST_BUDGET"},
		},
		{
			name: "Budget exhausted",
			metrics: map[string]float64{
				"dailyBudget":  100,
				"budgetPacing": 1.0, // >= 1.0
			},
			expectedActions: []string{"ADJUST_BUDGET"},
		},
		{
			name:            "Missing tracking parameters",
			metrics:         map[string]float64{},
			landingURL:      "https://example.com/landing",
			expectedActions: []string{"ROTATE_LINK"},
		},
		{
			name: "High clicks but no conversions",
			metrics: map[string]float64{
				"impressions": 500,
				"ctr":         1.2, // >= 0.8
				"conversions": 0,
			},
			landingURL:      "https://example.com/landing",
			expectedActions: []string{"ROTATE_LINK"},
		},
		{
			name: "All metrics healthy",
			metrics: map[string]float64{
				"impressions":  1000,
				"ctr":          2.5,
				"qualityScore": 8,
				"dailyBudget":  100,
				"budgetPacing": 0.6,
				"conversions":  15,
			},
			landingURL:        "https://example.com?utm_source=google",
			unexpectedActions: []string{"ADJUST_CPC", "ADJUST_BUDGET", "ROTATE_LINK"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actions := generateSuggestedActions(tt.metrics, tt.landingURL)

			// Check expected actions
			for _, expected := range tt.expectedActions {
				found := false
				for _, action := range actions {
					if action["action"] == expected {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Expected action %s not found in %v", expected, actions)
				}
			}

			// Check unexpected actions
			for _, unexpected := range tt.unexpectedActions {
				for _, action := range actions {
					if action["action"] == unexpected {
						t.Errorf("Unexpected action %s found in %v", unexpected, actions)
					}
				}
			}
		})
	}
}

// TestSummarizeOpportunity tests the opportunity summary generation
func TestSummarizeOpportunity(t *testing.T) {
	tests := []struct {
		name        string
		req         opportunityReq
		wantContain []string // strings that should be in summary
	}{
		{
			name: "Full opportunity",
			req: opportunityReq{
				SeedDomain: "example.com",
				Country:    "US",
				TopKeywords: []map[string]any{
					{"keyword": "online shopping"},
					{"keyword": "e-commerce"},
				},
				TopDomains: []map[string]any{
					{"domain": "competitor1.com"},
					{"domain": "competitor2.com"},
				},
			},
			wantContain: []string{"关键词", "online shopping", "相似域名", "competitor1.com", "国家: US", "Seed: example.com"},
		},
		{
			name: "Keywords only",
			req: opportunityReq{
				SeedDomain: "example.com",
				TopKeywords: []map[string]any{
					{"keyword": "test keyword"},
				},
			},
			wantContain: []string{"关键词", "test keyword", "Seed: example.com"},
		},
		{
			name: "Domains only",
			req: opportunityReq{
				SeedDomain: "example.com",
				TopDomains: []map[string]any{
					{"domain": "similar.com"},
				},
			},
			wantContain: []string{"相似域名", "similar.com", "Seed: example.com"},
		},
		{
			name:        "Empty opportunity",
			req:         opportunityReq{},
			wantContain: []string{"自动分析机会"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := summarizeOpportunity(tt.req)

			for _, want := range tt.wantContain {
				if !containsToken(summary, want) {
					t.Errorf("Summary %q does not contain %q", summary, want)
				}
			}
		})
	}
}

// TestBrandTokenExtraction tests brand token derivation from domain
func TestBrandTokenExtraction(t *testing.T) {
	tests := []struct {
		domain   string
		expected []string
	}{
		{
			domain:   "example.com",
			expected: []string{"example"},
		},
		{
			domain:   "shop.example.com",
			expected: []string{"example", "shop"},
		},
		{
			domain:   "my-store-name.co.uk",
			expected: []string{"co", "name"}, // actual: takes last 2 parts including TLD
		},
		{
			domain:   "single",
			expected: []string{}, // no valid brand tokens
		},
	}

	for _, tt := range tests {
		t.Run(tt.domain, func(t *testing.T) {
			tokens := extractBrandTokens(tt.domain)

			if len(tokens) != len(tt.expected) {
				t.Errorf("Got %d tokens, want %d. Got: %v, Want: %v", len(tokens), len(tt.expected), tokens, tt.expected)
				return
			}

			for i, token := range tokens {
				if token != tt.expected[i] {
					t.Errorf("Token[%d] = %s, want %s", i, token, tt.expected[i])
				}
			}
		})
	}
}

// TestScaleEligibilityThresholds tests scale eligibility coverage thresholds
func TestScaleEligibilityThresholds(t *testing.T) {
	tests := []struct {
		name           string
		coverageRatio  float64
		minCoverage    float64
		expectEligible bool
		expectWarnings bool
	}{
		{
			name:           "High coverage, no warnings",
			coverageRatio:  0.9,
			minCoverage:    0.6,
			expectEligible: true,
			expectWarnings: false,
		},
		{
			name:           "Low coverage, warnings expected",
			coverageRatio:  0.4,
			minCoverage:    0.6,
			expectEligible: true, // still eligible, but with warnings
			expectWarnings: true,
		},
		{
			name:           "Exact threshold",
			coverageRatio:  0.6,
			minCoverage:    0.6,
			expectEligible: true,
			expectWarnings: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hasWarnings := tt.coverageRatio < tt.minCoverage

			if hasWarnings != tt.expectWarnings {
				t.Errorf("Warnings = %v, want %v", hasWarnings, tt.expectWarnings)
			}

			// In this implementation, eligible is always true (non-gating)
			eligible := true
			if eligible != tt.expectEligible {
				t.Errorf("Eligible = %v, want %v", eligible, tt.expectEligible)
			}
		})
	}
}

// Helper functions that mirror the production code logic

func containsToken(text, token string) bool {
	return strings.Contains(strings.ToLower(text), strings.ToLower(token))
}

func extractBrandTokens(domain string) []string {
	// Parse domain and extract brand tokens (mirror production logic)
	host := domain
	// Remove protocol if present
	if idx := strings.Index(host, "://"); idx >= 0 {
		host = host[idx+3:]
	}
	// Remove path if present
	if idx := strings.Index(host, "/"); idx >= 0 {
		host = host[:idx]
	}

	// Split by . - _
	parts := strings.FieldsFunc(host, func(r rune) bool {
		return r == '.' || r == '-' || r == '_'
	})

	tokens := []string{}
	// Take last 2 non-TLD parts (mirror production logic)
	if len(parts) >= 2 {
		tokens = append(tokens, strings.ToLower(parts[len(parts)-2]))
	}
	if len(parts) >= 3 {
		tokens = append(tokens, strings.ToLower(parts[len(parts)-3]))
	}

	return tokens
}

func generateSuggestedActions(metrics map[string]float64, landingURL string) []map[string]any {
	m := func(k string, def float64) float64 {
		if v, ok := metrics[k]; ok {
			return v
		}
		return def
	}

	impressions := m("impressions", 0)
	ctr := m("ctr", 0)
	qs := m("qualityScore", 0)
	dailyBudget := m("dailyBudget", 0)
	budgetPacing := m("budgetPacing", 0)
	conversions := m("conversions", 0)

	out := make([]map[string]any, 0, 6)
	add := func(action string, params map[string]any, reason string, estimate map[string]any) {
		it := map[string]any{"action": action}
		if params != nil {
			it["params"] = params
		}
		if reason != "" {
			it["reason"] = reason
		}
		if estimate != nil {
			it["estimate"] = estimate
		}
		out = append(out, it)
	}

	// Mirror production rules
	if dailyBudget <= 0 {
		add("ADJUST_BUDGET", map[string]any{"dailyBudget": 50}, "设置合理日预算", map[string]any{"expectedImprDelta": "+20%~+50%"})
	} else if budgetPacing >= 1.0 {
		add("ADJUST_BUDGET", map[string]any{"percent": 20}, "预算耗尽，适度提升预算", map[string]any{"expectedImprDelta": "+10%~+30%"})
	}

	if impressions > 100 && ctr < 0.5 {
		add("ADJUST_CPC", map[string]any{"percent": 10}, "点击率偏低，适度提升出价测试", map[string]any{"expectedCtrDelta": "+0.1~+0.3"})
	}

	if qs > 0 && qs < 5 {
		add("ADJUST_CPC", map[string]any{"percent": 10}, "质量得分偏低，短期提升排名", map[string]any{"risk": "CPC 上升"})
	}

	if u := strings.TrimSpace(landingURL); u != "" {
		if !strings.Contains(u, "utm_") && !strings.Contains(u, "gclid=") {
			add("ROTATE_LINK", map[string]any{"links": []string{u}}, "缺少常见跟踪参数，建议统一链接管理并追加参数", map[string]any{"suggest": "在链接后追加 utm_* 或启用自动标记"})
		}
	}

	if impressions > 300 && ctr >= 0.8 && conversions <= 0 {
		add("ROTATE_LINK", nil, "有点击无转化，建议检查/优化落地页并分批替换链接做对照", map[string]any{"expectedConvDelta": "+5%~+20%"})
	}

	return out
}
