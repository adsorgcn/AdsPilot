package brandextract

import (
	"context"
	"net/url"
	"regexp"
	"strings"
)

// BrandExtractionResult contains extracted brand name and confidence
type BrandExtractionResult struct {
	BrandName  string
	Confidence float64
	Source     string // "title" | "domain" | "content"
}

// Extractor extracts brand names from landing page data
type Extractor struct {
	// Common brand indicators in title/content
	brandIndicators []string
}

// NewExtractor creates a new brand name extractor
func NewExtractor() *Extractor {
	return &Extractor{
		brandIndicators: []string{
			"official site",
			"official website",
			"homepage",
			"官网",
			"官方网站",
		},
	}
}

// ExtractFromLandingPage extracts brand name from landing page data
func (e *Extractor) ExtractFromLandingPage(ctx context.Context, landingPageURL, domain, pageTitle, pageContent string) *BrandExtractionResult {
	// Strategy 1: Extract from page title (highest confidence)
	if result := e.ExtractFromTitle(pageTitle, domain); result != nil {
		return result
	}

	// Strategy 2: Extract from domain (medium confidence)
	if result := e.ExtractFromDomain(domain); result != nil {
		return result
	}

	// Strategy 3: Fallback to domain (low confidence)
	return &BrandExtractionResult{
		BrandName:  domain,
		Confidence: 0.3,
		Source:     "domain_fallback",
	}
}

// ExtractFromTitle extracts brand from page title
func (e *Extractor) ExtractFromTitle(title, domain string) *BrandExtractionResult {
	if title == "" {
		return nil
	}

	// Clean title
	title = strings.TrimSpace(title)

	// Pattern 1: "BrandName - Slogan" or "BrandName | Slogan"
	separators := []string{" - ", " | ", " – ", " — "}
	for _, sep := range separators {
		if idx := strings.Index(title, sep); idx > 0 && idx < len(title)/2 {
			brandName := strings.TrimSpace(title[:idx])
			if e.isValidBrandName(brandName) {
				return &BrandExtractionResult{
					BrandName:  brandName,
					Confidence: 0.8,
					Source:     "title",
				}
			}
		}
	}

	// Pattern 2: Title contains domain name
	if domain != "" {
		domainParts := strings.Split(domain, ".")
		if len(domainParts) >= 2 {
			mainDomain := domainParts[0]
			// Case-insensitive search
			if strings.Contains(strings.ToLower(title), strings.ToLower(mainDomain)) {
				// Extract the capitalized version from title
				re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(mainDomain) + `\b`)
				if match := re.FindString(title); match != "" {
					return &BrandExtractionResult{
						BrandName:  match,
						Confidence: 0.7,
						Source:     "title",
					}
				}
			}
		}
	}

	// Pattern 3: First word/phrase before common separators (lower confidence)
	words := strings.Fields(title)
	if len(words) > 0 && len(words[0]) >= 3 {
		firstWord := words[0]
		if e.isValidBrandName(firstWord) {
			return &BrandExtractionResult{
				BrandName:  firstWord,
				Confidence: 0.5,
				Source:     "title",
			}
		}
	}

	return nil
}

// ExtractFromDomain extracts brand from domain name
func (e *Extractor) ExtractFromDomain(domain string) *BrandExtractionResult {
	if domain == "" {
		return nil
	}

	// Parse domain to get main part
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return nil
	}

	mainDomain := parts[0]

	// Skip common generic domains
	genericDomains := []string{"www", "shop", "store", "buy", "get", "my", "go"}
	for _, generic := range genericDomains {
		if strings.EqualFold(mainDomain, generic) {
			return nil
		}
	}

	// Capitalize first letter
	brandName := e.capitalizeBrandName(mainDomain)

	return &BrandExtractionResult{
		BrandName:  brandName,
		Confidence: 0.6,
		Source:     "domain",
	}
}

// isValidBrandName checks if a string is a valid brand name
func (e *Extractor) isValidBrandName(name string) bool {
	// Must be between 2-50 characters
	if len(name) < 2 || len(name) > 50 {
		return false
	}

	// Must contain at least one letter
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(name)
	if !hasLetter {
		return false
	}

	// Should not be all numbers
	if regexp.MustCompile(`^\d+$`).MatchString(name) {
		return false
	}

	// Should not contain too many special characters
	specialChars := regexp.MustCompile(`[^a-zA-Z0-9\s\-&']`).FindAllString(name, -1)
	if len(specialChars) > 2 {
		return false
	}

	return true
}

// capitalizeBrandName capitalizes brand name appropriately
func (e *Extractor) capitalizeBrandName(name string) string {
	// If already has uppercase letters, preserve it
	if regexp.MustCompile(`[A-Z]`).MatchString(name) {
		return name
	}

	// Otherwise, capitalize first letter
	if len(name) == 0 {
		return name
	}

	return strings.ToUpper(name[:1]) + name[1:]
}

// NormalizeDomain extracts clean domain from URL or domain string
func NormalizeDomain(input string) string {
	// Remove protocol
	input = strings.TrimPrefix(input, "http://")
	input = strings.TrimPrefix(input, "https://")

	// Parse URL to get hostname
	if !strings.Contains(input, "/") {
		input = "http://" + input
	}

	parsed, err := url.Parse(input)
	if err != nil {
		// Fallback: simple string processing
		domain := strings.Split(input, "/")[0]
		domain = strings.ToLower(domain)
		if strings.HasPrefix(domain, "www.") {
			domain = domain[4:]
		}
		return domain
	}

	domain := parsed.Hostname()
	domain = strings.ToLower(domain)

	// Remove www. prefix
	if strings.HasPrefix(domain, "www.") {
		domain = domain[4:]
	}

	return domain
}
