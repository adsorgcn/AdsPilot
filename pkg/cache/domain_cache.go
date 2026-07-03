// Package cache provides domain-specific cache implementations
package cache

import (
	"context"
	"fmt"
	"time"
)

// DomainCacheType represents different types of domain caches
type DomainCacheType string

const (
	UserDomainCacheType     DomainCacheType = "user"
	BillingDomainCacheType  DomainCacheType = "billing"
	OfferDomainCacheType    DomainCacheType = "offer"
	AdsDomainCacheType      DomainCacheType = "ads"
	ActivityDomainCacheType DomainCacheType = "activity"
	AdminDomainCacheType    DomainCacheType = "admin"
)

// DomainCache provides domain-specific caching operations (base interface)
type DomainCache interface {
	CacheService
	// Domain statistics
	GetDomainStats(ctx context.Context) (DomainStats, error)

	// Domain configuration
	GetDomainConfig() DomainConfig
}

// UserDomainCache implements caching for user domain
type UserDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewUserDomainCache creates a new user domain cache
func NewUserDomainCache(baseService *DefaultCacheService, config DomainConfig) *UserDomainCache {
	return &UserDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetUserProfile retrieves user profile from cache
func (u *UserDomainCache) GetUserProfile(ctx context.Context, userID string) (interface{}, error) {
	key := u.generateKey("profile", userID)
	return u.Get(ctx, key)
}

// SetUserProfile stores user profile in cache
func (u *UserDomainCache) SetUserProfile(ctx context.Context, userID string, profile interface{}) error {
	key := u.generateKey("profile", userID)
	return u.Set(ctx, key, profile, u.config.TTL)
}

// InvalidateUser removes all cache entries for a user
func (u *UserDomainCache) InvalidateUser(ctx context.Context, userID string) error {
	pattern := u.generateKey("*", userID)
	return u.DeletePattern(ctx, pattern)
}

// GetDomainStats returns user domain specific statistics
func (u *UserDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := u.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(UserDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("user domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (u *UserDomainCache) GetDomainConfig() DomainConfig {
	return u.config
}

// generateKey generates cache keys for user domain
func (u *UserDomainCache) generateKey(entity string, id string) string {
	return fmt.Sprintf("user:%s:%s", entity, id)
}

// BillingDomainCache implements caching for billing domain
type BillingDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewBillingDomainCache creates a new billing domain cache
func NewBillingDomainCache(baseService *DefaultCacheService, config DomainConfig) *BillingDomainCache {
	return &BillingDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetTokenBalance retrieves token balance from cache
func (b *BillingDomainCache) GetTokenBalance(ctx context.Context, userID, tokenType string) (interface{}, error) {
	key := b.generateKey("balance", userID, tokenType)
	return b.Get(ctx, key)
}

// SetTokenBalance stores token balance in cache
func (b *BillingDomainCache) SetTokenBalance(ctx context.Context, userID, tokenType string, balance interface{}) error {
	key := b.generateKey("balance", userID, tokenType)
	return b.Set(ctx, key, balance, b.config.TTL)
}

// GetTransactions retrieves user transactions from cache
func (b *BillingDomainCache) GetTransactions(ctx context.Context, userID string, limit, offset int) (interface{}, error) {
	key := b.generateKey("transactions", userID, fmt.Sprintf("%d_%d", limit, offset))
	return b.Get(ctx, key)
}

// SetTransactions stores user transactions in cache
func (b *BillingDomainCache) SetTransactions(ctx context.Context, userID string, limit, offset int, transactions interface{}) error {
	key := b.generateKey("transactions", userID, fmt.Sprintf("%d_%d", limit, offset))
	return b.Set(ctx, key, transactions, b.config.TTL)
}

// InvalidateBillingUser removes all billing cache entries for a user
func (b *BillingDomainCache) InvalidateBillingUser(ctx context.Context, userID string) error {
	pattern := b.generateKey("*", userID, "*")
	return b.DeletePattern(ctx, pattern)
}

// GetDomainStats returns billing domain specific statistics
func (b *BillingDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := b.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(BillingDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("billing domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (b *BillingDomainCache) GetDomainConfig() DomainConfig {
	return b.config
}

// generateKey generates cache keys for billing domain
func (b *BillingDomainCache) generateKey(entity string, userID string, suffix string) string {
	return fmt.Sprintf("billing:%s:%s:%s", entity, userID, suffix)
}

// OfferDomainCache implements caching for offer domain
type OfferDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewOfferDomainCache creates a new offer domain cache
func NewOfferDomainCache(baseService *DefaultCacheService, config DomainConfig) *OfferDomainCache {
	return &OfferDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetOfferDetails retrieves offer details from cache
func (o *OfferDomainCache) GetOfferDetails(ctx context.Context, offerID string) (interface{}, error) {
	key := o.generateKey("details", offerID)
	return o.Get(ctx, key)
}

// SetOfferDetails stores offer details in cache
func (o *OfferDomainCache) SetOfferDetails(ctx context.Context, offerID string, details interface{}) error {
	key := o.generateKey("details", offerID)
	return o.Set(ctx, key, details, o.config.TTL)
}

// GetAnalysisResults retrieves AI analysis results from cache
func (o *OfferDomainCache) GetAnalysisResults(ctx context.Context, offerID, analysisType string) (interface{}, error) {
	key := o.generateKey("analysis", offerID, analysisType)
	return o.Get(ctx, key)
}

// SetAnalysisResults stores AI analysis results in cache
func (o *OfferDomainCache) SetAnalysisResults(ctx context.Context, offerID, analysisType string, results interface{}) error {
	key := o.generateKey("analysis", offerID, analysisType)
	return o.Set(ctx, key, results, o.config.TTL)
}

// GetKeywords retrieves offer keywords from cache
func (o *OfferDomainCache) GetKeywords(ctx context.Context, offerID string) (interface{}, error) {
	key := o.generateKey("keywords", offerID)
	return o.Get(ctx, key)
}

// SetKeywords stores offer keywords in cache
func (o *OfferDomainCache) SetKeywords(ctx context.Context, offerID string, keywords interface{}) error {
	key := o.generateKey("keywords", offerID)
	return o.Set(ctx, key, keywords, o.config.TTL)
}

// InvalidateOffer removes all cache entries for an offer
func (o *OfferDomainCache) InvalidateOffer(ctx context.Context, offerID string) error {
	pattern := o.generateKey("*", offerID)
	return o.DeletePattern(ctx, pattern)
}

// GetDomainStats returns offer domain specific statistics
func (o *OfferDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := o.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(OfferDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("offer domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (o *OfferDomainCache) GetDomainConfig() DomainConfig {
	return o.config
}

// generateKey generates cache keys for offer domain
func (o *OfferDomainCache) generateKey(entity string, offerID string, suffix ...string) string {
	key := fmt.Sprintf("offer:%s:%s", entity, offerID)
	for _, s := range suffix {
		key += ":" + s
	}
	return key
}

// AdsDomainCache implements caching for ads domain
type AdsDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewAdsDomainCache creates a new ads domain cache
func NewAdsDomainCache(baseService *DefaultCacheService, config DomainConfig) *AdsDomainCache {
	return &AdsDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetAccountConnections retrieves account connections from cache
func (a *AdsDomainCache) GetAccountConnections(ctx context.Context, userID string) (interface{}, error) {
	key := a.generateKey("accounts", userID)
	return a.Get(ctx, key)
}

// SetAccountConnections stores account connections in cache
func (a *AdsDomainCache) SetAccountConnections(ctx context.Context, userID string, connections interface{}) error {
	key := a.generateKey("accounts", userID)
	return a.Set(ctx, key, connections, a.config.TTL)
}

// GetPerformanceData retrieves performance data from cache
func (a *AdsDomainCache) GetPerformanceData(ctx context.Context, accountID, date string) (interface{}, error) {
	key := a.generateKey("performance", accountID, date)
	return a.Get(ctx, key)
}

// SetPerformanceData stores performance data in cache
func (a *AdsDomainCache) SetPerformanceData(ctx context.Context, accountID, date string, data interface{}) error {
	key := a.generateKey("performance", accountID, date)
	return a.Set(ctx, key, data, a.config.TTL)
}

// GetCampaigns retrieves campaigns from cache
func (a *AdsDomainCache) GetCampaigns(ctx context.Context, accountID string) (interface{}, error) {
	key := a.generateKey("campaigns", accountID)
	return a.Get(ctx, key)
}

// SetCampaigns stores campaigns in cache
func (a *AdsDomainCache) SetCampaigns(ctx context.Context, accountID string, campaigns interface{}) error {
	key := a.generateKey("campaigns", accountID)
	return a.Set(ctx, key, campaigns, a.config.TTL)
}

// InvalidateAdsAccount removes all cache entries for an ads account
func (a *AdsDomainCache) InvalidateAdsAccount(ctx context.Context, accountID string) error {
	pattern := a.generateKey("*", accountID)
	return a.DeletePattern(ctx, pattern)
}

// GetDomainStats returns ads domain specific statistics
func (a *AdsDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := a.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(AdsDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("ads domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (a *AdsDomainCache) GetDomainConfig() DomainConfig {
	return a.config
}

// generateKey generates cache keys for ads domain
func (a *AdsDomainCache) generateKey(entity string, accountID string, suffix ...string) string {
	key := fmt.Sprintf("ads:%s:%s", entity, accountID)
	for _, s := range suffix {
		key += ":" + s
	}
	return key
}

// ActivityDomainCache implements caching for activity domain
type ActivityDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewActivityDomainCache creates a new activity domain cache
func NewActivityDomainCache(baseService *DefaultCacheService, config DomainConfig) *ActivityDomainCache {
	return &ActivityDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetNotifications retrieves user notifications from cache
func (ac *ActivityDomainCache) GetNotifications(ctx context.Context, userID string, limit, offset int) (interface{}, error) {
	key := ac.generateKey("notifications", userID, fmt.Sprintf("%d_%d", limit, offset))
	return ac.Get(ctx, key)
}

// SetNotifications stores user notifications in cache
func (ac *ActivityDomainCache) SetNotifications(ctx context.Context, userID string, limit, offset int, notifications interface{}) error {
	key := ac.generateKey("notifications", userID, fmt.Sprintf("%d_%d", limit, offset))
	return ac.Set(ctx, key, notifications, ac.config.TTL)
}

// GetEvents retrieves user events from cache
func (ac *ActivityDomainCache) GetEvents(ctx context.Context, userID string, eventType string) (interface{}, error) {
	key := ac.generateKey("events", userID, eventType)
	return ac.Get(ctx, key)
}

// SetEvents stores user events in cache
func (ac *ActivityDomainCache) SetEvents(ctx context.Context, userID string, eventType string, events interface{}) error {
	key := ac.generateKey("events", userID, eventType)
	return ac.Set(ctx, key, events, ac.config.TTL)
}

// GetUserStats retrieves user activity statistics from cache
func (ac *ActivityDomainCache) GetUserStats(ctx context.Context, userID string, date string) (interface{}, error) {
	key := ac.generateKey("stats", userID, date)
	return ac.Get(ctx, key)
}

// SetUserStats stores user activity statistics in cache
func (ac *ActivityDomainCache) SetUserStats(ctx context.Context, userID string, date string, stats interface{}) error {
	key := ac.generateKey("stats", userID, date)
	return ac.Set(ctx, key, stats, ac.config.TTL)
}

// InvalidateActivityUser removes all activity cache entries for a user
func (ac *ActivityDomainCache) InvalidateActivityUser(ctx context.Context, userID string) error {
	pattern := ac.generateKey("*", userID)
	return ac.DeletePattern(ctx, pattern)
}

// GetDomainStats returns activity domain specific statistics
func (ac *ActivityDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := ac.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(ActivityDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("activity domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (ac *ActivityDomainCache) GetDomainConfig() DomainConfig {
	return ac.config
}

// generateKey generates cache keys for activity domain
func (ac *ActivityDomainCache) generateKey(entity string, userID string, suffix ...string) string {
	key := fmt.Sprintf("activity:%s:%s", entity, userID)
	for _, s := range suffix {
		key += ":" + s
	}
	return key
}

// AdminDomainCache implements caching for admin domain
type AdminDomainCache struct {
	*DefaultCacheService
	config DomainConfig
}

// NewAdminDomainCache creates a new admin domain cache
func NewAdminDomainCache(baseService *DefaultCacheService, config DomainConfig) *AdminDomainCache {
	return &AdminDomainCache{
		DefaultCacheService: baseService,
		config:              config,
	}
}

// GetSystemConfig retrieves system configuration from cache
func (ad *AdminDomainCache) GetSystemConfig(ctx context.Context, configKey string) (interface{}, error) {
	key := ad.generateKey("config", configKey)
	return ad.Get(ctx, key)
}

// SetSystemConfig stores system configuration in cache
func (ad *AdminDomainCache) SetSystemConfig(ctx context.Context, configKey string, config interface{}) error {
	key := ad.generateKey("config", configKey)
	return ad.Set(ctx, key, config, ad.config.TTL)
}

// GetSystemMetrics retrieves system metrics from cache
func (ad *AdminDomainCache) GetSystemMetrics(ctx context.Context, metricType string) (interface{}, error) {
	key := ad.generateKey("metrics", metricType)
	return ad.Get(ctx, key)
}

// SetSystemMetrics stores system metrics in cache
func (ad *AdminDomainCache) SetSystemMetrics(ctx context.Context, metricType string, metrics interface{}) error {
	key := ad.generateKey("metrics", metricType)
	// System metrics have shorter TTL
	return ad.Set(ctx, key, metrics, time.Minute*5)
}

// GetDomainStats returns admin domain specific statistics
func (ad *AdminDomainCache) GetDomainStats(ctx context.Context) (DomainStats, error) {
	stats, err := ad.GetStats(ctx)
	if err != nil {
		return DomainStats{}, err
	}

	if domainStats, exists := stats.DomainStats[string(AdminDomainCacheType)]; exists {
		return domainStats, nil
	}

	return DomainStats{}, fmt.Errorf("admin domain stats not found")
}

// GetDomainConfig returns the domain configuration
func (ad *AdminDomainCache) GetDomainConfig() DomainConfig {
	return ad.config
}

// generateKey generates cache keys for admin domain
func (ad *AdminDomainCache) generateKey(entity string, key string) string {
	return fmt.Sprintf("admin:%s:%s", entity, key)
}

// CacheManager manages all domain caches
type CacheManager struct {
	caches map[DomainCacheType]DomainCache
	config CacheConfig
	logger Logger
}

// NewCacheManager creates a new cache manager
func NewCacheManager(config CacheConfig, logger Logger) (*CacheManager, error) {
	// Create base cache service
	baseServiceInterface, err := NewCacheService(config, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to create base cache service: %w", err)
	}

	// Type assert to DefaultCacheService
	baseService, ok := baseServiceInterface.(*DefaultCacheService)
	if !ok {
		return nil, fmt.Errorf("base service is not of type *DefaultCacheService")
	}

	manager := &CacheManager{
		caches: make(map[DomainCacheType]DomainCache),
		config: config,
		logger: logger,
	}

	// Initialize domain caches
	if userConfig, exists := config.Domains["user"]; exists {
		manager.caches[UserDomainCacheType] = NewUserDomainCache(baseService, userConfig)
	}

	if billingConfig, exists := config.Domains["billing"]; exists {
		manager.caches[BillingDomainCacheType] = NewBillingDomainCache(baseService, billingConfig)
	}

	if offerConfig, exists := config.Domains["offer"]; exists {
		manager.caches[OfferDomainCacheType] = NewOfferDomainCache(baseService, offerConfig)
	}

	if adsConfig, exists := config.Domains["ads"]; exists {
		manager.caches[AdsDomainCacheType] = NewAdsDomainCache(baseService, adsConfig)
	}

	if activityConfig, exists := config.Domains["activity"]; exists {
		manager.caches[ActivityDomainCacheType] = NewActivityDomainCache(baseService, activityConfig)
	}

	if adminConfig, exists := config.Domains["admin"]; exists {
		manager.caches[AdminDomainCacheType] = NewAdminDomainCache(baseService, adminConfig)
	}

	logger.Info("Cache manager initialized", "domains", len(manager.caches))
	return manager, nil
}

// GetCache returns a specific domain cache
func (cm *CacheManager) GetCache(domainType DomainCacheType) (DomainCache, bool) {
	cache, exists := cm.caches[domainType]
	return cache, exists
}

// GetAllCaches returns all domain caches
func (cm *CacheManager) GetAllCaches() map[DomainCacheType]DomainCache {
	return cm.caches
}

// Close closes all domain caches
func (cm *CacheManager) Close() error {
	for _, cache := range cm.caches {
		if err := cache.Close(); err != nil {
			cm.logger.Error("Failed to close domain cache", "error", err)
		}
	}
	return nil
}
