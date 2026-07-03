package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ClaudeProvider 调 Anthropic Messages API。
type ClaudeProvider struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

// NewClaude 从环境变量构造:CLAUDE_API_KEY, CLAUDE_MODEL(可选)。
func NewClaude() *ClaudeProvider {
	model := strings.TrimSpace(os.Getenv("CLAUDE_MODEL"))
	if model == "" {
		model = "claude-sonnet-4-5"
	}
	base := strings.TrimSpace(os.Getenv("CLAUDE_BASE_URL"))
	if base == "" {
		base = "https://api.anthropic.com"
	}
	return &ClaudeProvider{
		apiKey:  strings.TrimSpace(os.Getenv("CLAUDE_API_KEY")),
		model:   model,
		baseURL: strings.TrimRight(base, "/"),
		client:  &http.Client{Timeout: 90 * time.Second},
	}
}

func (c *ClaudeProvider) Name() string { return "claude" }

func (c *ClaudeProvider) Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error) {
	if c.apiKey == "" {
		return CompletionResponse{}, fmt.Errorf("claude: CLAUDE_API_KEY not set")
	}
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 1024
	}
	msgs := make([]map[string]any, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, map[string]any{"role": m.Role, "content": m.Content})
	}
	payload := map[string]any{
		"model":      c.model,
		"max_tokens": maxTok,
		"messages":   msgs,
	}
	system := req.System
	if req.JSON {
		system = strings.TrimSpace(system + "\nRespond with a single valid JSON object and nothing else.")
	}
	if system != "" {
		payload["system"] = system
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return CompletionResponse{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/messages", bytes.NewReader(b))
	if err != nil {
		return CompletionResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CompletionResponse{}, fmt.Errorf("claude api error %d: %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return CompletionResponse{}, fmt.Errorf("claude: decode response: %w", err)
	}
	var sb strings.Builder
	for _, blk := range parsed.Content {
		if blk.Type == "text" {
			sb.WriteString(blk.Text)
		}
	}
	return CompletionResponse{Text: sb.String(), Model: parsed.Model, Provider: c.Name()}, nil
}
