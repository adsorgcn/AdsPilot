package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/smtp"
	"os"
	"strconv"
	"time"

	"fmt"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	ev "github.com/ScientificInternet/Google-Monetize/pkg/events"
	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"github.com/ScientificInternet/Google-Monetize/pkg/supabaseauth"
	"github.com/ScientificInternet/Google-Monetize/services/useractivity/internal/events"
	"github.com/ScientificInternet/Google-Monetize/services/useractivity/internal/handlers"
	api "github.com/ScientificInternet/Google-Monetize/services/useractivity/internal/oapi"
	"github.com/ScientificInternet/Google-Monetize/services/useractivity/internal/storage"
	tshim "github.com/ScientificInternet/Google-Monetize/services/useractivity/internal/telemetryshim"
	"github.com/go-chi/chi/v5"
	_ "github.com/lib/pq"
	"strings"
)

var log = logger.Get()
var db *sql.DB

// Global service registry for calling other microservices
var serviceRegistry *serviceclient.Registry

type Notification struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}

func main() {
	// Useractivity Service - Handles user notifications, check-in, and referrals

	// Initialize service registry for microservice calls
	serviceRegistry = serviceclient.NewRegistry()
	handlers.SetGlobalRegistry(serviceRegistry)
	events.SetGlobalRegistry(serviceRegistry)
	log.Info().Msg("Service registry initialized")

	// Setup DB using adapter
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal().Msg("DATABASE_URL not set")
	}

	// Create database adapter
	adapter, err := storage.NewAdapter(dsn)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create database adapter")
	}
	defer adapter.Close()

	// Get database connection for handlers (temporary during migration)
	db = adapter.GetDB()
	if db == nil {
		log.Fatal().Msg("database adapter failed to provide connection")
	}

	// Note: DDL operations now managed through golang-migrate
	// Tables should be created via migrations/useractivity/ SQL files

	log.Info().Str("mode", fmt.Sprintf("%v", adapter.GetMode())).Msg("Database adapter initialized")
	r := chi.NewRouter()
	r.Use(middleware.RequestID())
	tshim.RegisterDefaultMetrics("useractivity")
	r.Use(tshim.ChiMiddleware("useractivity"))
	r.Use(middleware.LoggingMiddleware("useractivity"))
	r.Use(middleware.SecurityHeaders())
	r.Handle("/metrics", tshim.MetricsHandler())
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		// DB check
		if err := db.Ping(); err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
			return
		}
		// Redis check (strict) if configured
		if strings.TrimSpace(os.Getenv("REDIS_URL")) != "" {
			rc := pcache.NewFromEnv()
			if rc == nil || !rc.Ready() {
				errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "redis client not ready", nil)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), 300*time.Millisecond)
			defer cancel()
			if err := rc.Redis().Ping(ctx).Err(); err != nil {
				errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "redis ping failed", map[string]string{"redis": err.Error()})
				return
			}
		}
		w.WriteHeader(http.StatusOK)
	})

	// Initialize handlers
	checkinHandler := handlers.NewCheckinHandler(db)
	referralHandler := handlers.NewReferralHandler(db)

	// Initialize event publisher if available
	var pub *ev.Publisher
	if p, err := ev.NewPublisher(context.Background()); err == nil {
		pub = p
		handlers.SetGlobalEventPublisher(pub)
		log.Info().Msg("Event publisher initialized for checkin events")
	} else {
		log.Warn().Err(err).Msg("Failed to initialize event publisher for checkin events")
	}

	// Plain route (fallback) + streaming + OpenAPI chi server
	r.With(middleware.AuthMiddleware).Get("/api/v1/notifications/recent", recentHandler)
	r.With(middleware.AuthMiddleware).Get("/api/v1/notifications/stream", sseNotifications)

	// Check-in endpoints
	r.With(middleware.AuthMiddleware).Post("/api/v1/check-in", checkinHandler.Checkin)
	r.With(middleware.AuthMiddleware).Get("/api/v1/check-in/status", checkinHandler.GetCheckinStatus)
	r.With(middleware.AuthMiddleware).Get("/api/v1/check-in/history", checkinHandler.GetCheckinHistory)

	// Referral endpoints
	r.With(middleware.AuthMiddleware).Get("/api/v1/referral", referralHandler.GetReferral)
	r.With(middleware.AuthMiddleware).Get("/api/v1/referral/list", referralHandler.GetReferralList)
	r.Post("/api/v1/referral/track", referralHandler.TrackReferral) // Internal, no auth required
	r.Post("/api/v1/trial/create", referralHandler.CreateTrial)     // Internal, no auth required
	r.With(middleware.AuthMiddleware).Get("/api/v1/trial/active", referralHandler.GetActiveTrial)
	// Risk preview & evaluate (MVP)
	r.With(middleware.AuthMiddleware).Get("/api/v1/notifications/risk/preview", riskPreviewHandler)
	r.With(middleware.AuthMiddleware).Post("/api/v1/notifications/risk/evaluate", riskEvaluateHandler)
	// Admin alert injection (internal)
	r.HandleFunc("/api/v1/notifications/admin/alert", adminAlertHandler)
	// Minimal event_store query for current user (3.1 部分落地)
	r.With(middleware.AuthMiddleware).Get("/api/v1/console/events", listEventsHandler)
	r.With(middleware.AuthMiddleware).Get("/api/v1/console/events/export", exportEventsHandler)
	r.With(middleware.AuthMiddleware).Get("/api/v1/console/events/types", listEventTypesHandler)

	// OpenAPI chi server
	oas := &oasImpl{}
	oapiHandler := api.HandlerWithOptions(oas, api.ChiServerOptions{
		BaseURL: "/",
		Middlewares: []api.MiddlewareFunc{
			func(next http.Handler) http.Handler { return middleware.IdempotencyMiddleware(next) },
			func(next http.Handler) http.Handler { return middleware.AuthMiddleware(next) },
		},
	})
	r.Mount("/", oapiHandler)

	// debug endpoints (opt-in)
	if os.Getenv("DEBUG") == "1" {
		r.HandleFunc("/api/v1/debug/offers", debugOffersHandler)
	}

	// Start subscriber (best-effort)
	if os.Getenv("GOOGLE_CLOUD_PROJECT") != "" && os.Getenv("PUBSUB_SUBSCRIPTION_ID") != "" {
		var pub *ev.Publisher
		if p, err := ev.NewPublisher(context.Background()); err == nil {
			pub = p
		} else {
			log.Warn().Err(err).Msg("useractivity: publisher init failed; ActivityNotificationSent disabled")
		}
		sub, err := events.NewSubscriber(context.Background(), db, pub)
		if err != nil {
			log.Warn().Err(err).Msg("useractivity: subscriber init failed")
		} else {
			sub.Start(context.Background())
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Info().Str("port", port).Msg("UserActivity service starting...")
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal().Err(err).Msg("failed to start server")
	}
}

// oasImpl adapts generated server to reuse existing recentHandler.
type oasImpl struct{}

func (oas *oasImpl) ListRecentNotifications(w http.ResponseWriter, r *http.Request, params api.ListRecentNotificationsParams) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	// Delegate to existing recentHandler; params handled inside
	recentHandler(w, r)
}

// adminAlertHandler accepts internal alert and broadcasts to all admin users.
// Security: require X-Service-Token == INTERNAL_SERVICE_TOKEN.
// Body: { title, message, severity?, data? }
func adminAlertHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	tok := strings.TrimSpace(r.Header.Get("X-Service-Token"))
	if tok == "" || tok != strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")) {
		errors.Write(w, r, http.StatusForbidden, "FORBIDDEN", "invalid service token", nil)
		return
	}
	var body struct {
		Title, Message, Severity string
		Data                     map[string]any
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid json", nil)
		return
	}
	if strings.TrimSpace(body.Title) == "" {
		body.Title = "Security Alert"
	}
	if strings.TrimSpace(body.Severity) == "" {
		body.Severity = "alert"
	}
	// Query admin users
	rows, err := db.QueryContext(r.Context(), `SELECT id, COALESCE(email,'') FROM "User" WHERE upper(role)='ADMIN' LIMIT 1000`)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query admins failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	cnt := 0
	for rows.Next() {
		var id, email string
		if err := rows.Scan(&id, &email); err == nil && strings.TrimSpace(id) != "" {
			_ = insertUserNotification(r.Context(), id, "NotificationCreated", body.Title, body.Message, body.Data)
			if strings.TrimSpace(email) != "" {
				go sendEmail(email, body.Title, body.Message)
			}
			cnt++
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "delivered": cnt})
}

func insertUserNotification(ctx context.Context, userID, eventType, title, message string, data map[string]any) error {
	m := map[string]any{"message": message}
	for k, v := range data {
		m[k] = v
	}
	messageB, _ := json.Marshal(m)
	var id int64
	_ = db.QueryRowContext(ctx, `INSERT INTO useractivity.notifications (user_id, type, title, message, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id`, userID, eventType, title, string(messageB)).Scan(&id)
	// Firestore UI cache best-effort
	// Skipped here for brevity; reusing existing helper would require refactor
	_ = id
	return nil
}

func sendEmail(to, subject, body string) {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	user := strings.TrimSpace(os.Getenv("SMTP_USERNAME"))
	pass := strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	if host == "" || port == "" || user == "" || pass == "" || from == "" {
		return
	}
	addr := host + ":" + port
	auth := smtp.PlainAuth("", user, pass, host)
	msg := []byte("To: " + to + "\r\n" +
		"Subject: " + subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=utf-8\r\n\r\n" +
		body + "\r\n")
	_ = smtp.SendMail(addr, auth, from, []string{to}, msg)
}

// ---- Risk evaluation (MVP) ----
// Heuristics on recent user_notifications to generate risk items.
type riskItem struct{ Code, Severity, Title, Summary string }

func riskPreviewHandler(w http.ResponseWriter, r *http.Request) {
	uid, _ := supabaseauth.UserIDFromContext(r.Context())
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "missing user", nil)
		return
	}
	// pull last 24h notifications for the user (limit 500)
	rows, err := db.Query(`SELECT id, type, title, message, created_at FROM useractivity.notifications WHERE user_id=$1 AND created_at > NOW() - interval '24 hours' ORDER BY id DESC LIMIT 500`, uid)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "QUERY_FAILED", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type rec struct {
		id              int64
		typ, title, msg string
		at              time.Time
	}
	var lst []rec
	for rows.Next() {
		var x rec
		if err := rows.Scan(&x.id, &x.typ, &x.title, &x.msg, &x.at); err == nil {
			lst = append(lst, x)
		}
	}
	// aggregate heuristics
	var items []riskItem
	// 1) Many batch failures in 1h
	fails := 0
	cutoff := time.Now().Add(-1 * time.Hour)
	for _, x := range lst {
		if x.at.Before(cutoff) {
			continue
		}
		if strings.Contains(strings.ToLower(x.title), "batchops") && (strings.Contains(strings.ToLower(x.title), "failed") || strings.Contains(strings.ToLower(x.msg), "failed")) {
			fails++
		}
	}
	if fails >= 3 {
		items = append(items, riskItem{Code: "risk.batch_failures", Severity: "error", Title: "批量操作失败过多", Summary: "近1小时批量失败次数=" + strconv.Itoa(fails)})
	}
	if fails == 1 || fails == 2 {
		items = append(items, riskItem{Code: "risk.batch_failures", Severity: "warn", Title: "批量操作出现失败", Summary: "近1小时失败次数=" + strconv.Itoa(fails)})
	}
	// 2) Browser-Exec errors spike in 1h
	beErr := 0
	for _, x := range lst {
		if x.at.Before(cutoff) {
			continue
		}
		tl := strings.ToLower(x.title)
		if strings.Contains(tl, "browser") || strings.Contains(tl, "exec") {
			if strings.Contains(strings.ToLower(x.msg), "error") {
				beErr++
			}
		}
	}
	if beErr >= 5 {
		items = append(items, riskItem{Code: "risk.browser_exec_errors", Severity: "warn", Title: "浏览器执行错误较多", Summary: "近1小时错误次数=" + strconv.Itoa(beErr)})
	}
	// 3) Preflight issues (landing reachability etc.) in 24h
	pf := 0
	for _, x := range lst {
		if strings.Contains(strings.ToLower(x.title), "preflight") || strings.Contains(strings.ToLower(x.msg), "landing.reachability") {
			if !strings.Contains(strings.ToLower(x.msg), "reachable") {
				pf++
			}
		}
	}
	if pf > 0 {
		items = append(items, riskItem{Code: "risk.preflight_issues", Severity: "warn", Title: "预检发现可用性问题", Summary: "最近预检问题条数=" + strconv.Itoa(pf)})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"items": items})
}

func riskEvaluateHandler(w http.ResponseWriter, r *http.Request) {
	// generate notifications based on preview
	uid, _ := supabaseauth.UserIDFromContext(r.Context())
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "missing user", nil)
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "/api/v1/notifications/risk/preview", nil)
	// reuse auth context
	rr := httptestResponse()
	riskPreviewHandler(rr, req)
	if rr.status != 200 {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "preview failed", nil)
		return
	}
	var out struct {
		Items []riskItem `json:"items"`
	}
	_ = json.Unmarshal(rr.buf.Bytes(), &out)
	created := 0
	for _, it := range out.Items {
		msg := map[string]any{"severity": it.Severity, "category": "risk", "code": it.Code, "summary": it.Summary}
		b, _ := json.Marshal(msg)
		if _, err := db.Exec(`INSERT INTO useractivity.notifications (user_id, type, title, message, created_at) VALUES ($1,$2,$3,$4,NOW())`, uid, "RISK", it.Title, string(b)); err == nil {
			created++
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"created": created})
}

// Implement OAS methods for read/unread-count
func (oas *oasImpl) MarkNotificationsRead(w http.ResponseWriter, r *http.Request) {
	markReadHandler(w, r)
}
func (oas *oasImpl) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	unreadCountHandler(w, r)
}

// --- minimal ResponseRecorder for internal reuse (preview→evaluate path) ---
type rrw struct {
	buf    bytes.Buffer
	header http.Header
	status int
}

func httptestResponse() *rrw               { return &rrw{header: http.Header{}, status: 200} }
func (r *rrw) Header() http.Header         { return r.header }
func (r *rrw) Write(b []byte) (int, error) { return r.buf.Write(b) }
func (r *rrw) WriteHeader(code int)        { r.status = code }

// Rules endpoints (minimal): GET list, POST upsert
func (oas *oasImpl) ListNotificationRules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	rows, err := db.Query(`SELECT id, event_type, channel, enabled, created_at, updated_at FROM notification_rules WHERE user_id=$1 ORDER BY id DESC`, uid)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type Rule struct {
		ID                   int64  `json:"id"`
		EventType, Channel   string `json:"eventType","json:"channel"`
		Enabled              bool   `json:"enabled"`
		CreatedAt, UpdatedAt sql.NullTime
	}
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var eventType, channel string
		var enabled bool
		var cAt, uAt sql.NullTime
		if err := rows.Scan(&id, &eventType, &channel, &enabled, &cAt, &uAt); err == nil {
			m := map[string]any{"id": fmt.Sprintf("%d", id), "eventType": eventType, "channel": channel, "enabled": enabled}
			if cAt.Valid {
				m["createdAt"] = cAt.Time.UTC().Format(time.RFC3339)
			}
			if uAt.Valid {
				m["updatedAt"] = uAt.Time.UTC().Format(time.RFC3339)
			}
			out = append(out, m)
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"items": out})
}

func (oas *oasImpl) UpsertNotificationRule(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	var body struct {
		EventType, Channel string
		Enabled            bool
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	if strings.TrimSpace(body.EventType) == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "eventType required", nil)
		return
	}
	ch := strings.ToLower(strings.TrimSpace(body.Channel))
	if ch == "" {
		ch = "inapp"
	}
	// DDL operations removed - use golang-migrate instead
	// Table creation should be handled through proper migration process
	log.Printf("WARNING: Runtime DDL operations removed from useractivity service. Use golang-migrate migrations instead.")

	// Verify required table exists, but do not create it
	var tableExists bool
	err := db.QueryRow(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_rules')`).Scan(&tableExists)
	if err != nil {
		log.Printf("ERROR: Failed to check notification_rules table: %v", err)
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "database check failed", nil)
		return
	}

	if !tableExists {
		log.Printf("ERROR: notification_rules table missing. Please run golang-migrate migrations.")
		errors.Write(w, r, http.StatusInternalServerError, "SCHEMA_ERROR", "Database schema error. Contact administrator.", nil)
		return
	}
	// upsert (by user+event_type+channel)
	_, err = db.Exec(`INSERT INTO notification_rules(user_id,event_type,channel,enabled,created_at,updated_at)
        VALUES ($1,$2,$3,$4,NOW(),NOW())
        ON CONFLICT (user_id,event_type,channel) DO UPDATE SET enabled=EXCLUDED.enabled, updated_at=NOW()`, uid, body.EventType, ch, body.Enabled)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "upsert failed", map[string]string{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}

func recentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	// User context
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	// Simple pagination params: limit and cursor (RFC 3986 safe)
	q := r.URL.Query()
	limit := 20
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	cursor := q.Get("cursor")
	var rows *sql.Rows
	var err error
	if cursor != "" {
		// cursor is last seen id; return items with id < cursor
		rows, err = db.Query(`SELECT id, type, title, message, created_at FROM useractivity.notifications WHERE user_id=$1 AND id < $2 ORDER BY id DESC LIMIT $3`, uid, cursor, limit)
	} else {
		rows, err = db.Query(`SELECT id, type, title, message, created_at FROM useractivity.notifications WHERE user_id=$1 ORDER BY id DESC LIMIT $2`, uid, limit)
	}
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	items := make([]Notification, 0, limit)
	var lastID string
	for rows.Next() {
		var n Notification
		var id int64
		var createdAt sql.NullTime
		if err := rows.Scan(&id, &n.Type, &n.Title, &n.Message, &createdAt); err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Scan failed", map[string]string{"error": err.Error()})
			return
		}
		n.ID = strconv.FormatInt(id, 10)
		if createdAt.Valid {
			n.CreatedAt = createdAt.Time.UTC().Format(time.RFC3339)
		}
		items = append(items, n)
		lastID = n.ID
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Items []Notification `json:"items"`
		Next  string         `json:"next,omitempty"`
	}{Items: items, Next: func() string {
		if len(items) == limit {
			return lastID
		}
		return ""
	}()})
}

// listEventsHandler: GET /api/v1/console/events?limit=50
// 返回与当前用户相关的最近事件（基于 payload/metadata.userId 过滤，最小实现）
func listEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	q := r.URL.Query()
	limit := 50
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
			limit = n
		}
	}
	cursor := strings.TrimSpace(q.Get("cursor")) // id cursor: return id < cursor
	// support multiple types separated by comma
	evType := strings.TrimSpace(q.Get("type"))
	var evTypes []string
	if evType != "" {
		for _, t := range strings.Split(evType, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				evTypes = append(evTypes, t)
			}
		}
	}
	aggType := strings.TrimSpace(q.Get("aggregateType"))
	aggID := strings.TrimSpace(q.Get("aggregateId"))
	sinceStr := strings.TrimSpace(q.Get("since"))
	untilStr := strings.TrimSpace(q.Get("until"))

	// dynamic query builder
	where := []string{"(payload->>'userId' = $1 OR metadata->>'userId' = $1)"}
	args := []any{uid}
	idx := 2
	if len(evTypes) > 0 {
		placeholders := make([]string, 0, len(evTypes))
		for range evTypes {
			placeholders = append(placeholders, "$"+strconv.Itoa(idx))
			idx++
		}
		where = append(where, "event_name IN ("+strings.Join(placeholders, ",")+")")
		for _, t := range evTypes {
			args = append(args, t)
		}
	}
	if aggType != "" {
		where = append(where, "aggregate_type = $"+strconv.Itoa(idx))
		args = append(args, aggType)
		idx++
	}
	if aggID != "" {
		where = append(where, "aggregate_id = $"+strconv.Itoa(idx))
		args = append(args, aggID)
		idx++
	}
	if sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			where = append(where, "occurred_at >= $"+strconv.Itoa(idx))
			args = append(args, t)
			idx++
		}
	}
	if untilStr != "" {
		if t, err := time.Parse(time.RFC3339, untilStr); err == nil {
			where = append(where, "occurred_at <= $"+strconv.Itoa(idx))
			args = append(args, t)
			idx++
		}
	}
	if cursor != "" {
		if _, err := strconv.ParseInt(cursor, 10, 64); err == nil {
			where = append(where, "id < $"+strconv.Itoa(idx))
			args = append(args, cursor)
			idx++
		}
	}
	query := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY id DESC LIMIT $" + strconv.Itoa(idx)
	args = append(args, limit)
	rows, err := db.Query(query, args...)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type item struct {
		Id            int64  `json:"id"`
		EventId       string `json:"eventId"`
		EventName     string `json:"eventName"`
		AggregateType string `json:"aggregateType"`
		AggregateId   string `json:"aggregateId"`
		OccurredAt    string `json:"occurredAt"`
	}
	out := make([]item, 0, limit)
	var lastID int64
	for rows.Next() {
		var it item
		var t time.Time
		if err := rows.Scan(&it.Id, &it.EventId, &it.EventName, &it.AggregateType, &it.AggregateId, &t); err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Scan failed", map[string]string{"error": err.Error()})
			return
		}
		it.OccurredAt = t.UTC().Format(time.RFC3339)
		out = append(out, it)
		lastID = it.Id
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Items []item `json:"items"`
		Next  string `json:"next,omitempty"`
	}{Items: out, Next: func() string {
		if len(out) == limit {
			return strconv.FormatInt(lastID, 10)
		}
		return ""
	}()})
}

// exportEventsHandler: GET /api/v1/console/events/export?format=ndjson&limit=1000
// 简单导出：按当前用户过滤，支持同 list 的过滤参数，输出 NDJSON（默认）
func exportEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}

	q := r.URL.Query()
	limit := 1000
	if v := q.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 5000 {
			limit = n
		}
	}
	cursor := strings.TrimSpace(q.Get("cursor"))
	// type list support
	evType := strings.TrimSpace(q.Get("type"))
	var evTypes []string
	if evType != "" {
		for _, t := range strings.Split(evType, ",") {
			t = strings.TrimSpace(t)
			if t != "" {
				evTypes = append(evTypes, t)
			}
		}
	}
	aggType := strings.TrimSpace(q.Get("aggregateType"))
	aggID := strings.TrimSpace(q.Get("aggregateId"))
	sinceStr := strings.TrimSpace(q.Get("since"))
	untilStr := strings.TrimSpace(q.Get("until"))

	where := []string{"(payload->>'userId' = $1 OR metadata->>'userId' = $1)"}
	args := []any{uid}
	idx := 2
	if len(evTypes) > 0 {
		placeholders := make([]string, 0, len(evTypes))
		for range evTypes {
			placeholders = append(placeholders, "$"+strconv.Itoa(idx))
			idx++
		}
		where = append(where, "event_name IN ("+strings.Join(placeholders, ",")+")")
		for _, t := range evTypes {
			args = append(args, t)
		}
	}
	if aggType != "" {
		where = append(where, "aggregate_type = $"+strconv.Itoa(idx))
		args = append(args, aggType)
		idx++
	}
	if aggID != "" {
		where = append(where, "aggregate_id = $"+strconv.Itoa(idx))
		args = append(args, aggID)
		idx++
	}
	if sinceStr != "" {
		if t, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			where = append(where, "occurred_at >= $"+strconv.Itoa(idx))
			args = append(args, t)
			idx++
		}
	}
	if untilStr != "" {
		if t, err := time.Parse(time.RFC3339, untilStr); err == nil {
			where = append(where, "occurred_at <= $"+strconv.Itoa(idx))
			args = append(args, t)
			idx++
		}
	}
	if cursor != "" {
		if _, err := strconv.ParseInt(cursor, 10, 64); err == nil {
			where = append(where, "id < $"+strconv.Itoa(idx))
			args = append(args, cursor)
			idx++
		}
	}
	query := "SELECT id, event_id, event_name, aggregate_type, aggregate_id, occurred_at, payload FROM event_store WHERE " + strings.Join(where, " AND ") + " ORDER BY id DESC LIMIT $" + strconv.Itoa(idx)
	args = append(args, limit)
	rows, err := db.Query(query, args...)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	format := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("format")))
	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=events.csv")
		// header
		_, _ = w.Write([]byte("id,eventId,eventName,aggregateType,aggregateId,occurredAt\n"))
		for rows.Next() {
			var id int64
			var eid, name, atype, aid string
			var t time.Time
			var payload json.RawMessage
			if err := rows.Scan(&id, &eid, &name, &atype, &aid, &t, &payload); err != nil {
				continue
			}
			line := strings.NewReplacer(
				",", " ", "\n", " ", "\r", " ", "\t", " ",
			).Replace(name)
			at := strings.NewReplacer(",", " ").Replace(atype)
			ai := strings.NewReplacer(",", " ").Replace(aid)
			_, _ = w.Write([]byte(
				strconv.FormatInt(id, 10) + "," + eid + "," + line + "," + at + "," + ai + "," + t.UTC().Format(time.RFC3339) + "\n",
			))
		}
		return
	}

	// NDJSON default
	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=events.ndjson")
	enc := json.NewEncoder(w)
	type outItem struct {
		Id            int64       `json:"id"`
		EventId       string      `json:"eventId"`
		EventName     string      `json:"eventName"`
		AggregateType string      `json:"aggregateType"`
		AggregateId   string      `json:"aggregateId"`
		OccurredAt    string      `json:"occurredAt"`
		Payload       interface{} `json:"payload"`
	}
	for rows.Next() {
		var id int64
		var eid, name, atype, aid string
		var t time.Time
		var payload json.RawMessage
		if err := rows.Scan(&id, &eid, &name, &atype, &aid, &t, &payload); err != nil {
			continue
		}
		var p any
		_ = json.Unmarshal(payload, &p)
		_ = enc.Encode(outItem{Id: id, EventId: eid, EventName: name, AggregateType: atype, AggregateId: aid, OccurredAt: t.UTC().Format(time.RFC3339), Payload: p})
	}
}

// listEventTypesHandler: GET /api/v1/console/events/types
// 返回当前用户可见事件的类型及计数（最多 100 类）
func listEventTypesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	rows, err := db.Query(`
        SELECT event_name, COUNT(1) AS cnt
        FROM event_store
        WHERE (payload->>'userId' = $1 OR metadata->>'userId' = $1)
        GROUP BY event_name
        ORDER BY cnt DESC
        LIMIT 100
    `, uid)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "Query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type it struct {
		Name  string `json:"name"`
		Count int64  `json:"count"`
	}
	out := make([]it, 0, 20)
	for rows.Next() {
		var name string
		var cnt int64
		if err := rows.Scan(&name, &cnt); err != nil {
			continue
		}
		out = append(out, it{Name: name, Count: cnt})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Items []it `json:"items"`
	}{Items: out})
}

// sseNotifications streams unread count and new notification tips for current user.
// Events:
//   - event: unread, data: { count }
//   - event: heartbeat, data: { t }
//   - event: new, data: { id, type, title, createdAt }
func sseNotifications(w http.ResponseWriter, r *http.Request) {
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	fl, ok := w.(http.Flusher)
	if !ok {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "stream not supported", nil)
		return
	}

	// Compute initial last id and unread count
	var lastID int64
	_ = db.QueryRow(`SELECT COALESCE(MAX(id),0) FROM useractivity.notifications WHERE user_id=$1`, uid).Scan(&lastID)
	var lastRead int64
	_ = db.QueryRow(`SELECT last_read_id FROM useractivity.user_notification_state WHERE user_id=$1`, uid).Scan(&lastRead)
	unread := int64(0)
	_ = db.QueryRow(`SELECT COUNT(1) FROM useractivity.notifications WHERE user_id=$1 AND id>$2`, uid, lastRead).Scan(&unread)
	// send initial unread
	fmt.Fprintf(w, "event: unread\n")
	fmt.Fprintf(w, "data: {\"count\": %d}\n\n", unread)
	fl.Flush()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	hb := time.NewTicker(25 * time.Second)
	defer hb.Stop()

	cn := r.Context().Done()
	for {
		select {
		case <-cn:
			return
		case <-ticker.C:
			var maxID int64
			_ = db.QueryRow(`SELECT COALESCE(MAX(id),0) FROM useractivity.notifications WHERE user_id=$1`, uid).Scan(&maxID)
			if maxID > lastID {
				// Send summary of new notifications; include minimal payload keys for client-side correlation
				rows, err := db.Query(`SELECT id, type, title, message, created_at FROM useractivity.notifications WHERE user_id=$1 AND id>$2 ORDER BY id ASC LIMIT 10`, uid, lastID)
				if err == nil {
					defer rows.Close()
					for rows.Next() {
						var id int64
						var typ, title, message string
						var createdAt time.Time
						if err := rows.Scan(&id, &typ, &title, &message, &createdAt); err == nil {
							// minimal extraction: offerId, analysisId, step (if present in message JSON)
							offerId := ""
							analysisId := ""
							step := ""
							if message != "" {
								var m map[string]any
								if json.Unmarshal([]byte(message), &m) == nil {
									if data, ok := m["data"].(map[string]any); ok {
										if v, ok := data["offerId"].(string); ok {
											offerId = v
										}
										if v, ok := data["analysisId"].(string); ok {
											analysisId = v
										}
										if v, ok := data["step"].(string); ok {
											step = v
										}
										// sometimes nested under workflow fields
										if step == "" {
											if v, ok := data["name"].(string); ok {
												step = v
											}
										}
									}
								}
							}
							fmt.Fprintf(w, "event: new\n")
							// print minimal JSON; ensure proper escaping for title
							fmt.Fprintf(w, "data: {\"id\":%d,\"type\":\"%s\",\"title\":%q,\"createdAt\":%q,\"offerId\":%q,\"analysisId\":%q,\"step\":%q}\n\n", id, typ, title, createdAt.UTC().Format(time.RFC3339), offerId, analysisId, step)
							lastID = id
						}
					}
					fl.Flush()
				}
			}
			// unread update
			_ = db.QueryRow(`SELECT last_read_id FROM useractivity.user_notification_state WHERE user_id=$1`, uid).Scan(&lastRead)
			_ = db.QueryRow(`SELECT COUNT(1) FROM useractivity.notifications WHERE user_id=$1 AND id>$2`, uid, lastRead).Scan(&unread)
			fmt.Fprintf(w, "event: unread\n")
			fmt.Fprintf(w, "data: {\"count\": %d}\n\n", unread)
			fl.Flush()
		case <-hb.C:
			fmt.Fprintf(w, ": keepalive\n\n")
			fl.Flush()
		}
	}
}

// Note: Database schema is now managed through migration files
// Tables are defined in: services/billing/migrations/000001_create_billing_schema.up.sql
// Schema: billing (users, subscriptions, token_*, trial_subscriptions)
// Schema: useractivity (checkins, referrals, notifications, user_notification_state, user_checkin_stats, referral_records)
//
// To apply migrations:
// 1. Run: ./scripts/db/migrate-unix-socket.sh billing
// 2. Verify: psql -c "\dt billing.* useractivity.*"

// markReadHandler: POST /api/v1/notifications/read { lastId: string }
func markReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	var body struct {
		LastID string `json:"lastId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "invalid body", nil)
		return
	}
	if strings.TrimSpace(body.LastID) == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "lastId required", nil)
		return
	}
	// convert to bigint
	var lastID int64
	if v, err := strconv.ParseInt(strings.TrimSpace(body.LastID), 10, 64); err == nil {
		lastID = v
	} else {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "lastId must be integer string", nil)
		return
	}
	// upsert state
	_, err := db.Exec(`INSERT INTO useractivity.user_notification_state(user_id, last_read_id, updated_at) VALUES ($1,$2,NOW())
        ON CONFLICT (user_id) DO UPDATE SET last_read_id=EXCLUDED.last_read_id, updated_at=NOW()`, uid, lastID)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "update state failed", map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "lastId": lastID})
}

// unreadCountHandler: GET /api/v1/notifications/unread-count
func unreadCountHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	// get last_read_id
	var last int64
	_ = db.QueryRow(`SELECT last_read_id FROM useractivity.user_notification_state WHERE user_id=$1`, uid).Scan(&last)
	// count newer
	var cnt int64
	_ = db.QueryRow(`SELECT COUNT(1) FROM useractivity.notifications WHERE user_id=$1 AND id>$2`, uid, last).Scan(&cnt)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"count": cnt, "lastReadId": last})
}

// debugOffersHandler returns recent offers for a user (preprod debugging only)
func debugOffersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid := r.URL.Query().Get("userId")
	if uid == "" {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "userId required", nil)
		return
	}
	rows, err := db.Query(`SELECT id, "userId", name, "originalUrl", status, "createdAt" FROM "Offer" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 10`, uid)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "query failed", map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type Offer struct{ ID, UserID, Name, OriginalUrl, Status, CreatedAt string }
	var out []Offer
	for rows.Next() {
		var o Offer
		var createdAt sql.NullTime
		if err := rows.Scan(&o.ID, &o.UserID, &o.Name, &o.OriginalUrl, &o.Status, &createdAt); err != nil {
			errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "scan failed", map[string]string{"error": err.Error()})
			return
		}
		if createdAt.Valid {
			o.CreatedAt = createdAt.Time.UTC().Format(time.RFC3339)
		}
		out = append(out, o)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(out)
}

// DELETE /api/v1/notifications/{id}
func (oas *oasImpl) DeleteNotification(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		errors.Write(w, r, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed", nil)
		return
	}
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		errors.Write(w, r, http.StatusUnauthorized, "UNAUTHORIZED", "Unauthorized", nil)
		return
	}
	// id is SQL bigserial; accept string numeric
	if _, err := strconv.ParseInt(strings.TrimSpace(id), 10, 64); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", "id must be integer string", nil)
		return
	}
	res, err := db.Exec(`DELETE FROM useractivity.notifications WHERE id=$1 AND user_id=$2`, id, uid)
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL", "delete failed", map[string]string{"error": err.Error()})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		errors.Write(w, r, http.StatusNotFound, "NOT_FOUND", "not found", nil)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
