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

// DeepSeekProvider 调 DeepSeek 的 OpenAI 兼容 chat/completions 接口。
type DeepSeekProvider struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

// NewDeepSeek 从环境变量构造:DEEPSEEK_API_KEY, DEEPSEEK_MODEL(可选)。
func NewDeepSeek() *DeepSeekProvider {
	model := strings.TrimSpace(os.Getenv("DEEPSEEK_MODEL"))
	if model == "" {
		model = "deepseek-chat"
	}
	base := strings.TrimSpace(os.Getenv("DEEPSEEK_BASE_URL"))
	if base == "" {
		base = "https://api.deepseek.com"
	}
	return &DeepSeekProvider{
		apiKey:  strings.TrimSpace(os.Getenv("DEEPSEEK_API_KEY")),
		model:   model,
		baseURL: strings.TrimRight(base, "/"),
		client:  &http.Client{Timeout: 90 * time.Second},
	}
}

func (d *DeepSeekProvider) Name() string { return "deepseek" }

func (d *DeepSeekProvider) Complete(ctx context.Context, req CompletionRequest) (CompletionResponse, error) {
	if d.apiKey == "" {
		return CompletionResponse{}, fmt.Errorf("deepseek: DEEPSEEK_API_KEY not set")
	}
	maxTok := req.MaxTokens
	if maxTok <= 0 {
		maxTok = 1024
	}
	msgs := make([]map[string]any, 0, len(req.Messages)+1)
	if strings.TrimSpace(req.System) != "" {
		msgs = append(msgs, map[string]any{"role": "system", "content": req.System})
	}
	for _, m := range req.Messages {
		msgs = append(msgs, map[string]any{"role": m.Role, "content": m.Content})
	}
	payload := map[string]any{
		"model":      d.model,
		"messages":   msgs,
		"max_tokens": maxTok,
	}
	if req.JSON {
		payload["response_format"] = map[string]any{"type": "json_object"}
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return CompletionResponse{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, d.baseURL+"/chat/completions", bytes.NewReader(b))
	if err != nil {
		return CompletionResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+d.apiKey)

	resp, err := d.client.Do(httpReq)
	if err != nil {
		return CompletionResponse{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CompletionResponse{}, fmt.Errorf("deepseek api error %d: %s", resp.StatusCode, string(body))
	}
	var parsed struct {
		Model   string `json:"model"`
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return CompletionResponse{}, fmt.Errorf("deepseek: decode response: %w", err)
	}
	text := ""
	if len(parsed.Choices) > 0 {
		text = parsed.Choices[0].Message.Content
	}
	return CompletionResponse{Text: text, Model: parsed.Model, Provider: d.Name()}, nil
}
