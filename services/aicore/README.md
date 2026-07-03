# aicore

AI 抽象层(Phase 0)。统一 `AIProvider` 接口,把"选 offer / 设计广告 / 反作弊推理"等任务路由到可配置的后端(Claude / DeepSeek),换模型只改环境变量。

## 接口

`POST /api/v1/aicore/complete`(需鉴权)

```json
{
  "task": "select_offer",        // select_offer | design_ad | antifraud | 空=default
  "system": "...",
  "messages": [{"role":"user","content":"..."}],
  "json": true,                   // 要求结构化 JSON 输出
  "maxTokens": 1024
}
```

返回:`{ "text": "...", "model": "...", "provider": "claude" }`

## 环境变量

| 变量 | 说明 |
|---|---|
| `CLAUDE_API_KEY` | Anthropic API key |
| `CLAUDE_MODEL` | 默认 claude-sonnet-4-5 |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `DEEPSEEK_MODEL` | 默认 deepseek-chat |
| `AICORE_ROUTE_DEFAULT` | 默认后端(默认 claude) |
| `AICORE_ROUTE_SELECT_OFFER` | 选 offer 用的后端 |
| `AICORE_ROUTE_DESIGN_AD` | 设计广告用的后端 |
| `AICORE_ROUTE_ANTIFRAUD` | 反作弊推理用的后端(默认 deepseek) |
| `AICORE_FALLBACK` | 逗号分隔兜底链,如 `claude,deepseek` |
| `PORT` | 监听端口(默认 8080) |

## 扩展新后端

在 `internal/provider/` 新增一个实现 `AIProvider` 接口的文件,并在 `router.go` 的 `NewRouter()` 里注册一行。不改主干。
