package provider

import (
	"context"
	"fmt"
	"os"
	"strings"
)

// Router 按任务把请求路由到某个 provider,配置全部来自环境变量。
// 换模型/换后端只改环境变量,不改代码。
//
//	AICORE_ROUTE_DEFAULT        默认后端(默认 claude)
//	AICORE_ROUTE_SELECT_OFFER   选 offer 任务用的后端
//	AICORE_ROUTE_DESIGN_AD      设计广告任务用的后端
//	AICORE_ROUTE_ANTIFRAUD      反作弊推理用的后端(默认 deepseek)
//	AICORE_FALLBACK             逗号分隔的兜底链,如 "claude,deepseek"
type Router struct {
	providers map[string]AIProvider
	routes    map[string]string
	def       string
	fallback  []string
}

// NewRouter 注册可用 provider 并从环境读取路由。
func NewRouter() *Router {
	r := &Router{
		providers: map[string]AIProvider{},
		routes:    map[string]string{},
	}
	// 注册后端(具体是否可用取决于对应的 API key 是否配置;
	// 未配 key 的后端在 Complete 时才返回错误,便于按需启用)
	r.providers["claude"] = NewClaude()
	r.providers["deepseek"] = NewDeepSeek()

	r.def = getenvDefault("AICORE_ROUTE_DEFAULT", "claude")
	r.routes["select_offer"] = getenvDefault("AICORE_ROUTE_SELECT_OFFER", r.def)
	r.routes["design_ad"] = getenvDefault("AICORE_ROUTE_DESIGN_AD", r.def)
	r.routes["antifraud"] = getenvDefault("AICORE_ROUTE_ANTIFRAUD", "deepseek")

	if fb := strings.TrimSpace(os.Getenv("AICORE_FALLBACK")); fb != "" {
		for _, name := range strings.Split(fb, ",") {
			name = strings.TrimSpace(name)
			if name != "" {
				r.fallback = append(r.fallback, name)
			}
		}
	}
	return r
}

// Providers 返回已注册后端名(用于 /health 等)。
func (r *Router) Providers() []string {
	out := make([]string, 0, len(r.providers))
	for k := range r.providers {
		out = append(out, k)
	}
	return out
}

// providerFor 返回某任务对应的后端名。
func (r *Router) providerFor(task string) string {
	if t := strings.TrimSpace(task); t != "" {
		if name, ok := r.routes[t]; ok {
			return name
		}
	}
	return r.def
}

// Complete 按任务选后端执行;失败则依次尝试兜底链。
func (r *Router) Complete(ctx context.Context, task string, req CompletionRequest) (CompletionResponse, error) {
	primary := r.providerFor(task)

	tried := map[string]bool{}
	order := append([]string{primary}, r.fallback...)

	var lastErr error
	for _, name := range order {
		if tried[name] {
			continue
		}
		tried[name] = true
		p, ok := r.providers[name]
		if !ok {
			lastErr = fmt.Errorf("aicore: unknown provider %q", name)
			continue
		}
		resp, err := p.Complete(ctx, req)
		if err == nil {
			return resp, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("aicore: no provider available")
	}
	return CompletionResponse{}, lastErr
}

func getenvDefault(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}
