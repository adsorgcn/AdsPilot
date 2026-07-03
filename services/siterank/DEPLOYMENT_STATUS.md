# Siterank 服务部署状态

## 最新更新: 2025-10-04

### 核心功能状态

| 功能 | 状态 | 说明 |
|------|------|------|
| Token计费集成 | ✅ 完成 | Pre-deduct + refund逻辑已实现 |
| AI评估(Vertex AI) | ✅ 完成 | 使用Vertex AI Gemini API |
| 前端Offer表格 | ✅ 完成 | AI推荐指数列和悬浮提示 |
| 用户订阅检查 | ✅ 完成 | Billing服务API集成 |
| Pub/Sub异步处理 | ✅ 完成 | 替换goroutine,提高可靠性 |
| Prometheus监控 | ✅ 完成 | 全面的metrics覆盖 |
| Prompt优化 | ✅ 完成 | 基于Nike真实数据优化 |
| 端到端测试 | ⏳ 待完成 | 需要部署后测试 |

### AI评估技术方案

**最终方案**: Vertex AI Gemini API ✅

**变更历史**:
1. 初版: Vertex AI (测试脚本使用)
2. 用户反馈: Firebase AI Logic启用Gemini Developer API
3. 问题: Gemini Developer API地区限制(中国不可用)
4. 最终方案: Vertex AI Gemini API (无地区限制,企业级)

**配置详情**:
- 模型: `gemini-1.5-flash-002`
- 区域: `asia-northeast1`
- 认证: Application Default Credentials (ADC)
- 权限: `roles/aiplatform.user` (已配置给codex-dev服务账号)

### 部署配置

**Cloud Run服务**: `siterank-preview`
- **Region**: asia-northeast1
- **Memory**: 2GB
- **CPU**: 2
- **并发**: 80
- **超时**: 300s
- **最大实例**: 10
- **服务账号**: codex-dev@${GCP_PROJECT_ID}.iam.gserviceaccount.com

**环境变量**:
- `GCP_PROJECT_ID`: ${GCP_PROJECT_ID}
- ~~`GEMINI_API_KEY`~~: 已移除(使用Vertex AI ADC)

### Prometheus Metrics

已添加以下metrics:

1. **评估指标**:
   - `siterank_evaluation_requests_total`: 评估请求总数
   - `siterank_evaluation_duration_seconds`: 评估耗时
   - `siterank_evaluation_cache_hits_total`: 缓存命中率

2. **AI指标**:
   - `siterank_ai_evaluation_score`: AI评分分布
   - `siterank_gemini_api_latency_seconds`: Gemini API延迟
   - `siterank_gemini_api_errors_total`: Gemini API错误

3. **计费指标**:
   - `siterank_tokens_consumed_total`: Token消耗总数
   - `siterank_token_reserve_success_total`: Token预扣成功
   - `siterank_token_commit_success_total`: Token提交成功
   - `siterank_token_release_success_total`: Token释放成功

4. **Pub/Sub指标**:
   - `siterank_pubsub_messages_received_total`: 消息接收
   - `siterank_pubsub_messages_processed_total`: 消息处理
   - `siterank_pubsub_processing_duration_seconds`: 处理耗时

### 关键文件

| 文件 | 说明 |
|------|------|
| `internal/aievaluator/service.go` | AI评估服务(Vertex AI) |
| `internal/metrics/metrics.go` | Prometheus指标定义 |
| `scripts/VERTEX_AI_SETUP.md` | Vertex AI配置文档 |
| `scripts/test_gemini_eval_real.go` | 真实数据测试脚本 |
| `scripts/deploy.sh` | 部署脚本 |
| `go.mod` | 依赖: cloud.google.com/go/vertexai v0.14.1 |

### 下一步

1. ✅ 部署到Cloud Run
2. ⏳ 端到端测试
3. ⏳ 性能监控和优化
4. ⏳ 生产环境部署

### 故障排查

#### Vertex AI相关

**问题**: `Permission denied` on Vertex AI API
**解决**:
```bash
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
  --member="serviceAccount:codex-dev@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

**问题**: 本地测试 `failed to initialize Vertex AI client`
**解决**: 配置ADC
```bash
gcloud auth application-default login
```

#### 构建相关

**问题**: `Dockerfile not found`
**解决**: 从项目根目录运行构建
```bash
cd /Users/jason/Documents/Kiro/gm
gcloud builds submit --config=services/siterank/cloudbuild.yaml
```

### 测试Nike数据结果

使用真实Nike SimilarWeb数据:
- Global Rank: #302
- Monthly Visits: 113M
- Bounce Rate: 40.8%
- Pages/Visit: 4.66
- Direct Traffic: 54.1%
- Category: Lifestyle/Fashion_and_Apparel (Rank: #4)

预期AI评估结果:
- 推荐指数: 85-95/100 (premium品牌)
- 行业: E-commerce - Fashion & Apparel
- 转化潜力: High

### 参考文档

- [Vertex AI Gemini API文档](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Prometheus Client Go](https://prometheus.io/docs/guides/go-application/)
- [Cloud Run服务配置](https://cloud.google.com/run/docs/configuring/services)
