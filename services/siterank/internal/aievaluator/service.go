package aievaluator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"cloud.google.com/go/vertexai/genai"

	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/metrics"
	"github.com/ScientificInternet/Google-Monetize/services/siterank/internal/similarweb"
)

// Service provides AI evaluation using Vertex AI Gemini API
type Service struct {
	client    *genai.Client
	projectID string
	location  string
	modelName string
}

// NewService creates a new AI evaluator service using Vertex AI
// Works both locally (with ADC) and in Cloud Run (with service account)
func NewService(ctx context.Context, projectID string) (*Service, error) {
	location := "asia-northeast1"

	// Initialize Vertex AI client with default credentials
	// Locally: uses Application Default Credentials (gcloud auth application-default login)
	// Cloud Run: uses service account attached to the Cloud Run service
	client, err := genai.NewClient(ctx, projectID, location)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Vertex AI client: %w", err)
	}

	return &Service{
		client:    client,
		projectID: projectID,
		location:  location,
		modelName: "gemini-1.5-flash-002",
	}, nil
}

// Close closes the AI evaluator client
func (s *Service) Close() error {
	if s.client != nil {
		return s.client.Close()
	}
	return nil
}

// EvaluationInput contains data for AI evaluation
type EvaluationInput struct {
	Domain         string
	BrandName      string
	LandingPageURL string
	SimilarWebData *similarweb.SimilarWebData
}

// AIEvaluationResult contains AI evaluation output
type AIEvaluationResult struct {
	RecommendationScore   int                    `json:"recommendationScore"` // 0-100
	Reasons               []string               `json:"reasons"`             // 3 reasons
	Industry              string                 `json:"industry"`
	ProductType           string                 `json:"productType"`  // Physical/Digital/Service/Subscription
	EstimatedAOV          string                 `json:"estimatedAOV"` // Average Order Value range
	TrafficInsights       map[string]interface{} `json:"trafficInsights"`
	SearchInsights        map[string]interface{} `json:"searchInsights"` // Brand vs non-brand, intent
	GeoInsights           map[string]interface{} `json:"geoInsights"`    // Top markets for ad targeting
	AdInsights            map[string]interface{} `json:"adInsights"`
	RiskAssessment        map[string]interface{} `json:"riskAssessment"`        // Investment risks
	SeasonalityInsights   map[string]interface{} `json:"seasonalityInsights"`   // Seasonal timing analysis
	ConversionInsights    map[string]interface{} `json:"conversionInsights"`    // Conversion path & friction
	LTVInsights           map[string]interface{} `json:"ltvInsights"`           // Customer lifetime value
	ProfitabilityInsights map[string]interface{} `json:"profitabilityInsights"` // Margin & pricing analysis
	CompetitorInsights    map[string]interface{} `json:"competitorInsights"`    // Competitive landscape (inferred)
	BudgetRecommendation  map[string]interface{} `json:"budgetRecommendation"`  // Smart budget allocation
}

// EvaluateOffer evaluates an offer using Gemini AI with retry logic (BE-027)
func (s *Service) EvaluateOffer(ctx context.Context, input *EvaluationInput) (*AIEvaluationResult, error) {
	return s.EvaluateOfferWithRetry(ctx, input, 3)
}

// EvaluateOfferWithRetry evaluates an offer with configurable retry attempts (BE-027)
func (s *Service) EvaluateOfferWithRetry(ctx context.Context, input *EvaluationInput, maxRetries int) (*AIEvaluationResult, error) {
	startTime := time.Now()

	// Build prompt (v2.5.0 with 12-dimensional framework)
	prompt := s.buildPrompt(input)

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		// Call Gemini API with optimized parameters
		response, err := s.callGeminiAPI(ctx, prompt)
		if err != nil {
			lastErr = fmt.Errorf("attempt %d/%d - failed to call Gemini API: %w", attempt+1, maxRetries+1, err)

			// Check if error is retryable
			if !isRetryableGeminiError(err) {
				return nil, lastErr
			}

			// Exponential backoff before retry
			if attempt < maxRetries {
				backoff := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}
			continue
		}

		latency := time.Since(startTime).Milliseconds()

		// Parse response
		result, err := s.parseGeminiResponse(response)
		if err != nil {
			lastErr = fmt.Errorf("attempt %d/%d - failed to parse Gemini response (latency: %dms): %w", attempt+1, maxRetries+1, latency, err)

			// JSON parse errors are usually not retryable unless it's a partial response
			if attempt < maxRetries && strings.Contains(err.Error(), "EOF") {
				// Partial response - retry
				backoff := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}

			// Other parse errors - return immediately
			return nil, lastErr
		}

		// Success - record metrics
		metrics.GeminiAPILatency.Observe(time.Since(startTime).Seconds())
		if attempt > 0 {
			metrics.GeminiAPIErrors.WithLabelValues("retry_success").Inc()
		}

		return result, nil
	}

	// All retries exhausted
	metrics.GeminiAPIErrors.WithLabelValues("max_retries_exceeded").Inc()
	return nil, fmt.Errorf("failed after %d retries: %w", maxRetries+1, lastErr)
}

// isRetryableGeminiError checks if a Gemini API error is retryable
func isRetryableGeminiError(err error) bool {
	if err == nil {
		return false
	}

	errStr := strings.ToLower(err.Error())

	// Retryable error patterns
	retryablePatterns := []string{
		"timeout",
		"deadline exceeded",
		"connection refused",
		"connection reset",
		"temporary failure",
		"service unavailable",
		"503",
		"429", // Rate limit
		"quota exceeded",
		"resource exhausted",
		"internal error",
		"500",
		"502",
		"504",
	}

	for _, pattern := range retryablePatterns {
		if strings.Contains(errStr, pattern) {
			return true
		}
	}

	return false
}

// GetPromptVersion returns the current prompt version
func (s *Service) GetPromptVersion() string {
	return PromptVersion
}

// GetModelName returns the current model name
func (s *Service) GetModelName() string {
	return s.modelName
}

// getCurrentSeason returns the current season and key shopping events
func getCurrentSeason() string {
	now := time.Now()
	month := now.Month()

	switch {
	case month >= 11 || month == 12:
		return "Q4 Holiday Season (Black Friday, Cyber Monday, Christmas shopping peak)"
	case month >= 1 && month <= 2:
		return "Q1 New Year (fitness resolutions, fresh start shopping, Valentine's Day)"
	case month == 3:
		return "Q1 Spring Transition (spring break, Easter prep)"
	case month >= 4 && month <= 6:
		return "Q2 Spring/Summer (Mother's Day, graduation, Father's Day, summer prep)"
	case month >= 7 && month <= 8:
		return "Q3 Summer Peak (vacation season, back-to-school prep starts Aug)"
	case month >= 9 && month <= 10:
		return "Q3/Q4 Transition (back-to-school peak, Halloween, pre-holiday ramp-up)"
	default:
		return "General Shopping Season"
	}
}

const (
	// PromptVersion tracks prompt template changes for monitoring
	PromptVersion = "v2.5.0" // Added dynamic scoring weights, competitor analysis, budget recommendations, and trend tracking (12-dimensional framework)
)

// buildPrompt constructs the prompt for Gemini with Chain-of-Thought reasoning
func (s *Service) buildPrompt(input *EvaluationInput) string {
	prompt := fmt.Sprintf(`You are an expert advertising performance analyst specializing in digital marketing ROI evaluation. Your analysis directly impacts million-dollar advertising budget decisions.

# OFFER INFORMATION
Domain: %s
Brand: %s
Landing Page: %s

`, input.Domain, input.BrandName, input.LandingPageURL)

	if input.SimilarWebData != nil {
		prompt += "# Traffic & Engagement Data (SimilarWeb)\n\n"

		// Global & Category Ranking
		if input.SimilarWebData.GlobalRank != nil {
			prompt += fmt.Sprintf("**Global Rank:** #%d\n", *input.SimilarWebData.GlobalRank)
			if *input.SimilarWebData.GlobalRank < 10000 {
				prompt += "  ↳ Top-tier traffic authority (excellent brand recognition)\n"
			} else if *input.SimilarWebData.GlobalRank < 100000 {
				prompt += "  ↳ Strong traffic authority (good brand presence)\n"
			} else if *input.SimilarWebData.GlobalRank < 1000000 {
				prompt += "  ↳ Moderate traffic authority\n"
			} else {
				prompt += "  ↳ Lower traffic authority (niche or emerging brand)\n"
			}
		}

		if input.SimilarWebData.CategoryRank != nil && input.SimilarWebData.Category != "" {
			prompt += fmt.Sprintf("**Category:** %s (Rank: #%d)\n", input.SimilarWebData.Category, *input.SimilarWebData.CategoryRank)
		}

		// Monthly Traffic
		if input.SimilarWebData.TotalVisits != nil {
			visits := *input.SimilarWebData.TotalVisits
			prompt += fmt.Sprintf("\n**Monthly Visits:** %.0f\n", visits)
			if visits > 10000000 {
				prompt += "  ↳ Mass market scale (10M+ visits)\n"
			} else if visits > 1000000 {
				prompt += "  ↳ High traffic volume (1M-10M visits)\n"
			} else if visits > 100000 {
				prompt += "  ↳ Moderate traffic (100K-1M visits)\n"
			} else {
				prompt += "  ↳ Lower traffic volume (<100K visits)\n"
			}
		}

		// Traffic Sources
		if input.SimilarWebData.TrafficSources != nil {
			prompt += "\n**Traffic Sources:**\n"
			ts := input.SimilarWebData.TrafficSources
			if ts.Direct != nil {
				prompt += fmt.Sprintf("  • Direct: %.1f%% (brand loyalty indicator)\n", *ts.Direct*100)
			}
			if ts.Search != nil {
				prompt += fmt.Sprintf("  • Search: %.1f%% (organic discovery)\n", *ts.Search*100)
			}
			if ts.Social != nil {
				prompt += fmt.Sprintf("  • Social: %.1f%% (viral potential)\n", *ts.Social*100)
			}
			if ts.Paid != nil {
				prompt += fmt.Sprintf("  • Paid Ads: %.1f%% (existing ad spend)\n", *ts.Paid*100)
			}
			if ts.Referrals != nil {
				prompt += fmt.Sprintf("  • Referral: %.1f%% (partnership ecosystem)\n", *ts.Referrals*100)
			}
		}

		// Geographic Distribution
		if len(input.SimilarWebData.TopCountryShares) > 0 {
			prompt += "\n**Geographic Traffic Distribution:**\n"
			for i, country := range input.SimilarWebData.TopCountryShares {
				if i >= 5 { // Top 5 countries
					break
				}
				prompt += fmt.Sprintf("  • %s: %.1f%%\n", country.CountryCode, country.Share*100)
			}
		}

		// Engagement Quality
		if input.SimilarWebData.EngagementMetrics != nil {
			prompt += "\n**Engagement Quality:**\n"
			em := input.SimilarWebData.EngagementMetrics
			if em.BounceRate != nil {
				bounceRate := *em.BounceRate * 100
				prompt += fmt.Sprintf("  • Bounce Rate: %.1f%%", bounceRate)
				if bounceRate < 40 {
					prompt += " (excellent retention)\n"
				} else if bounceRate < 55 {
					prompt += " (good retention)\n"
				} else if bounceRate < 70 {
					prompt += " (average retention)\n"
				} else {
					prompt += " (low retention - needs optimization)\n"
				}
			}
			if em.PagesPerVisit != nil {
				prompt += fmt.Sprintf("  • Pages/Visit: %.2f", *em.PagesPerVisit)
				if *em.PagesPerVisit > 4 {
					prompt += " (high engagement)\n"
				} else if *em.PagesPerVisit > 2 {
					prompt += " (moderate engagement)\n"
				} else {
					prompt += " (low engagement)\n"
				}
			}
			if em.AvgVisitDuration != nil {
				duration := *em.AvgVisitDuration
				prompt += fmt.Sprintf("  • Avg Duration: %.0fs", duration)
				if duration > 180 {
					prompt += " (strong user interest)\n"
				} else if duration > 60 {
					prompt += " (moderate interest)\n"
				} else {
					prompt += " (brief interaction)\n"
				}
			}
		}
	}

	prompt += `

# ANALYSIS FRAMEWORK

Follow this structured evaluation process:

## Step 1: Multi-Dimensional Analysis
Analyze the provided data across these key dimensions:

1. **Product & Market Analysis**
   - Identify product type (Physical/Digital/Service/Hybrid)
   - Estimate average order value (AOV) based on industry and brand positioning
   - Assess market maturity and competitive landscape

2. **Traffic & Engagement Analysis**
   - Monthly visits, growth trajectory, market share
   - Bounce rate, pages/visit, session duration
   - Direct traffic % (brand loyalty indicator)

3. **Geographic Market Analysis**
   - Primary traffic markets (from TopCountryShares)
   - Geographic diversification vs concentration
   - Target market alignment with ad platforms (US/EU/APAC)

4. **Search Intent & Behavior Analysis**
   - Estimate brand vs non-brand search traffic split
   - Infer user search intent (Informational/Transactional/Navigational)
   - Assess organic discovery potential

5. **Advertising Feasibility Analysis**
   - Competitive CPC estimation for industry/geography
   - Traffic source diversity and paid ad dependency
   - Conversion potential based on engagement metrics

6. **Seasonal Timing Analysis**
   - Current month/season relevance to product category
   - Peak season vs off-season timing (Q4/holidays, back-to-school, summer, etc.)
   - Traffic trend patterns suggesting optimal launch window
   - Time-sensitive opportunities (urgency score: immediate/wait/monitor)

7. **Conversion Path Analysis**
   - Checkout flow complexity (steps from landing to purchase)
   - Payment friction indicators (guest checkout, saved payment methods)
   - Mobile optimization quality (responsive design, mobile-first checkout)
   - Trust signals presence (security badges, customer reviews, money-back guarantee)
   - Form field count and friction points

8. **Customer Lifetime Value (LTV) Signals**
   - Repeat purchase potential (subscription, consumables, seasonal needs)
   - Average cart composition (single item vs bundles)
   - Cross-sell/upsell opportunities visible on site
   - Brand loyalty indicators (membership programs, loyalty points)
   - Estimated LTV based on product category and engagement metrics

9. **Profitability & Margin Analysis**
   - Price positioning (premium/mid-market/budget)
   - Estimated gross margin based on industry benchmarks
   - Shipping cost impact (free shipping threshold, shipping fees)
   - Break-even CPA calculation (based on AOV and estimated margin)
   - Profitability after typical ad spend scenarios

10. **Google Ads Policy Risk Assessment**
   - Product category compliance (prohibited: alcohol, firearms, adult content, gambling, drugs, etc.)
   - Restricted categories requiring special review (healthcare, financial services, political)
   - Geographic policy variations (different rules by country)
   - Landing page quality and user experience compliance

## Step 2: Dynamic Scoring with Product-Type Weights

**IMPORTANT: Apply different weight emphasis based on product type**

**For Subscription/SaaS Products (Digital recurring):**
- LTV potential: 40% weight (repeat revenue is key)
- Conversion quality: 25% weight (low churn matters)
- Traffic scale: 20% weight
- Profitability: 10% weight
- Seasonality: 5% weight

**For Physical Products (E-commerce):**
- Profitability margin: 35% weight (shipping costs matter)
- Conversion path: 30% weight (checkout friction critical)
- LTV potential: 20% weight (repeat purchases)
- Traffic scale: 10% weight
- Seasonality: 5% weight

**For Digital One-time Products (Courses, Software):**
- Conversion rate: 40% weight (no repeat revenue)
- Traffic scale: 30% weight (volume compensates)
- LTV potential: 15% weight (upsells only)
- Profitability: 10% weight (high margins)
- Seasonality: 5% weight

**For Services (Consulting, B2B):**
- LTV potential: 45% weight (long contracts)
- Conversion quality: 25% weight (qualification matters)
- Traffic quality: 20% weight (not volume)
- Profitability: 5% weight (high margins typical)
- Seasonality: 5% weight

**Base Scoring Tiers (adjust final score based on weights above):**

**Score 85-100 (Premium Tier)**
- Top 10K global rank OR 10M+ monthly visits
- Bounce rate < 40% AND avg duration > 3 minutes
- Direct traffic > 30% (strong brand loyalty)
- High LTV (>$300) OR strong repeat purchase signals

**Score 70-84 (Recommended Tier)**
- Top 100K global rank OR 1M-10M monthly visits
- Bounce rate 40-55% AND avg duration > 2 minutes
- Direct traffic 20-30% OR strong search presence
- Medium LTV ($150-$300) OR moderate profitability

**Score 50-69 (Conditional Tier)**
- Top 1M global rank OR 100K-1M monthly visits
- Bounce rate 55-70% OR avg duration 1-2 minutes
- Direct traffic 10-20% (moderate brand recognition)
- Low LTV (<$150) OR tight margins

**Score 0-49 (High-Risk Tier)**
- Rank > 1M OR <100K monthly visits
- Bounce rate > 70% OR avg duration < 1 minute
- Direct traffic < 10% (weak brand loyalty)
- Negative profitability signals OR very low LTV

## Step 3: Reason Formulation (关键词式)
Each reason MUST be concise keyword-style (5-8 words) with specific metrics:

**Format Requirements:**
- Start with emoji icon (📈📊💰🌍🎯 etc.)
- Include 1-2 key metrics
- Max 8 words
- Focus on most impactful insight

**Example Reasons:**
✅ Good: "📈 Top 0.001% traffic (113M visits/month)"
✅ Good: "💰 54% direct → 70% lower CAC"
✅ Good: "🌍 40.5% US traffic = premium market"
✅ Good: "🎯 37% search = high organic intent"
✅ Good: "⚡ 175s engagement >> industry avg"
❌ Bad: "Bounce rate of 32% (vs industry avg 55%) indicates highly engaged audience" (too verbose)
❌ Bad: "Good traffic quality" (no metrics)
❌ Bad: "Strong brand presence in market" (vague)

# FEW-SHOT EXAMPLES

## Example 1: Premium Tier (Score: 92)
**Input:** Domain: nike.com, Global Rank: 302, Monthly Visits: 113M, Bounce: 40.8%, Duration: 174s, Direct: 54%, US: 40.5%, GB: 4.9%
**Output:**
{
  "recommendationScore": 92,
  "reasons": [
    "📈 Top 300 global rank (113M visits/mo)",
    "💰 54% direct traffic = low CAC",
    "🌍 40.5% US = premium ad market"
  ],
  "industry": "E-commerce - Athletic Apparel & Footwear",
  "productType": "Physical",
  "estimatedAOV": "$80-$150 (premium athletic brand with both low-ticket accessories and high-ticket footwear)",
  "trafficInsights": {
    "summary": "Mass-market scale with premium engagement. 91% organic+direct traffic indicates minimal dependency on paid acquisition.",
    "quality": "high",
    "keyMetric": "54% direct traffic is 3x industry average, indicating exceptional brand equity"
  },
  "searchInsights": {
    "brandVsNonBrand": "70% brand searches / 30% non-brand (estimated from 54% direct + high search %)",
    "dominantIntent": "Transactional",
    "organicPotential": "high - strong brand searches drive high-intent traffic without paid spend"
  },
  "geoInsights": {
    "topMarkets": ["US (40.5%)", "GB (4.9%)", "KR (4.5%)"],
    "concentration": "concentrated - US dominates with 40.5% but healthy diversification across developed markets",
    "adPlatformFit": "Google Shopping US (optimal), Meta Global Retargeting (strong brand awareness)"
  },
  "adInsights": {
    "bestChannels": ["Google Shopping (brand + competitor)", "Display Remarketing", "YouTube (brand awareness)"],
    "estimatedCPC": "$1.20-$2.80 (based on athletic apparel US market)",
    "conversionPotential": "high"
  },
  "riskAssessment": {
    "policyCompliance": "compliant",
    "riskLevel": "low",
    "prohibitedCategories": [],
    "restrictedCategories": [],
    "recommendation": "Fully compliant with Google Ads policies. Athletic apparel is unrestricted category. Proceed with standard account setup."
  },
  "seasonalityInsights": {
    "currentTiming": "optimal",
    "peakSeason": "Q1 (Jan-Mar: New Year fitness resolutions), Q4 (Nov-Dec: holiday gifting)",
    "currentMonth": "October - Pre-holiday shopping window",
    "urgency": "immediate",
    "reasoning": "Athletic apparel sees 35% traffic spike Oct-Dec. Current timing captures Black Friday prep + holiday shoppers. Launch now for Q4 peak."
  },
  "conversionInsights": {
    "checkoutComplexity": "low",
    "estimatedSteps": "2-3 steps (cart → checkout → payment)",
    "mobileOptimization": "excellent",
    "trustSignals": "high (customer reviews, secure badges, 30-day returns)",
    "paymentFriction": "low (guest checkout, multiple payment options)",
    "estimatedCVR": "3.5-5% (above industry avg 2-3%)"
  },
  "ltvInsights": {
    "repeatPurchasePotential": "high",
    "productCategory": "athletic apparel (seasonal refresh cycle)",
    "averageCartSize": "2-3 items (apparel bundles common)",
    "crossSellOpportunity": "strong (accessories, footwear)",
    "estimatedLTV": "$250-$400 (3-4 purchases/year)",
    "ltv_cac_ratio": "healthy (5:1 with $50 CAC)"
  },
  "profitabilityInsights": {
    "pricePoint": "premium",
    "avgProductPrice": "$80-$150",
    "estimatedGrossMargin": "55-65% (premium athletic brand)",
    "shippingStrategy": "free over $50 (encourages bundle)",
    "breakEvenCPA": "$44-$97 (based on $80-$150 AOV @ 55% margin)",
    "profitabilityOutlook": "strong (40%+ margin after $50 CPA)"
  }
}

## Example 2: Recommended Tier (Score: 74)
**Input:** Domain: example-shop.com, Global Rank: 45000, Monthly Visits: 2.5M, Bounce: 48%, Duration: 140s, Direct: 22%
**Output:**
{
  "recommendationScore": 74,
  "reasons": [
    "Global rank #45,000 (top 0.05%) with 2.5M monthly visits indicates established market presence in competitive vertical",
    "48% bounce rate and 140-second session duration meet industry benchmarks, suggesting adequate product-market fit",
    "22% direct traffic shows moderate brand recognition, but 35% paid dependency requires optimized CAC monitoring"
  ],
  "industry": "E-commerce - Home & Garden",
  "trafficInsights": {
    "summary": "Solid traffic foundation with room for engagement optimization. Balanced mix of organic (43% search) and paid (35%) channels.",
    "quality": "medium",
    "keyMetric": "35% paid traffic suggests strong advertiser confidence but requires ROI validation"
  },
  "adInsights": {
    "bestChannels": ["Google Search Ads", "Facebook/Pinterest Retargeting", "Affiliate Marketing"],
    "estimatedCPC": "$0.80-$1.80",
    "conversionPotential": "medium"
  }
}

## Example 3: High-Risk Tier (Score: 38)
**Input:** Domain: new-site.com, Global Rank: 2.8M, Monthly Visits: 45K, Bounce: 73%, Duration: 35s, Direct: 8%
**Output:**
{
  "recommendationScore": 38,
  "reasons": [
    "73% bounce rate and 35-second avg session signal poor user experience or misaligned traffic sources requiring immediate optimization",
    "Only 45K monthly visits with 8% direct traffic indicates minimal brand recognition and customer loyalty challenges",
    "Global rank #2.8M places site in bottom 20% of web traffic, suggesting early-stage or niche market with limited scale potential"
  ],
  "industry": "E-commerce - General Merchandise",
  "trafficInsights": {
    "summary": "Low traffic volume with concerning engagement metrics. High bounce rate suggests landing page or targeting issues.",
    "quality": "low",
    "keyMetric": "73% bounce rate is 30% above industry average, indicating fundamental UX or value proposition problems"
  },
  "adInsights": {
    "bestChannels": ["Retargeting (high-intent only)", "Long-tail Search Keywords", "Influencer Partnerships"],
    "estimatedCPC": "$0.30-$0.70",
    "conversionPotential": "low"
  }
}

# OUTPUT REQUIREMENTS

Return ONLY valid JSON in this exact format:
{
  "recommendationScore": <integer 0-100>,
  "reasons": [
    "<emoji + metric keyword, max 8 words>",
    "<emoji + metric keyword, max 8 words>",
    "<emoji + metric keyword, max 8 words>"
  ],
  "industry": "<specific vertical like 'E-commerce - Athletic Apparel'>",
  "productType": "<Physical|Digital|Service|Hybrid>",
  "estimatedAOV": "$X-$Y (rationale: industry avg + brand positioning)",
  "trafficInsights": {
    "summary": "<1-2 sentence traffic pattern analysis>",
    "quality": "<high|medium|low>",
    "keyMetric": "<single most important metric with implication>"
  },
  "searchInsights": {
    "brandVsNonBrand": "<estimated % split like '60% brand / 40% non-brand'>",
    "dominantIntent": "<Transactional|Informational|Navigational>",
    "organicPotential": "<high|medium|low with reasoning>"
  },
  "geoInsights": {
    "topMarkets": ["<country 1>", "<country 2>", "<country 3>"],
    "concentration": "<concentrated (>50% single market)|diversified>",
    "adPlatformFit": "<optimal platform like 'Google Ads US' or 'Meta Global'>"
  },
  "adInsights": {
    "bestChannels": ["<channel 1>", "<channel 2>", "<channel 3>"],
    "estimatedCPC": "$X.XX-$Y.YY (based on industry + geo)",
    "conversionPotential": "<high|medium|low>"
  },
  "riskAssessment": {
    "policyCompliance": "<compliant|restricted|prohibited>",
    "riskLevel": "<low|medium|high>",
    "prohibitedCategories": ["<category if any, e.g., 'alcohol', 'adult content', 'gambling'>"],
    "restrictedCategories": ["<category if any, e.g., 'healthcare', 'financial'>"],
    "recommendation": "<approval guidance or required actions>"
  },
  "seasonalityInsights": {
    "currentTiming": "<optimal|good|fair|poor>",
    "peakSeason": "<Q1/Q2/Q3/Q4 periods with event names>",
    "currentMonth": "<current month name + evaluation>",
    "urgency": "<immediate|wait-2-weeks|wait-1-month|monitor>",
    "reasoning": "<1-2 sentence timing recommendation with seasonal data>"
  },
  "conversionInsights": {
    "checkoutComplexity": "<low|medium|high>",
    "estimatedSteps": "<X steps or description>",
    "mobileOptimization": "<excellent|good|poor>",
    "trustSignals": "<high|medium|low (list key signals)>",
    "paymentFriction": "<low|medium|high (describe barriers)>",
    "estimatedCVR": "<X-Y% (vs industry avg Z%)>"
  },
  "ltvInsights": {
    "repeatPurchasePotential": "<high|medium|low>",
    "productCategory": "<category with purchase frequency>",
    "averageCartSize": "<single item|2-3 items|bundle common>",
    "crossSellOpportunity": "<strong|moderate|weak (examples)>",
    "estimatedLTV": "$X-$Y (rationale)",
    "ltv_cac_ratio": "<healthy (>3:1)|marginal (1.5-3:1)|risky (<1.5:1)>"
  },
  "profitabilityInsights": {
    "pricePoint": "<premium|mid-market|budget>",
    "avgProductPrice": "$X-$Y",
    "estimatedGrossMargin": "<X-Y% (industry benchmark)>",
    "shippingStrategy": "<free shipping details or fees>",
    "breakEvenCPA": "$X-$Y (calculation shown)",
    "profitabilityOutlook": "<strong|moderate|weak (margin after CPA)>"
  },
  "competitorInsights": {
    "marketSaturation": "<low|medium|high>",
    "inferredFrom": "<paid traffic % + rank + direct traffic analysis>",
    "competitivePressure": "<Blue Ocean (low)|Purple Ocean (medium)|Red Ocean (high)>",
    "entryBarrier": "<low|medium|high>",
    "strategicRecommendation": "<differentiation strategy or pricing strategy>"
  },
  "budgetRecommendation": {
    "testingPhase": {
      "duration": "<X-Y days>",
      "dailyBudget": "$X-$Y",
      "totalBudget": "$X",
      "expectedClicks": "X-Y clicks",
      "expectedConversions": "X-Y conversions",
      "goal": "<validation objective>"
    },
    "scalingPhase": {
      "triggerCondition": "If ROAS >X after testing",
      "dailyBudget": "$X-$Y",
      "maxDailyBudget": "$X",
      "scalingStrategy": "<increment strategy>"
    },
    "reasoning": "<calculation: break-even CPA × expected daily conversions = max budget>"
  }
}

# IMPORTANT: Include current date context
**Today's Date:** ` + time.Now().Format("January 2, 2006 (Monday)") + `
**Current Season:** ` + getCurrentSeason() + `

# BEGIN ANALYSIS

Apply the 12-step framework above to evaluate this offer's Google Ads potential.

**CRITICAL INSTRUCTIONS:**
1. Apply **product-type specific weights** to final scoring (see Step 2)
2. Infer competitive landscape from paid traffic %, rank, and direct traffic patterns
3. Calculate **phased budget recommendation** based on break-even CPA and expected volume
4. All financial estimates must show calculation logic (e.g., "Testing budget = $30 CPA × 15 conversions = $450/day")
5. Competitor analysis: >40% paid traffic = high competition, 20-40% = medium, <20% = low

Think step-by-step before assigning the final score with appropriate product-type weights.`

	return prompt
}

// callGeminiAPI calls the Gemini Developer API
func (s *Service) callGeminiAPI(ctx context.Context, prompt string) (string, error) {
	model := s.client.GenerativeModel(s.modelName)

	// Configure generation parameters for consistent, structured output
	// Temperature: 0.4 (down from 0.7) - more deterministic scoring
	// TopP: 0.9 (down from 0.95) - focus on high-probability tokens
	// TopK: 20 (down from 40) - reduce randomness further
	model.SetTemperature(0.4)
	model.SetTopP(0.9)
	model.SetTopK(20)
	model.SetMaxOutputTokens(2048)

	// Set response format to JSON
	model.ResponseMIMEType = "application/json"

	// Generate content
	resp, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate content: %w", err)
	}

	if resp == nil || len(resp.Candidates) == 0 {
		return "", fmt.Errorf("no response candidates returned")
	}

	// Record token usage and cost metrics (Gemini 1.5 Flash pricing)
	if resp.UsageMetadata != nil {
		inputTokens := float64(resp.UsageMetadata.PromptTokenCount)
		outputTokens := float64(resp.UsageMetadata.CandidatesTokenCount)

		// Record token counts
		metrics.GeminiInputTokens.Observe(inputTokens)
		metrics.GeminiOutputTokens.Observe(outputTokens)

		// Calculate cost (Gemini 1.5 Flash: $0.075/1M input, $0.30/1M output)
		inputCost := inputTokens * 0.075 / 1_000_000
		outputCost := outputTokens * 0.30 / 1_000_000
		totalCost := inputCost + outputCost
		metrics.GeminiAPICost.Observe(totalCost)
	}

	// Extract text from the first candidate
	candidate := resp.Candidates[0]
	if candidate.Content == nil || len(candidate.Content.Parts) == 0 {
		return "", fmt.Errorf("no content parts in response")
	}

	// Concatenate all text parts
	var textBuilder strings.Builder
	for _, part := range candidate.Content.Parts {
		if textPart, ok := part.(genai.Text); ok {
			textBuilder.WriteString(string(textPart))
		}
	}

	responseText := textBuilder.String()
	if responseText == "" {
		return "", fmt.Errorf("empty response text")
	}

	return responseText, nil
}

// parseGeminiResponse parses Gemini API response
func (s *Service) parseGeminiResponse(response string) (*AIEvaluationResult, error) {
	var result AIEvaluationResult

	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Validate response
	if result.RecommendationScore < 0 || result.RecommendationScore > 100 {
		return nil, fmt.Errorf("invalid recommendation score: %d", result.RecommendationScore)
	}

	if len(result.Reasons) != 3 {
		return nil, fmt.Errorf("expected 3 reasons, got %d", len(result.Reasons))
	}

	return &result, nil
}

// AIEvaluationHistory stores AI evaluation history for monitoring
type AIEvaluationHistory struct {
	ID             string
	EvaluationID   string
	PromptText     string
	PromptVersion  string // e.g., "v2.0.0"
	ResponseRaw    string
	ResponseParsed *AIEvaluationResult
	TokensInput    int
	TokensOutput   int
	LatencyMS      int
	ModelVersion   string // e.g., "gemini-1.5-flash-002"
	Temperature    float32
	TopP           float32
	TopK           int32
	ParseSuccess   bool
	ParseError     *string
	CreatedAt      time.Time
}

// SaveHistory saves AI evaluation history to database for monitoring
func (s *Service) SaveHistory(ctx context.Context, db interface{}, history *AIEvaluationHistory) error {
	// This would save to ai_evaluation_history table
	// Implementation depends on database client
	return nil
}
