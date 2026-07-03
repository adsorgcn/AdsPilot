package pool

import "fmt"

type noopManager struct{}

// ManagerInterface defines the subset of methods required by HTTP handlers.
type ManagerInterface interface {
	GetProxy(targetURL, country string) (string, error)
	ReleaseProxy(proxy, country string, success bool, responseTimeMs int) error
	GetStats(country string) (map[string]interface{}, error)
}

// NewNoopManager returns a stub manager that keeps the service alive without Redis.
func NewNoopManager() ManagerInterface {
	return &noopManager{}
}

func (n *noopManager) GetProxy(string, string) (string, error) {
	return "", fmt.Errorf("proxy pool is disabled: Redis not configured")
}

func (n *noopManager) ReleaseProxy(string, string, bool, int) error {
	return nil
}

func (n *noopManager) GetStats(string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"enabled": false,
		"message": "proxy pool is disabled: Redis not configured",
	}, nil
}
