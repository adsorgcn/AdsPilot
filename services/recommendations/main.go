package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/bigquery"
	"cloud.google.com/go/firestore"
	"github.com/ScientificInternet/Google-Monetize/pkg/errorreporting"
	apperr "github.com/ScientificInternet/Google-Monetize/pkg/errors"
	ev "github.com/ScientificInternet/Google-Monetize/pkg/events"
	httpx "github.com/ScientificInternet/Google-Monetize/pkg/http"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/telemetry"
	api "github.com/ScientificInternet/Google-Monetize/services/recommendations/internal/oapi"
	"github.com/ScientificInternet/Google-Monetize/services/recommendations/internal/storage"
	"github.com/go-chi/chi/v5"
	_ "github.com/lib/pq"
	"google.golang.org/api/iterator"
	"hash/fnv"
)

// Global service registry for calling other microservices
var serviceRegistry *serviceclient.Registry

func main() {
	ctx := context.Background()

	// Initialize service registry for microservice calls
	serviceRegistry = serviceclient.NewRegistry()
	log.Printf("Service registry initialized")

	// Setup distributed tracing (no-op if TRACES_ENABLED != 1)
	shutdownTracing := telemetry.SetupTracing("recommendations")
	defer func() { _ = shutdownTracing(ctx) }()

	// Setup error reporting (no-op if ERROR_REPORTING_ENABLED != 1)
	closeErrorReporting := errorreporting.Setup(ctx, "recommendations")
	defer closeErrorReporting()

	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	telemetry.RegisterDefaultMetrics("recommendations")
	r.Use(telemetry.ChiMiddleware("recommendations"))
	r.Use(middleware.LoggingMiddleware("recommendations"))
	r.Use(middleware.SecurityHeaders())
	r.Handle("/metrics", telemetry.MetricsHandler())
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		// DB readiness if configured
		if dsn := strings.TrimSpace(os.Getenv("DATABASE_URL")); dsn != "" {
			ctx, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
			defer cancel()
			if db, err := sql.Open("postgres", dsn); err == nil {
				defer db.Close()
				if err := db.PingContext(ctx); err != nil {
					apperr.Write(w, r, http.StatusInternalServerError, "NOT_READY", "db not ready", map[string]string{"db": err.Error()})
					return
				}
			} else {
				apperr.Write(w, r, http.StatusInternalServerError, "NOT_READY", "db open failed", map[string]string{"db": err.Error()})
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	})

	// Initialize database adapter with support for primary/read replica
	var adapter *storage.DualDatabaseAdapter
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	readDSN := strings.TrimSpace(os.Getenv("READ_REPLICA_URL"))

	if dsn != "" {
		var err error
		adapter, err = storage.NewDualDatabaseAdapter(dsn, readDSN)
		if err != nil {
			log.Fatalf("Failed to create database adapter: %v", err)
		}
		defer adapter.Close()

		// Test connections
		if err := adapter.Ping(ctx); err != nil {
			log.Fatalf("Database adapter ping failed: %v", err)
		}

		// DDL operations removed - use db-admin migrations instead
		// Schema creation should be handled through proper migration process
		log.Printf("WARNING: Runtime DDL operations removed from recommendations service. Use db-admin migrations instead.")

		// Verify required tables exist, but do not create them
		if err := adapter.VerifyTablesExist(ctx); err != nil {
			log.Printf("ERROR: Required tables missing. Please run db-admin migrations: %v", err)
		}

		log.Printf("Database adapter initialized (mode: %v)", adapter.GetMode())
		if readDSN != "" {
			log.Printf("Read replica connected successfully")
		} else {
			log.Printf("No read replica configured, using primary for all queries")
		}
	} else {
		log.Println("DATABASE_URL not set, running without database")
		adapter = nil
	}

	srv := &Server{cache: map[string]aliasCache{}, adapter: adapter}
	h := &oasImpl{srv: srv}
	oapiHandler := api.HandlerWithOptions(h, api.ChiServerOptions{
		BaseURL: "/api/v1",
		Middlewares: []api.MiddlewareFunc{
			func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
			func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
		},
	})
	r.Mount("/", oapiHandler)

	// Extra endpoints (not in OAS): opportunities create/list, keyword audit
	r.Handle("/api/v1/recommend/opportunities", middleware.AuthMiddleware(http.HandlerFunc(srv.createOpportunityHandler)))
	r.Handle("/api/v1/recommend/opportunities/", middleware.AuthMiddleware(http.HandlerFunc(srv.opportunitiesHandler)))
	r.Handle("/api/v1/recommend/internal/offline/keyword-audit", middleware.AuthMiddleware(http.HandlerFunc(srv.keywordAuditHandler)))
	// 非准入提示接口（放大阶段仅事后风险识别，不门禁）
	r.Handle("/api/v1/recommend/eligibility/scale", middleware.AuthMiddleware(http.HandlerFunc(srv.scaleEligibilityHandler)))
	// 建议生成（前移到推荐层，adscenter 仅承接 validate-only + mutate）
	r.Handle("/api/v1/recommend/suggested-actions", middleware.AuthMiddleware(http.HandlerFunc(srv.suggestedActionsHandler)))
	// 兼容无版本前缀的别名，便于通过 API Gateway/BFF 路由（/api/recommend/...）
	r.Handle("/api/recommend/eligibility/scale", middleware.AuthMiddleware(http.HandlerFunc(srv.scaleEligibilityHandler)))
	r.Handle("/api/recommend/suggested-actions", middleware.AuthMiddleware(http.HandlerFunc(srv.suggestedActionsHandler)))
	// Admin: list users and coverage by user
	r.Handle("/api/v1/recommend/brand-coverage/admin/users", middleware.AuthMiddleware(http.HandlerFunc(srv.listCoverageUsersHandler)))
	r.Handle("/api/v1/recommend/brand-coverage/admin/list", middleware.AuthMiddleware(http.HandlerFunc(srv.listCoverageByUserHandler)))

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8080"
	}
	log.Printf("recommendations v1.1.1 listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

type aliasCache struct {
	aliases []string
	exp     time.Time
}
type Server struct {
	cache   map[string]aliasCache
	adapter *storage.DualDatabaseAdapter // Database adapter with primary/read replica
}
type oasImpl struct{ srv *Server }

// --- Opportunities (persistence) ---
type opportunityReq struct {
	SeedDomain   string           `json:"seedDomain"`
	Country      string           `json:"country,omitempty"`
	SeedKeywords []string         `json:"seedKeywords,omitempty"`
	TopKeywords  []map[string]any `json:"topKeywords,omitempty"`
	TopDomains   []map[string]any `json:"topDomains,omitempty"`
	Metadata     map[string]any   `json:"meta,omitempty"`
}

func (s *Server) createOpportunityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	if s.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil)
		return
	}
	var body opportunityReq
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	// compute human-readable summary
	summary := summarizeOpportunity(body)
	bSeed, _ := json.Marshal(body.SeedKeywords)
	bTopKw, _ := json.Marshal(body.TopKeywords)
	bTopDom, _ := json.Marshal(body.TopDomains)
	bMeta, _ := json.Marshal(body.Metadata)
	// DDL operations removed - use db-admin migrations instead
	// Table creation should be handled through proper migration process
	if err := s.adapter.VerifyOpportunitiesTableExists(r.Context()); err != nil {
		log.Printf("ERROR: Opportunities table missing. Please run db-admin migrations: %v", err)
		apperr.Write(w, r, http.StatusInternalServerError, "SCHEMA_ERROR", "Database schema error. Contact administrator.", nil)
		return
	}
	var id int64
	id, err := s.adapter.CreateOpportunity(r.Context(), uid, seed, strings.TrimSpace(body.Country), string(bSeed), string(bTopKw), string(bTopDom), string(bMeta), summary)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "INSERT_FAILED", "insert failed", map[string]string{"error": err.Error()})
		return
	}
	// Best-effort Firestore UI cache
	go s.maybeWriteOpportunityUI(r.Context(), uid, id, seed, body, summary)
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "status": "ok", "summary": summary})
}

func (s *Server) opportunitiesHandler(w http.ResponseWriter, r *http.Request) {
	// supports GET /api/v1/recommend/opportunities and GET /api/v1/recommend/opportunities/{id}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	if s.adapter == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"items": []any{}})
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/recommend/opportunities")
	if path == "" || path == "/" { // list
		// optional filters
		q := r.URL.Query()
		limit := 50
		if v := strings.TrimSpace(q.Get("limit")); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 50 {
				limit = n
			}
		}
		cursor := int64(0)
		if v := strings.TrimSpace(q.Get("cursor")); v != "" {
			if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
				cursor = n
			}
		}
		seedFilter := strings.TrimSpace(q.Get("seedDomain"))
		country := strings.TrimSpace(q.Get("country"))

		where := "user_id=$1"
		args := []any{uid}
		idx := 2
		if seedFilter != "" {
			where += " AND seed_domain ILIKE $" + strconv.Itoa(idx)
			args = append(args, "%"+seedFilter+"%")
			idx++
		}
		if country != "" {
			where += " AND country=$" + strconv.Itoa(idx)
			args = append(args, country)
			idx++
		}
		if cursor > 0 {
			where += " AND id < $" + strconv.Itoa(idx)
			args = append(args, cursor)
			idx++
		}
		sqlStr := "SELECT id, seed_domain, country, COALESCE(top_keywords::text,'[]'), COALESCE(top_domains::text,'[]'), created_at FROM opportunities WHERE " + where + " ORDER BY id DESC LIMIT $" + strconv.Itoa(idx)
		args = append(args, limit)

		// 使用适配器的从数据库进行查询
		db := s.adapter.Secondary().GetDB()
		rows, err := db.Query(sqlStr, args...)
		if err != nil {
			apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		items := make([]map[string]any, 0, limit)
		lastID := int64(0)
		for rows.Next() {
			var id int64
			var seed, country, kwj, dj, summary string
			var created time.Time
			if err := rows.Scan(&id, &seed, &country, &kwj, &dj, &created); err == nil {
				var topKw any
				var topDom any
				_ = json.Unmarshal([]byte(kwj), &topKw)
				_ = json.Unmarshal([]byte(dj), &topDom)
				// summary existed only after schema update; for backward rows it will be empty
				// include summary if present via separate query (to avoid breaking existing select):
				var sum sql.NullString
				// 使用适配器的从数据库进行查询
				_ = db.QueryRow(`SELECT summary FROM opportunities WHERE id=$1`, id).Scan(&sum)
				if sum.Valid {
					summary = sum.String
				}
				items = append(items, map[string]any{"id": id, "seedDomain": seed, "country": country, "topKeywords": topKw, "topDomains": topDom, "summary": summary, "createdAt": created})
				lastID = id
			}
		}
		next := ""
		if len(items) == limit && lastID > 0 {
			next = strconv.FormatInt(lastID, 10)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"items": items, "next": next})
		return
	}
	// detail
	idStr := strings.TrimPrefix(path, "/")
	var id int64
	if v, err := strconv.ParseInt(idStr, 10, 64); err == nil {
		id = v
	} else {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid id", nil)
		return
	}
	var seed, country, seedKW, topKw, topDom, meta, summary string
	var created time.Time
	// 使用适配器的从数据库进行查询
	db := s.adapter.Secondary().GetDB()
	err := db.QueryRow(`SELECT seed_domain, country, COALESCE(seed_keywords::text,'[]'), COALESCE(top_keywords::text,'[]'), COALESCE(top_domains::text,'[]'), COALESCE(metadata::text,'{}'), COALESCE(summary,''), created_at FROM opportunities WHERE user_id=$1 AND id=$2`, uid, id).
		Scan(&seed, &country, &seedKW, &topKw, &topDom, &meta, &summary, &created)
	if err != nil {
		if err == sql.ErrNoRows {
			apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "opportunity not found", nil)
			return
		}
		apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	var seedArr, topKwArr, topDomArr any
	var metaObj any
	_ = json.Unmarshal([]byte(seedKW), &seedArr)
	_ = json.Unmarshal([]byte(topKw), &topKwArr)
	_ = json.Unmarshal([]byte(topDom), &topDomArr)
	_ = json.Unmarshal([]byte(meta), &metaObj)
	_ = json.NewEncoder(w).Encode(map[string]any{"id": id, "seedDomain": seed, "country": country, "seedKeywords": seedArr, "topKeywords": topKwArr, "topDomains": topDomArr, "meta": metaObj, "summary": summary, "createdAt": created})
}

// ---- Offline keyword audit (simplified, extra endpoint) ----
// POST /api/v1/recommend/internal/offline/keyword-audit
// Body: { seedDomain?: string, country?: string, keywords: [string] }
// Returns: { coveragePercent, missing: [string], redundant: [string], brandTokens: [string], suggestions: [ { action, reason } ] }
func (s *Server) keywordAuditHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	if r.Method != http.MethodPost {
		apperr.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	var body struct {
		SeedDomain string   `json:"seedDomain"`
		Country    string   `json:"country"`
		Keywords   []string `json:"keywords"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	kws := map[string]struct{}{}
	for _, k := range body.Keywords {
		k = strings.ToLower(strings.TrimSpace(k))
		if k != "" {
			kws[k] = struct{}{}
		}
	}
	// derive brand tokens from seedDomain
	brandTokens := []string{}
	if d := strings.TrimSpace(body.SeedDomain); d != "" {
		host := d
		if u, err := url.Parse("https://" + d); err == nil {
			host = u.Hostname()
		}
		parts := strings.FieldsFunc(host, func(r rune) bool { return r == '.' || r == '-' || r == '_' })
		if len(parts) >= 2 {
			brandTokens = append(brandTokens, strings.ToLower(parts[len(parts)-2]))
		}
		if len(parts) >= 3 {
			brandTokens = append(brandTokens, strings.ToLower(parts[len(parts)-3]))
		}
	}
	// simple expected keyword list: brand tokens + country token if provided
	expected := map[string]struct{}{}
	for _, t := range brandTokens {
		if t != "" {
			expected[t] = struct{}{}
		}
	}
	if c := strings.ToLower(strings.TrimSpace(body.Country)); c != "" {
		expected[c] = struct{}{}
	}
	// coverage stats
	missing := []string{}
	matched := 0
	for e := range expected {
		found := false
		for k := range kws {
			if strings.Contains(k, e) || strings.Contains(e, k) {
				found = true
				break
			}
		}
		if found {
			matched++
		} else {
			missing = append(missing, e)
		}
	}
	redundant := []string{}
	for k := range kws {
		if _, ok := expected[k]; !ok {
			// treat very short or stopwords as neutral, skip
			if len(k) <= 2 {
				continue
			}
			redundant = append(redundant, k)
		}
	}
	cov := 100.0
	if len(expected) > 0 {
		cov = float64(matched) / float64(len(expected)) * 100.0
	}
	// suggestions
	suggestions := []map[string]string{}
	if len(missing) > 0 {
		suggestions = append(suggestions, map[string]string{"action": "ADD_KEYWORDS", "reason": "覆盖缺失：" + strings.Join(missing, ",")})
	}
	if len(redundant) > 0 {
		suggestions = append(suggestions, map[string]string{"action": "PAUSE_IRRELEVANT", "reason": "可能不相关：" + strings.Join(redundant[:min(5, len(redundant))], ",") + " ..."})
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"coveragePercent": cov,
		"missing":         missing,
		"redundant":       redundant,
		"brandTokens":     brandTokens,
		"suggestions":     suggestions,
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// POST /api/v1/recommend/suggested-actions
// 输入：{ metrics: { impressions, ctr, qualityScore, dailyBudget, budgetPacing, conversions? }, landingUrl? }
// 输出：{ suggestedActions: [ { action, params?, reason?, estimate? } ] }
func (s *Server) suggestedActionsHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	var body struct {
		Metrics    map[string]any `json:"metrics"`
		LandingURL string         `json:"landingUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	m := func(k string, def float64) float64 {
		if v, ok := body.Metrics[k]; ok {
			switch t := v.(type) {
			case float64:
				return t
			case int:
				return float64(t)
			case int64:
				return float64(t)
			}
		}
		return def
	}
	impressions := m("impressions", 0)
	ctr := m("ctr", 0)
	qs := m("qualityScore", 0)
	dailyBudget := m("dailyBudget", 0)
	budgetPacing := m("budgetPacing", 0)
	conversions := m("conversions", 0)
	out := make([]map[string]any, 0, 6)
	add := func(action string, params map[string]any, reason string, estimate map[string]any) {
		it := map[string]any{"action": action}
		if params != nil {
			it["params"] = params
		}
		if reason != "" {
			it["reason"] = reason
		}
		if estimate != nil {
			it["estimate"] = estimate
		}
		out = append(out, it)
	}
	// 规则与 adscenter 保持一致（KISS），仅在推荐层生成建议
	if dailyBudget <= 0 {
		add("ADJUST_BUDGET", map[string]any{"dailyBudget": 50}, "设置合理日预算", map[string]any{"expectedImprDelta": "+20%~+50%"})
	} else if budgetPacing >= 1.0 {
		add("ADJUST_BUDGET", map[string]any{"percent": 20}, "预算耗尽，适度提升预算", map[string]any{"expectedImprDelta": "+10%~+30%"})
	}
	if impressions > 100 && ctr < 0.5 {
		add("ADJUST_CPC", map[string]any{"percent": 10}, "点击率偏低，适度提升出价测试", map[string]any{"expectedCtrDelta": "+0.1~+0.3"})
	}
	if qs > 0 && qs < 5 {
		add("ADJUST_CPC", map[string]any{"percent": 10}, "质量得分偏低，短期提升排名", map[string]any{"risk": "CPC 上升"})
	}
	if u := strings.TrimSpace(body.LandingURL); u != "" {
		if !strings.Contains(u, "utm_") && !strings.Contains(u, "gclid=") {
			add("ROTATE_LINK", map[string]any{"links": []string{u}}, "缺少常见跟踪参数，建议统一链接管理并追加参数", map[string]any{"suggest": "在链接后追加 utm_* 或启用自动标记"})
		}
	}
	if impressions > 300 && ctr >= 0.8 && conversions <= 0 {
		add("ROTATE_LINK", nil, "有点击无转化，建议检查/优化落地页并分批替换链接做对照", map[string]any{"expectedConvDelta": "+5%~+20%"})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"suggestedActions": out})
}

// POST /api/v1/recommend/eligibility/scale
// 说明：放大阶段“非准入”接口，仅返回提示信息，不作为执行门禁
// body: { seedDomain: string, accountId?: string, minCoverage?: number }
// resp: { eligible: true, gating: false, coverageRatio?: number, missingAliases?: [string], warnings?: [string] }
func (s *Server) scaleEligibilityHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	var body struct {
		SeedDomain  string  `json:"seedDomain"`
		AccountId   string  `json:"accountId"`
		MinCoverage float64 `json:"minCoverage"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	acct := strings.TrimSpace(body.AccountId)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	threshold := 0.6
	if body.MinCoverage > 0 && body.MinCoverage <= 1.0 {
		threshold = body.MinCoverage
	}
	resp := map[string]any{"eligible": true, "gating": false}
	// best-effort: read last coverage for hints
	if s.adapter != nil && acct != "" {
		var ratio float64
		var missingTxt sql.NullString
		// 使用适配器的从数据库进行查询
		if err := s.adapter.Secondary().GetDB().QueryRow(`SELECT coverage_ratio, missing_aliases::text FROM brand_coverage_results WHERE seed_domain=$1 AND account_id=$2`, seed, acct).Scan(&ratio, &missingTxt); err == nil {
			resp["coverageRatio"] = ratio
			if missingTxt.Valid {
				var missing []string
				_ = json.Unmarshal([]byte(missingTxt.String), &missing)
				resp["missingAliases"] = missing
				warns := []string{}
				if ratio < threshold {
					warns = append(warns, "品牌词覆盖度较低，建议补充别名关键词")
				}
				if len(missing) > 0 {
					warns = append(warns, "缺失别名："+strings.Join(missing, ", "))
				}
				if len(warns) > 0 {
					resp["warnings"] = warns
				}
			}
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// ensureOpportunitiesDDL has been removed - DDL operations should use db-admin migrations
// This function is deprecated and should not be called
func ensureOpportunitiesDDL(db *sql.DB) error {
	log.Printf("WARNING: ensureOpportunitiesDDL is deprecated. Use db-admin migrations instead.")
	return fmt.Errorf("deprecated function: use db-admin migrations for DDL operations")
}

func (s *Server) maybeWriteOpportunityUI(ctx context.Context, uid string, id int64, seed string, body opportunityReq, summary string) {
	if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" {
		return
	}
	pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if pid == "" {
		pid = strings.TrimSpace(os.Getenv("PROJECT_ID"))
	}
	if pid == "" || uid == "" {
		return
	}
	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()
	cli, err := firestore.NewClient(cctx, pid)
	if err != nil {
		return
	}
	defer cli.Close()
	doc := map[string]any{
		"seedDomain":   seed,
		"country":      body.Country,
		"seedKeywords": body.SeedKeywords,
		"topKeywords":  body.TopKeywords,
		"topDomains":   body.TopDomains,
		"summary":      summary,
		"createdAt":    time.Now().UTC(),
	}
	_, _ = cli.Collection("users/"+uid+"/recommendations/opportunities").Doc(fmt.Sprintf("%d", id)).Set(cctx, doc)
}

// summarizeOpportunity builds a short human-readable reason summary from keywords and domains.
func summarizeOpportunity(body opportunityReq) string {
	kw := make([]string, 0, 3)
	for _, it := range body.TopKeywords {
		if s, ok := it["keyword"].(string); ok && strings.TrimSpace(s) != "" {
			kw = append(kw, s)
		}
		if len(kw) >= 3 {
			break
		}
	}
	dm := make([]string, 0, 3)
	for _, it := range body.TopDomains {
		if s, ok := it["domain"].(string); ok && strings.TrimSpace(s) != "" {
			dm = append(dm, s)
		}
		if len(dm) >= 3 {
			break
		}
	}
	parts := []string{}
	if len(kw) > 0 {
		parts = append(parts, "关键词: "+strings.Join(kw, ", "))
	}
	if len(dm) > 0 {
		parts = append(parts, "相似域名: "+strings.Join(dm, ", "))
	}
	if body.Country != "" {
		parts = append(parts, "国家: "+body.Country)
	}
	if body.SeedDomain != "" {
		parts = append(parts, "Seed: "+body.SeedDomain)
	}
	if len(parts) == 0 {
		return "自动分析机会"
	}
	return strings.Join(parts, " | ")
}

// POST /recommend/keywords/brand-check
func (h *oasImpl) BrandCheck(w http.ResponseWriter, r *http.Request) {
	type req struct {
		SeedDomain string   `json:"seedDomain"`
		Keywords   []string `json:"keywords"`
		Locale     string   `json:"locale"`
		LandingURL string   `json:"landingUrl"`
	}
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	if seed == "" || len(body.Keywords) == 0 {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain and keywords required", nil)
		return
	}

	// Build brand alias set (with cache + optional landing page signals)
	aliases := h.srv.getAliases(seed, body.LandingURL)

	items := make([]api.BrandCheckItem, 0, len(body.Keywords))
	for _, kw := range body.Keywords {
		k := strings.TrimSpace(kw)
		if k == "" {
			continue
		}
		norm := normalize(k)
		contains, matched, method, score := matchBrand(norm, aliases)
		severity := "none"
		if contains && method == "exact" {
			severity = "error"
		} else if contains && method == "fuzzy" {
			severity = "warn"
		}
		it := api.BrandCheckItem{Keyword: k, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(severity)}
		if matched != "" {
			it.MatchedAlias = &matched
		}
		if score > 0 {
			s := float32(score)
			it.Score = &s
		}
		items = append(items, it)
	}
	// best-effort persistence
	go h.srv.persistResults(seed, aliases, items)
	// best-effort Firestore UI write
	if uid, _ := r.Context().Value(middleware.UserIDKey).(string); uid != "" {
		go h.srv.maybeWriteFirestore(r.Context(), uid, seed, items)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Items []api.BrandCheckItem `json:"items"`
	}{Items: items})
}

// POST /recommend/internal/offline/brand-audit
func (h *oasImpl) OfflineBrandAudit(w http.ResponseWriter, r *http.Request) {
	var body api.OfflineBrandAuditJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	// collect keywords: prefer provided; else try BigQuery if enabled; else 202 without work
	keywords := make([]string, 0)
	if body.Keywords != nil {
		for _, k := range *body.Keywords {
			k = strings.TrimSpace(k)
			if k != "" {
				keywords = append(keywords, k)
			}
		}
	}
	// shard parameters (optional)
	totalShards := 0
	shard := 0
	if body.TotalShards != nil && *body.TotalShards > 0 {
		totalShards = int(*body.TotalShards)
	}
	if body.Shard != nil && *body.Shard >= 0 {
		shard = int(*body.Shard)
	}

	if len(keywords) == 0 && strings.EqualFold(strings.TrimSpace(os.Getenv("BQ_ENABLED")), "1") {
		days := 30
		if body.Days != nil && *body.Days > 0 {
			days = int(*body.Days)
		}
		limit := 1000
		if body.Limit != nil && *body.Limit > 0 {
			limit = int(*body.Limit)
		}
		acct := ""
		if body.AccountId != nil {
			acct = strings.TrimSpace(*body.AccountId)
		}
		if ks, err := fetchKeywordsFromBigQuery(r.Context(), days, limit, acct); err == nil {
			keywords = ks
		}
	}
	if len(keywords) == 0 {
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "accepted", "message": "no keywords to audit"})
		return
	}
	// shard filtering (optional)
	if totalShards > 0 && shard < totalShards {
		filtered := make([]string, 0, len(keywords))
		for _, k := range keywords {
			hsh := fnvHash(k) % totalShards
			if hsh == shard {
				filtered = append(filtered, k)
			}
		}
		keywords = filtered
	}
	// run audit (best-effort)
	go func(seed string, list []string) {
		aliases := h.srv.getAliases(seed, "")
		items := make([]api.BrandCheckItem, 0, len(list))
		for _, kw := range list {
			k := strings.TrimSpace(kw)
			if k == "" {
				continue
			}
			norm := normalize(k)
			contains, matched, method, score := matchBrand(norm, aliases)
			sev := "none"
			if contains && method == "exact" {
				sev = "error"
			} else if contains && method == "fuzzy" {
				sev = "warn"
			}
			it := api.BrandCheckItem{Keyword: k, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(sev)}
			if matched != "" {
				it.MatchedAlias = &matched
			}
			if score > 0 {
				s := float32(score)
				it.Score = &s
			}
			items = append(items, it)
		}
		h.srv.persistResults(seed, aliases, items)
	}(seed, keywords)
	w.WriteHeader(http.StatusAccepted)
	resp := map[string]any{"status": "accepted", "seedDomain": seed, "keywords": len(keywords)}
	if totalShards > 0 {
		resp["shard"] = shard
		resp["totalShards"] = totalShards
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// POST /recommend/internal/offline/brand-coverage-audit
func (h *oasImpl) OfflineBrandCoverageAudit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SeedDomain  string  `json:"seedDomain"`
		AccountId   *string `json:"accountId"`
		Days        *int    `json:"days"`
		Shard       *int    `json:"shard"`
		TotalShards *int    `json:"totalShards"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	acct := ""
	if body.AccountId != nil {
		acct = strings.TrimSpace(*body.AccountId)
	}
	days := 30
	if body.Days != nil && *body.Days > 0 {
		days = *body.Days
	}
	shard := 0
	if body.Shard != nil && *body.Shard >= 0 {
		shard = *body.Shard
	}
	total := 0
	if body.TotalShards != nil && *body.TotalShards > 0 {
		total = *body.TotalShards
	}
	go func() {
		aliases := h.srv.getAliases(seed, "")
		// Pull keywords from BigQuery if enabled; else noop
		kws := []string{}
		if strings.EqualFold(strings.TrimSpace(os.Getenv("BQ_ENABLED")), "1") {
			if arr, err := fetchKeywordsFromBigQuery(context.Background(), days, 50000, acct); err == nil {
				kws = arr
			}
		}
		if total > 0 && shard < total {
			filtered := make([]string, 0, len(kws))
			for _, k := range kws {
				if fnvHash(k)%total == shard {
					filtered = append(filtered, k)
				}
			}
			kws = filtered
		}
		totalKw := len(kws)
		brandKw := 0
		aliasSet := map[string]struct{}{}
		for _, a := range aliases {
			a = normalize(a)
			if len(a) >= 3 {
				aliasSet[a] = struct{}{}
			}
		}
		coveredAlias := map[string]struct{}{}
		for _, k := range kws {
			norm := normalize(k)
			for a := range aliasSet {
				if strings.Contains(norm, a) {
					brandKw++
					coveredAlias[a] = struct{}{}
					break
				}
			}
		}
		missing := make([]string, 0)
		for a := range aliasSet {
			if _, ok := coveredAlias[a]; !ok {
				missing = append(missing, a)
			}
		}
		ratio := 0.0
		if totalKw > 0 {
			ratio = float64(brandKw) / float64(totalKw)
		}
		// persist to SQL
		if h.srv.adapter != nil {
			_ = h.srv.upsertCoverage(seed, acct, totalKw, brandKw, ratio, missing)
		}
		// best-effort: resolve userId from AdsAccountMetrics for UI/notifications
		userID := ""
		if h.srv.adapter != nil && strings.TrimSpace(acct) != "" {
			_ = h.srv.adapter.Secondary().GetDB().QueryRow(`SELECT user_id FROM "AdsAccountMetrics" WHERE customer_id=$1 ORDER BY updated_at DESC LIMIT 1`, acct).Scan(&userID)
		}
		// Firestore UI cache (best-effort)
		if userID != "" && strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) == "1" {
			pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
			if pid == "" {
				pid = strings.TrimSpace(os.Getenv("PROJECT_ID"))
			}
			if pid != "" {
				ctx2, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
				defer cancel()
				if cli, err := firestore.NewClient(ctx2, pid); err == nil {
					doc := map[string]any{
						"seedDomain":     seed,
						"accountId":      acct,
						"totalKeywords":  totalKw,
						"brandKeywords":  brandKw,
						"coverageRatio":  ratio,
						"missingAliases": missing,
						"updatedAt":      time.Now().UTC(),
					}
					docID := seed + "_" + acct
					_, _ = cli.Collection("users/"+userID+"/recommendations/brand-coverage").Doc(docID).Set(ctx2, doc)
					_ = cli.Close()
				}
			}
		}
		// Publish event for notifications (best-effort)
		if pub, err := ev.NewPublisher(context.Background()); err == nil {
			_ = pub.Publish(context.Background(), "BrandCoverageComputed", map[string]any{
				"userId":         userID,
				"seedDomain":     seed,
				"accountId":      acct,
				"totalKeywords":  totalKw,
				"brandKeywords":  brandKw,
				"coverageRatio":  ratio,
				"missingAliases": missing,
				"time":           time.Now().UTC().Format(time.RFC3339),
			}, ev.WithSource("recommendations"))
			pub.Close()
		}
	}()
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "accepted", "seedDomain": seed, "accountId": acct, "days": days, "shard": shard, "totalShards": total})
}

// GET /recommend/keywords/brand-profile
func (h *oasImpl) GetBrandProfile(w http.ResponseWriter, r *http.Request, params api.GetBrandProfileParams) {
	seed := strings.TrimSpace(params.SeedDomain)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	// try DB then cache compute (use read replica for queries)
	var aliases []string
	var updated *time.Time
	if h.srv.adapter != nil {
		var jsonText sql.NullString
		var upd sql.NullTime
		_ = h.srv.adapter.Secondary().GetDB().QueryRow(`SELECT aliases::text, updated_at FROM brand_profile WHERE seed_domain=$1`, seed).Scan(&jsonText, &upd)
		if jsonText.Valid {
			_ = json.Unmarshal([]byte(jsonText.String), &aliases)
		}
		if upd.Valid {
			t := upd.Time
			updated = &t
		}
	}
	if len(aliases) == 0 {
		aliases = h.srv.getAliases(seed, "")
		now := time.Now().UTC()
		updated = &now
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"seedDomain": seed, "aliases": aliases, "updatedAt": updated})
}

// GET /recommend/keywords/brand-results
func (h *oasImpl) ListBrandResults(w http.ResponseWriter, r *http.Request, params api.ListBrandResultsParams) {
	seed := strings.TrimSpace(params.SeedDomain)
	if seed == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain required", nil)
		return
	}
	limit := 50
	if params.Limit != nil && *params.Limit > 0 && *params.Limit <= 500 {
		limit = int(*params.Limit)
	}
	cursor := 0
	if params.Cursor != nil {
		if v, err := strconv.Atoi(strings.TrimSpace(*params.Cursor)); err == nil && v > 0 {
			cursor = v
		}
	}
	// require DB (use read replica for queries)
	if h.srv.adapter == nil {
		_ = json.NewEncoder(w).Encode(map[string]any{"items": []any{}, "next": ""})
		return
	}
	var rows *sql.Rows
	var err error
	// optional filters
	where := "seed_domain=$1"
	args := []any{seed}
	idx := 2
	if params.Severity != nil && *params.Severity != "" {
		where += fmt.Sprintf(" AND severity=$%d", idx)
		args = append(args, string(*params.Severity))
		idx++
	}
	if params.ContainsBrand != nil {
		where += fmt.Sprintf(" AND contains_brand=$%d", idx)
		args = append(args, *params.ContainsBrand)
		idx++
	}
	if cursor > 0 {
		where += fmt.Sprintf(" AND id < $%d", idx)
		args = append(args, cursor)
		idx++
	}
	q := fmt.Sprintf("SELECT id, keyword, contains_brand, COALESCE(matched_alias,''), COALESCE(method,''), COALESCE(score,0), severity FROM keyword_risk_results WHERE %s ORDER BY id DESC LIMIT $%d", where, idx)
	args = append(args, limit)
	rows, err = h.srv.adapter.Secondary().GetDB().Query(q, args...)
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items := make([]api.BrandCheckItem, 0, limit)
	lastID := 0
	for rows.Next() {
		var id int
		var kw, matched, method, severity string
		var contains bool
		var score float64
		if err := rows.Scan(&id, &kw, &contains, &matched, &method, &score, &severity); err != nil {
			continue
		}
		it := api.BrandCheckItem{Keyword: kw, ContainsBrand: contains, Method: api.BrandCheckItemMethod(method), Severity: api.BrandCheckItemSeverity(severity)}
		if strings.TrimSpace(matched) != "" {
			it.MatchedAlias = &matched
		}
		if score > 0 {
			s := float32(score)
			it.Score = &s
		}
		items = append(items, it)
		lastID = id
	}
	next := ""
	if len(items) == limit && lastID > 0 {
		next = strconv.Itoa(lastID)
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items, "next": next})
}

func fnvHash(s string) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return int(h.Sum32())
}

func (s *Server) upsertCoverage(seed, account string, totalKw, brandKw int, ratio float64, missing []string) error {
	if s.adapter == nil {
		return nil
	}
	// 使用适配器的主数据库进行写入
	db := s.adapter.Primary().GetDB()
	b, _ := json.Marshal(missing)
	// DDL operations removed - use db-admin migrations instead
	// Verify brand_coverage_results table exists
	var tableExists bool
	_ = db.QueryRow(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'brand_coverage_results')`).Scan(&tableExists)
	if !tableExists {
		log.Printf("ERROR: brand_coverage_results table missing. Please run db-admin migrations.")
		return fmt.Errorf("database schema error: brand_coverage_results table missing")
	}
	_, err := db.Exec(`
        INSERT INTO brand_coverage_results(seed_domain, account_id, total_keywords, brand_keywords, coverage_ratio, missing_aliases, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW())
        ON CONFLICT (seed_domain, account_id) DO UPDATE SET total_keywords=EXCLUDED.total_keywords, brand_keywords=EXCLUDED.brand_keywords, coverage_ratio=EXCLUDED.coverage_ratio, missing_aliases=EXCLUDED.missing_aliases, updated_at=NOW()
    `, seed, account, totalKw, brandKw, ratio, string(b))
	return err
}

// GET /recommend/brand-coverage
func (h *oasImpl) GetBrandCoverage(w http.ResponseWriter, r *http.Request, params api.GetBrandCoverageParams) {
	seed := strings.TrimSpace(params.SeedDomain)
	acct := strings.TrimSpace(params.AccountId)
	if seed == "" || acct == "" {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain & accountId required", nil)
		return
	}
	if h.srv.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil)
		return
	}
	var totalKw, brandKw int
	var ratio float64
	var missingTxt sql.NullString
	var updated sql.NullTime
	err := h.srv.adapter.Secondary().GetDB().QueryRow(`SELECT total_keywords, brand_keywords, coverage_ratio, missing_aliases::text, updated_at FROM brand_coverage_results WHERE seed_domain=$1 AND account_id=$2`, seed, acct).Scan(&totalKw, &brandKw, &ratio, &missingTxt, &updated)
	if err != nil {
		if err == sql.ErrNoRows {
			apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "coverage not found", nil)
			return
		}
		apperr.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	var missing []string
	if missingTxt.Valid {
		_ = json.Unmarshal([]byte(missingTxt.String), &missing)
	}
	resp := map[string]any{
		"seedDomain":     seed,
		"accountId":      acct,
		"totalKeywords":  totalKw,
		"brandKeywords":  brandKw,
		"coverageRatio":  ratio,
		"missingAliases": missing,
		"updatedAt": func() *time.Time {
			if updated.Valid {
				t := updated.Time
				return &t
			}
			return nil
		}(),
	}
	_ = json.NewEncoder(w).Encode(resp)
}

// CreateOpportunity delegates to the existing createOpportunityHandler
func (h *oasImpl) CreateOpportunity(w http.ResponseWriter, r *http.Request) {
	h.srv.createOpportunityHandler(w, r)
}

// POST /recommend/brand-coverage/planned
func (h *oasImpl) GetPlannedBrandCoverage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		SeedDomain string   `json:"seedDomain"`
		Keywords   []string `json:"keywords"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	seed := strings.TrimSpace(body.SeedDomain)
	if seed == "" || len(body.Keywords) == 0 {
		apperr.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "seedDomain & keywords required", nil)
		return
	}
	aliases := h.srv.getAliases(seed, "")
	aliasSet := map[string]struct{}{}
	for _, a := range aliases {
		a = normalize(a)
		if len(a) >= 3 {
			aliasSet[a] = struct{}{}
		}
	}
	totalKw := 0
	brandKw := 0
	coveredAlias := map[string]struct{}{}
	for _, k := range body.Keywords {
		k = strings.TrimSpace(k)
		if k == "" {
			continue
		}
		totalKw++
		norm := normalize(k)
		for a := range aliasSet {
			if strings.Contains(norm, a) {
				brandKw++
				coveredAlias[a] = struct{}{}
				break
			}
		}
	}
	missing := make([]string, 0)
	for a := range aliasSet {
		if _, ok := coveredAlias[a]; !ok {
			missing = append(missing, a)
		}
	}
	ratio := 0.0
	if totalKw > 0 {
		ratio = float64(brandKw) / float64(totalKw)
	}
	resp := map[string]any{
		"seedDomain":     seed,
		"totalKeywords":  totalKw,
		"brandKeywords":  brandKw,
		"coverageRatio":  ratio,
		"missingAliases": missing,
		"updatedAt":      time.Now().UTC(),
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func envInt(k string, def int) int {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}
func envFloat(k string, def float64) float64 {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return def
}

// --- helpers ---
func (s *Server) getAliases(seedDomain, landingURL string) []string {
	key := strings.ToLower(strings.TrimSpace(seedDomain)) + "|" + strings.ToLower(strings.TrimSpace(landingURL))
	if ent, ok := s.cache[key]; ok && time.Now().Before(ent.exp) {
		return ent.aliases
	}
	brand := extractBrandFromDomain(seedDomain)
	aliases := buildAliases(brand)
	// Optional landing page signals
	if u := strings.TrimSpace(landingURL); u != "" {
		if titles := fetchLandingSignals(u, 1200*time.Millisecond); len(titles) > 0 {
			for _, t := range titles {
				aliases = append(aliases, buildAliases(t)...)
			}
		}
	} else {
		// Try homepage
		guess := func(sd string) string {
			sd = strings.ToLower(strings.TrimSpace(sd))
			if strings.HasPrefix(sd, "http://") || strings.HasPrefix(sd, "https://") {
				return sd
			}
			return "https://" + sd
		}(seedDomain)
		if titles := fetchLandingSignals(guess, 800*time.Millisecond); len(titles) > 0 {
			for _, t := range titles {
				aliases = append(aliases, buildAliases(t)...)
			}
		}
	}
	// dedupe
	m := map[string]struct{}{}
	out := make([]string, 0, len(aliases))
	for _, a := range aliases {
		a = normalize(a)
		if len(a) >= 3 {
			if _, ok := m[a]; !ok {
				m[a] = struct{}{}
				out = append(out, a)
			}
		}
	}
	s.cache[key] = aliasCache{aliases: out, exp: time.Now().Add(7 * 24 * time.Hour)}
	return out
}

func fetchLandingSignals(u string, timeout time.Duration) []string {
	// naive HTML fetcher: title and og:site_name
	// safe-guard: only http/https
	if pu, err := url.Parse(u); err != nil || (pu.Scheme != "http" && pu.Scheme != "https") {
		return nil
	}
	req, _ := http.NewRequest("GET", u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; RecoBot/1.0)")
	resp, err := httpx.New(timeout).DoRaw(req)
	if err != nil || resp == nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil
	}
	// limit read
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 512*1024))
	html := strings.ToLower(string(body))
	titles := make([]string, 0, 2)
	// extract <title>
	if i := strings.Index(html, "<title>"); i >= 0 {
		if j := strings.Index(html[i+7:], "</title>"); j > 0 {
			t := body[i+7 : i+7+j]
			titles = append(titles, string(t))
		}
	}
	// extract og:site_name
	// very naive: content="..."
	if i := strings.Index(html, "property=\"og:site_name\""); i >= 0 {
		seg := html[i:]
		if k := strings.Index(seg, "content="); k >= 0 {
			tail := seg[k+8:]
			// strip leading quotes and capture until next quote
			tail = strings.TrimLeft(tail, " \t'\"")
			end := strings.IndexAny(tail, "'\"")
			if end > 0 {
				titles = append(titles, tail[:end])
			}
		}
	}
	return titles
}

func extractBrandFromDomain(seed string) string {
	seed = strings.ToLower(strings.TrimSpace(seed))
	seed = strings.TrimPrefix(seed, "http://")
	seed = strings.TrimPrefix(seed, "https://")
	if i := strings.Index(seed, "/"); i >= 0 {
		seed = seed[:i]
	}
	host := seed
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		// handle co.uk like TLDs
		tld := parts[len(parts)-1]
		sld := parts[len(parts)-2]
		if len(parts) >= 3 && (tld == "uk" && (sld == "co" || sld == "ac")) {
			sld = parts[len(parts)-3]
		}
		host = sld
	}
	host = strings.ReplaceAll(host, "-", " ")
	host = normalize(host)
	tokens := strings.Fields(host)
	if len(tokens) > 0 {
		return tokens[0]
	}
	return host
}

func buildAliases(brand string) []string {
	base := normalize(brand)
	if base == "" {
		return nil
	}
	aliases := map[string]struct{}{}
	add := func(s string) {
		s = normalize(s)
		if len(s) >= 3 {
			aliases[s] = struct{}{}
		}
	}
	add(base)
	add(strings.ReplaceAll(base, " ", ""))
	// remove vowels variant for long words
	vowRe := regexp.MustCompile(`[aeiou]`)
	if len(base) >= 5 {
		add(vowRe.ReplaceAllString(base, ""))
	}
	out := make([]string, 0, len(aliases))
	for k := range aliases {
		out = append(out, k)
	}
	return out
}

func normalize(s string) string {
	s = strings.ToLower(s)
	// keep letters, numbers and spaces
	b := make([]rune, 0, len(s))
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ' {
			b = append(b, r)
		} else if r == '-' || r == '_' {
			b = append(b, ' ')
		}
	}
	// collapse spaces
	out := strings.Join(strings.Fields(string(b)), " ")
	return out
}

func matchBrand(keyword string, aliases []string) (contains bool, matched, method string, score float64) {
	if keyword == "" || len(aliases) == 0 {
		return false, "", "none", 0
	}
	k := keyword
	for _, a := range aliases {
		if len(a) < 3 {
			continue
		}
		if strings.Contains(k, a) {
			return true, a, "exact", 1.0
		}
	}
	// fuzzy via bigram Jaccard
	kg := ngrams(k, 2)
	best := 0.0
	bestA := ""
	for _, a := range aliases {
		ag := ngrams(a, 2)
		j := jaccard(kg, ag)
		if j > best {
			best = j
			bestA = a
		}
	}
	if best >= 0.6 {
		return true, bestA, "fuzzy", best
	}
	return false, "", "none", best
}

func ngrams(s string, n int) map[string]struct{} {
	s = strings.ReplaceAll(s, " ", "")
	if len(s) < n {
		return map[string]struct{}{}
	}
	m := map[string]struct{}{}
	for i := 0; i <= len(s)-n; i++ {
		m[s[i:i+n]] = struct{}{}
	}
	return m
}

func jaccard(a, b map[string]struct{}) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	inter := 0
	for k := range a {
		if _, ok := b[k]; ok {
			inter++
		}
	}
	union := len(a) + len(b) - inter
	if union <= 0 {
		return 0
	}
	return float64(inter) / float64(union)
}

// --- persistence (best-effort) ---
// ensureDDL has been removed - DDL operations should use db-admin migrations
// This function is deprecated and should not be called
func ensureDDL(db *sql.DB) error {
	log.Printf("WARNING: ensureDDL is deprecated. Use db-admin migrations instead.")
	return fmt.Errorf("deprecated function: use db-admin migrations for DDL operations")
}

func (s *Server) persistResults(seed string, aliases []string, items []api.BrandCheckItem) {
	if s.adapter == nil {
		return
	}
	// 使用适配器的主数据库进行写入
	db := s.adapter.Primary().GetDB()
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	// upsert brand_profile
	b, _ := json.Marshal(aliases)
	_, _ = db.ExecContext(ctx, `
        INSERT INTO brand_profile(seed_domain, aliases, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (seed_domain) DO UPDATE SET aliases=EXCLUDED.aliases, updated_at=NOW()
    `, seed, string(b))
	// insert keyword risk results
	for _, it := range items {
		var matched, method *string
		var score *float64
		if it.MatchedAlias != nil {
			matched = it.MatchedAlias
		}
		if it.Method != "" {
			m := string(it.Method)
			method = &m
		}
		if it.Score != nil {
			v := float64(*it.Score)
			score = &v
		}
		_, _ = db.ExecContext(ctx, `
            INSERT INTO keyword_risk_results(seed_domain, keyword, contains_brand, matched_alias, method, score, severity)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
        `, seed, it.Keyword, it.ContainsBrand, matched, method, score, string(it.Severity))
	}
}

func (s *Server) maybeWriteFirestore(ctx context.Context, uid, seed string, items []api.BrandCheckItem) {
	if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" {
		return
	}
	pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if pid == "" {
		pid = strings.TrimSpace(os.Getenv("PROJECT_ID"))
	}
	if pid == "" || uid == "" {
		return
	}
	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()
	cli, err := firestore.NewClient(cctx, pid)
	if err != nil {
		return
	}
	defer cli.Close()
	// users/{uid}/recommendations/brand-check/{seed}
	doc := map[string]any{
		"seedDomain": seed,
		"updatedAt":  time.Now().UTC(),
		"items":      items,
	}
	_, _ = cli.Collection("users/"+uid+"/recommendations/brand-check").Doc(seed).Set(cctx, doc)
}

// --- BigQuery integration (optional) ---
func fetchKeywordsFromBigQuery(ctx context.Context, days, limit int, accountID string) ([]string, error) {
	pid := strings.TrimSpace(os.Getenv("BQ_PROJECT_ID"))
	dataset := strings.TrimSpace(os.Getenv("BQ_DATASET"))
	table := strings.TrimSpace(os.Getenv("BQ_TABLE"))
	if pid == "" || dataset == "" || table == "" {
		return nil, fmt.Errorf("bq not configured")
	}
	client, err := bigquery.NewClient(ctx, pid)
	if err != nil {
		return nil, err
	}
	defer client.Close()
	// Generic query for export tables that contain keyword text
	// Expect a column named 'keyword_text' or 'text'. Adjust via env if needed.
	col := strings.TrimSpace(os.Getenv("BQ_KEYWORD_COL"))
	if col == "" {
		col = strings.TrimSpace(os.Getenv("BQ_SEARCH_TERM_COL"))
	}
	if col == "" {
		col = "keyword_text"
	}
	dateField := strings.TrimSpace(os.Getenv("BQ_DATE_FIELD"))
	if dateField == "" {
		dateField = "_PARTITIONDATE"
	}
	qstr := fmt.Sprintf("SELECT DISTINCT LOWER(%s) AS k FROM `%s.%s.%s` WHERE %s >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY) ", col, pid, dataset, table, dateField)
	if accountID != "" {
		qstr += " AND customer_id = @customer_id "
	}
	qstr += " LIMIT @limit"
	q := client.Query(qstr)
	q.Parameters = []bigquery.QueryParameter{
		{Name: "days", Value: days},
		{Name: "limit", Value: limit},
	}
	if accountID != "" {
		q.Parameters = append(q.Parameters, bigquery.QueryParameter{Name: "customer_id", Value: accountID})
	}
	it, err := q.Read(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, limit)
	for {
		var v []bigquery.Value
		err := it.Next(&v)
		if err == iterator.Done {
			break
		}
		if err != nil {
			return out, nil
		}
		if len(v) > 0 {
			if s, ok := v[0].(string); ok && strings.TrimSpace(s) != "" {
				out = append(out, s)
			}
		}
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

// GetOpportunity returns opportunity details by ID
func (h *oasImpl) GetOpportunity(w http.ResponseWriter, r *http.Request, id int64) {
	if h.srv.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil)
		return
	}

	ctx := r.Context()

	// Query opportunity from database
	var opportunity struct {
		ID                int64     `json:"id" db:"id"`
		UserID            string    `json:"userId" db:"user_id"`
		SeedDomain        string    `json:"seedDomain" db:"seed_domain"`
		Keywords          string    `json:"keywords" db:"keywords"`
		CompetitorDomains string    `json:"competitorDomains" db:"competitor_domains"`
		Summary           string    `json:"summary" db:"summary"`
		CreatedAt         time.Time `json:"createdAt" db:"created_at"`
		UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
	}

	err := h.srv.adapter.Secondary().GetDB().QueryRowContext(ctx, `
		SELECT id, user_id, seed_domain, keywords, competitor_domains, summary, created_at, updated_at
		FROM opportunities
		WHERE id = $1
	`, id).Scan(
		&opportunity.ID,
		&opportunity.UserID,
		&opportunity.SeedDomain,
		&opportunity.Keywords,
		&opportunity.CompetitorDomains,
		&opportunity.Summary,
		&opportunity.CreatedAt,
		&opportunity.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			apperr.Write(w, r, http.StatusNotFound, "NOT_FOUND", "opportunity not found", nil)
		} else {
			apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", "failed to query opportunity", err)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(opportunity); err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "ENCODE_ERROR", "failed to encode response", err)
	}
}

// ListOpportunities returns recent opportunities for current user
func (h *oasImpl) ListOpportunities(w http.ResponseWriter, r *http.Request, params api.ListOpportunitiesParams) {
	if h.srv.adapter == nil {
		apperr.Write(w, r, http.StatusInternalServerError, "SERVER_NOT_CONFIGURED", "DATABASE_URL not set", nil)
		return
	}

	ctx := r.Context()

	// Parse pagination parameters
	limit := 20 // default limit
	if params.Limit != nil {
		limit = *params.Limit
		if limit > 100 {
			limit = 100 // cap at 100
		}
	}

	// For now, we'll ignore cursor and use simple pagination
	// In a real implementation, you'd decode the cursor to get the position
	// For simplicity, we'll start from beginning
	cursor := ""
	if params.Cursor != nil {
		cursor = *params.Cursor
	}

	// Get user ID from context (set by auth middleware)
	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		apperr.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "user not authenticated", nil)
		return
	}

	// Query opportunities from database
	// For simplicity, we'll use basic LIMIT/OFFSET pagination
	// In production, you'd want to use cursor-based pagination for better performance
	query := `
		SELECT id, user_id, seed_domain, keywords, competitor_domains, summary, created_at, updated_at
		FROM opportunities
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	var rows *sql.Rows
	var err error

	if cursor == "" {
		rows, err = h.srv.adapter.Secondary().GetDB().QueryContext(ctx, query, userID, limit)
	} else {
		// Simple implementation using timestamp as cursor
		// In production, decode proper cursor
		query = `
			SELECT id, user_id, seed_domain, keywords, competitor_domains, summary, created_at, updated_at
			FROM opportunities
			WHERE user_id = $1 AND created_at < $2
			ORDER BY created_at DESC
			LIMIT $3
		`
		rows, err = h.srv.adapter.Secondary().GetDB().QueryContext(ctx, query, userID, cursor, limit)
	}
	if err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", "failed to query opportunities", err)
		return
	}
	defer rows.Close()

	var opportunities []struct {
		ID                int64     `json:"id" db:"id"`
		UserID            string    `json:"userId" db:"user_id"`
		SeedDomain        string    `json:"seedDomain" db:"seed_domain"`
		Keywords          string    `json:"keywords" db:"keywords"`
		CompetitorDomains string    `json:"competitorDomains" db:"competitor_domains"`
		Summary           string    `json:"summary" db:"summary"`
		CreatedAt         time.Time `json:"createdAt" db:"created_at"`
		UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
	}

	for rows.Next() {
		var opp struct {
			ID                int64     `json:"id" db:"id"`
			UserID            string    `json:"userId" db:"user_id"`
			SeedDomain        string    `json:"seedDomain" db:"seed_domain"`
			Keywords          string    `json:"keywords" db:"keywords"`
			CompetitorDomains string    `json:"competitorDomains" db:"competitor_domains"`
			Summary           string    `json:"summary" db:"summary"`
			CreatedAt         time.Time `json:"createdAt" db:"created_at"`
			UpdatedAt         time.Time `json:"updatedAt" db:"updated_at"`
		}

		err := rows.Scan(
			&opp.ID,
			&opp.UserID,
			&opp.SeedDomain,
			&opp.Keywords,
			&opp.CompetitorDomains,
			&opp.Summary,
			&opp.CreatedAt,
			&opp.UpdatedAt,
		)
		if err != nil {
			apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", "failed to scan opportunity", err)
			return
		}

		opportunities = append(opportunities, opp)
	}

	if err = rows.Err(); err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "DATABASE_ERROR", "error iterating opportunities", err)
		return
	}

	response := struct {
		Opportunities interface{} `json:"opportunities"`
		Total         int         `json:"total"`
		Limit         int         `json:"limit"`
		Cursor        *string     `json:"cursor,omitempty"`
	}{
		Opportunities: opportunities,
		Limit:         limit,
		Cursor:        params.Cursor,
	}

	// Get total count
	var total int
	h.srv.adapter.Secondary().GetDB().QueryRowContext(ctx, "SELECT COUNT(*) FROM opportunities WHERE user_id = $1", userID).Scan(&total)
	response.Total = total

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		apperr.Write(w, r, http.StatusInternalServerError, "ENCODE_ERROR", "failed to encode response", err)
	}
}
