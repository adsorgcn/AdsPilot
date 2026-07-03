package config

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// ConfigManager manages gateway configuration with hot reload support
type ConfigManager struct {
	configPath string
	mu         sync.RWMutex
	config     *Config
	version    int64
	onReload   []ReloadCallback
}

// ReloadCallback is called after successful config reload
type ReloadCallback func(oldConfig, newConfig *Config)

// NewConfigManager creates a new configuration manager
func NewConfigManager(configPath string) (*ConfigManager, error) {
	cfg, err := Load(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load initial config: %w", err)
	}

	return &ConfigManager{
		configPath: configPath,
		config:     cfg,
		version:    time.Now().UnixNano(),
		onReload:   make([]ReloadCallback, 0),
	}, nil
}

// Get returns the current configuration (read-only)
func (cm *ConfigManager) Get() *Config {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.config
}

// GetVersion returns the current configuration version
func (cm *ConfigManager) GetVersion() int64 {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.version
}

// Reload reloads the configuration from disk
func (cm *ConfigManager) Reload(ctx context.Context) error {
	// Load new configuration
	newConfig, err := Load(cm.configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Validate new configuration
	if err := newConfig.Validate(); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}

	// Atomically swap configurations
	cm.mu.Lock()
	oldConfig := cm.config
	cm.config = newConfig
	cm.version = time.Now().UnixNano()
	callbacks := cm.onReload
	cm.mu.Unlock()

	// Execute reload callbacks (outside of lock to prevent deadlocks)
	for _, callback := range callbacks {
		callback(oldConfig, newConfig)
	}

	return nil
}

// OnReload registers a callback to be called after successful config reload
func (cm *ConfigManager) OnReload(callback ReloadCallback) {
	cm.mu.Lock()
	defer cm.mu.Unlock()
	cm.onReload = append(cm.onReload, callback)
}

// ReloadFromBytes loads configuration from byte slice (useful for testing)
func (cm *ConfigManager) ReloadFromBytes(ctx context.Context, data []byte) error {
	// Parse new configuration
	newConfig, err := parseConfig(data)
	if err != nil {
		return fmt.Errorf("failed to parse config: %w", err)
	}

	// Validate new configuration
	if err := newConfig.Validate(); err != nil {
		return fmt.Errorf("invalid config: %w", err)
	}

	// Atomically swap configurations
	cm.mu.Lock()
	oldConfig := cm.config
	cm.config = newConfig
	cm.version = time.Now().UnixNano()
	callbacks := cm.onReload
	cm.mu.Unlock()

	// Execute reload callbacks
	for _, callback := range callbacks {
		callback(oldConfig, newConfig)
	}

	return nil
}

// String returns a summary of the current configuration
func (cm *ConfigManager) String() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return fmt.Sprintf("Config(version=%d, env=%s, routes=%d, backends=%d)",
		cm.version, cm.config.Environment, len(cm.config.Routes), len(cm.config.Backends))
}
