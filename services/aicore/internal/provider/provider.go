package provider

import "context"

// Message 是一条对话消息。
type Message struct {
	Role    string `json:"role"` // "user" | "assistant"
	Content string `json:"content"`
}

// CompletionRequest 是对 AI 的一次补全请求。
type CompletionRequest struct {
	System    string    `json:"system,omitempty"`
	Messages  []Message `json:"messages"`
	JSON      bool      `json:"json,omitempty"`      // 要求结构化 JSON 输出
	MaxTokens int       `json:"maxTokens,omitempty"` // 0 => 用默认值
}

// CompletionResponse 是 AI 的补全结果。
type CompletionResponse struct {
	Text     string `json:"text"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

// AIProvider 是所有 AI 后端的统一抽象。新增后端只实现此接口。
type AIProvider interface {
	Name() string
	Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error)
}
