package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	api "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/oapi"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ratelimit"
	"github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	// Metrics for bulk operations
	MetricOpEnqueued = prometheus.NewCounter(prometheus.CounterOpts{
		Name: "ac_operation_enqueued_total",
		Help: "Total bulk operations enqueued",
	})
	MetricOpActions = prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "ac_operation_actions",
		Help:    "Action count per enqueued operation",
		Buckets: []float64{1, 5, 10, 20, 50, 100, 200},
	})
)

func init() {
	prometheus.MustRegister(MetricOpEnqueued, MetricOpActions)
}

// BulkActionsHandler handles bulk action submissions
type BulkActionsHandler struct {
	DB *sql.DB
}

// NewBulkActionsHandler creates a new bulk actions handler
func NewBulkActionsHandler(db *sql.DB) *BulkActionsHandler {
	return &BulkActionsHandler{DB: db}
}

// HandleSubmitBulkActions processes bulk action plan submissions
// POST /api/v1/adscenter/bulk-actions
func (h *BulkActionsHandler) HandleSubmitBulkActions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	raw, err := io.ReadAll(r.Body)
	if err != nil {
		apiErr := apierrors.InvalidRequest("param", "invalid body")
		apiErr.WriteJSON(w, r)
		return
	}

	var plan api.BulkActionPlan
	_ = json.Unmarshal(raw, &plan)
	var rawObj map[string]any
	_ = json.Unmarshal(raw, &rawObj)

	validateOnly := false
	if plan.ValidateOnly != nil {
		validateOnly = *plan.ValidateOnly
	}

	var rawActs []any
	if v, ok := rawObj["actions"].([]any); ok {
		rawActs = v
	}

	actionsAny := make([]map[string]any, 0, max(1, len(plan.Actions)))
	if len(plan.Actions) > 0 {
		for idx, a := range plan.Actions {
			m := map[string]any{}
			if a.Type != nil {
				m["type"] = string(*a.Type)
			}

			if a.Filter != nil && len(*a.Filter) > 0 {
				m["filter"] = *a.Filter
			} else if idx < len(rawActs) {
				if ra, ok := rawActs[idx].(map[string]any); ok {
					if rf, ok2 := ra["filter"].(map[string]any); ok2 && len(rf) > 0 {
						m["filter"] = rf
					}
				}
			}

			if a.Params != nil {
				var pm map[string]any
				if b, err := json.Marshal(a.Params); err == nil {
					_ = json.Unmarshal(b, &pm)
				}
				if len(pm) > 0 {
					m["params"] = pm
				} else if idx < len(rawActs) {
					if ra, ok := rawActs[idx].(map[string]any); ok {
						if rp, ok2 := ra["params"].(map[string]any); ok2 && len(rp) > 0 {
							m["params"] = rp
						}
					}
				}
			} else if idx < len(rawActs) {
				if ra, ok := rawActs[idx].(map[string]any); ok {
					if rp, ok2 := ra["params"].(map[string]any); ok2 && len(rp) > 0 {
						m["params"] = rp
					}
				}
			}
			actionsAny = append(actionsAny, m)
		}
	} else if len(rawActs) > 0 {
		for _, ra := range rawActs {
			if rm, ok := ra.(map[string]any); ok {
				m := map[string]any{}
				if t, ok2 := rm["type"].(string); ok2 {
					m["type"] = t
				}
				if rf, ok2 := rm["filter"].(map[string]any); ok2 {
					m["filter"] = rf
				}
				if rp, ok2 := rm["params"].(map[string]any); ok2 {
					m["params"] = rp
				}
				actionsAny = append(actionsAny, m)
			}
		}
	}

	type Sum struct {
		Actions           int `json:"actions"`
		EstimatedAffected int `json:"estimatedAffected"`
	}
	sum := Sum{Actions: len(actionsAny), EstimatedAffected: 0}

	if validateOnly {
		writeJSON(w, http.StatusOK, map[string]any{"summary": sum})
		return
	}

	id := generateOperationID()
	uid := extractUserID(r)

	planBytes, _ := json.Marshal(map[string]any{"validateOnly": plan.ValidateOnly, "actions": actionsAny})

	cache := pcache.NewFromEnv()
	scope := "adscenter.bulk-actions"
	idemKey := strings.TrimSpace(r.Header.Get("X-Idempotency-Key"))

	db := h.DB
	var needClose bool
	if db == nil {
		if dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL")); dbURL != "" {
			var err error
			db, err = sql.Open("postgres", dbURL)
			if err == nil {
				needClose = true
			}
		}
	}

	if db != nil {
		defer func() {
			if needClose {
				_ = db.Close()
			}
		}()

		// DDL operations removed - use db-admin migrations instead
		// Table creation should be handled through proper migration process
		// In a real application, these tables should be created via db-admin service
		log.Printf("WARNING: Runtime DDL operations removed from adscenter service. Use db-admin migrations instead.")

		// Verify required tables exist, but do not create them
		var bulkOpTableExists, bulkAuditTableExists bool
		_ = db.QueryRow(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'BulkActionOperation')`).Scan(&bulkOpTableExists)
		_ = db.QueryRow(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'BulkActionAudit')`).Scan(&bulkAuditTableExists)

		if !bulkOpTableExists || !bulkAuditTableExists {
			log.Printf("ERROR: Required tables missing. BulkActionOperation exists: %v, BulkActionAudit exists: %v. Please run db-admin migrations.", bulkOpTableExists, bulkAuditTableExists)
			apiErr := apierrors.New(apierrors.CodeInternalError, "Database schema error. Contact administrator.", nil)
			apiErr.HTTPStatus = http.StatusInternalServerError
			apiErr.WriteJSON(w, r)
			return
		}

		// Idempotency check
		if idemKey != "" {
			var existing string
			_ = db.QueryRow(`SELECT target_id FROM idempotency_keys WHERE key=$1 AND user_id=$2 AND scope=$3 AND expires_at>NOW()`, idemKey, uid, scope).Scan(&existing)
			if existing != "" {
				var status sql.NullString
				_ = db.QueryRow(`SELECT status FROM "BulkActionOperation" WHERE id=$1`, existing).Scan(&status)
				st := "queued"
				if status.Valid {
					st = status.String
				}
				writeJSON(w, http.StatusAccepted, map[string]any{"operationId": existing, "status": st, "summary": sum})
				return
			}

			// Redis fast path
			if cache != nil && cache.Ready() {
				if val, ok := cache.Get(r.Context(), "idem:"+scope+":"+idemKey); ok && strings.TrimSpace(val) != "" {
					writeJSON(w, http.StatusAccepted, map[string]any{"operationId": val, "status": "queued", "summary": sum})
					return
				}
			}
		}

		// Quota enforcement
		planName := ratelimit.ResolveUserPlan(r)
		pol := ratelimit.LoadPolicy(r.Context())
		if daily := pol.QuotaDailyFor(planName); daily > 0 {
			usage := 0
			_ = db.QueryRow(`SELECT COUNT(1) FROM "BulkActionOperation" WHERE user_id=$1 AND created_at::date = CURRENT_DATE`, uid).Scan(&usage)
			if usage >= daily {
				apiErr := apierrors.RateLimited(0)
				apiErr.Message = "daily quota exceeded"
				apiErr.Details = map[string]interface{}{"plan": planName}
				apiErr.WriteJSON(w, r)
				return
			}
		}

		// Dedup by plan hash
		if cache != nil && cache.Ready() {
			h := fnv.New64a()
			_, _ = h.Write(planBytes)
			dedupKey := fmt.Sprintf("dedup:ac:plan:%s:%x", uid, h.Sum64())
			if ok, _ := cache.SetNX(r.Context(), dedupKey, id, 20*time.Minute); !ok {
				if ex, ok2 := cache.Get(r.Context(), dedupKey); ok2 && strings.TrimSpace(ex) != "" {
					writeJSON(w, http.StatusAccepted, map[string]any{"operationId": ex, "status": "queued", "summary": sum})
					return
				}
			}
		}

		// Insert operation
		_, _ = db.Exec(`INSERT INTO "BulkActionOperation"(id, user_id, plan, status) VALUES ($1,$2,$3,'queued')`, id, uid, string(planBytes))
		MetricOpEnqueued.Inc()
		MetricOpActions.Observe(float64(len(actionsAny)))

		var auditRows []auditInsert
		auditRows = append(auditRows, auditInsert{OpID: id, UserID: uid, Kind: "before", Snapshot: string(planBytes)})

		// Optional sharding for large plans
		// DDL operations removed - use db-admin migrations instead
		var bulkShardTableExists bool
		_ = db.QueryRow(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'BulkActionShard')`).Scan(&bulkShardTableExists)

		if !bulkShardTableExists {
			log.Printf("ERROR: BulkActionShard table missing. Please run db-admin migrations.")
			apiErr := apierrors.New(apierrors.CodeInternalError, "Database schema error. Contact administrator.", nil)
			apiErr.HTTPStatus = http.StatusInternalServerError
			apiErr.WriteJSON(w, r)
			return
		}

		var shardRows []shardInsert
		if len(actionsAny) > 0 {
			batchSize := 20
			if v := strings.TrimSpace(os.Getenv("ADS_MUTATE_BATCH_SIZE")); v != "" {
				if n, e := strconv.Atoi(v); e == nil && n > 0 {
					batchSize = n
				}
			}

			total := len(actionsAny)
			if total > batchSize {
				shards := 0
				for i := 0; i < total; i += batchSize {
					j := i + batchSize
					if j > total {
						j = total
					}
					part := actionsAny[i:j]
					pb, _ := json.Marshal(map[string]any{"actions": part})
					shardRows = append(shardRows, shardInsert{OpID: id, Seq: shards, Actions: string(pb), Status: "queued"})
					shards++
				}

				sp := map[string]any{"kind": "shard_plan", "batchSize": batchSize, "shards": shards, "totalActions": total}
				sb, _ := json.Marshal(sp)
				auditRows = append(auditRows, auditInsert{OpID: id, UserID: uid, Kind: "other", Snapshot: string(sb)})
			}
		}

		// Fine-grained action snapshots
		if len(actionsAny) > 0 {
			for idx, a := range actionsAny {
				b, _ := json.Marshal(map[string]any{"actionIndex": idx, "action": a})
				auditRows = append(auditRows, auditInsert{OpID: id, UserID: uid, Kind: "other", Snapshot: string(b)})
			}
		}

		if len(shardRows) > 0 {
			insertBulkShards(db, shardRows)
		}
		if len(auditRows) > 0 {
			insertBulkAudits(db, auditRows)
		}

		// Store idempotency key
		if idemKey != "" {
			_, _ = db.Exec(`INSERT INTO idempotency_keys(key, user_id, scope, target_id, created_at, expires_at) VALUES ($1,$2,$3,$4,NOW(), NOW()+$5::interval) ON CONFLICT (key) DO UPDATE SET user_id=EXCLUDED.user_id, scope=EXCLUDED.scope, target_id=EXCLUDED.target_id, expires_at=EXCLUDED.expires_at`, idemKey, uid, scope, id, "24 hours")
			if cache != nil && cache.Ready() {
				_, _ = cache.SetNX(r.Context(), "idem:"+scope+":"+idemKey, id, 20*time.Minute)
			}
		}

		// Simulate progress for demo
		if strings.EqualFold(strings.TrimSpace(os.Getenv("SIMULATE_BULK_ACTION")), "1") {
			go simulateBulkActionExecution(db, id, uid, actionsAny)
		}
	}

	writeJSON(w, http.StatusAccepted, map[string]any{"operationId": id, "status": "queued", "summary": sum})
}

// Helper functions

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func generateOperationID() string {
	return strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
}

func extractUserID(r *http.Request) string {
	uid := ""
	if v := r.Context().Value(middleware.UserIDKey); v != nil {
		if s, ok := v.(string); ok {
			uid = s
		}
	}
	if uid == "" {
		if v := r.Header.Get("X-User-Id"); v != "" {
			uid = v
		}
	}
	return uid
}

type auditInsert struct {
	OpID     string
	UserID   string
	Kind     string
	Snapshot string
}

type shardInsert struct {
	OpID    string
	Seq     int
	Actions string
	Status  string
}

func insertBulkAudits(db *sql.DB, rows []auditInsert) {
	if len(rows) == 0 {
		return
	}
	if err := copyInAudits(db, rows); err != nil {
		log.Printf("adscenter: bulk audit COPY failed, fallback to single insert: %v", err)
		for _, r := range rows {
			_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,$3,$4::jsonb)`, r.OpID, r.UserID, r.Kind, r.Snapshot)
		}
	}
}

func insertBulkShards(db *sql.DB, rows []shardInsert) {
	if len(rows) == 0 {
		return
	}
	if err := copyInShards(db, rows); err != nil {
		log.Printf("adscenter: bulk shard COPY failed, fallback to single insert: %v", err)
		for _, r := range rows {
			_, _ = db.Exec(`INSERT INTO "BulkActionShard"(op_id, seq, actions, status) VALUES ($1,$2,$3,$4)`, r.OpID, r.Seq, r.Actions, r.Status)
		}
	}
}

func copyInAudits(db *sql.DB, rows []auditInsert) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(pq.CopyIn("BulkActionAudit", "op_id", "user_id", "kind", "snapshot"))
	if err != nil {
		tx.Rollback()
		return err
	}
	for _, r := range rows {
		if _, err := stmt.Exec(r.OpID, r.UserID, r.Kind, r.Snapshot); err != nil {
			stmt.Close()
			tx.Rollback()
			return err
		}
	}
	if _, err := stmt.Exec(); err != nil {
		stmt.Close()
		tx.Rollback()
		return err
	}
	if err := stmt.Close(); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func copyInShards(db *sql.DB, rows []shardInsert) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(pq.CopyIn("BulkActionShard", "op_id", "seq", "actions", "status"))
	if err != nil {
		tx.Rollback()
		return err
	}
	for _, r := range rows {
		if _, err := stmt.Exec(r.OpID, r.Seq, r.Actions, r.Status); err != nil {
			stmt.Close()
			tx.Rollback()
			return err
		}
	}
	if _, err := stmt.Exec(); err != nil {
		stmt.Close()
		tx.Rollback()
		return err
	}
	if err := stmt.Close(); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func simulateBulkActionExecution(db *sql.DB, opID, uid string, actions []map[string]any) {
	time.Sleep(500 * time.Millisecond)
	_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='running', updated_at=NOW() WHERE id=$1`, opID)

	rows, err := db.Query(`SELECT id, seq FROM "BulkActionShard" WHERE op_id=$1 ORDER BY seq ASC`, opID)
	if err == nil {
		for rows.Next() {
			var shardID int64
			var seq int
			if err := rows.Scan(&shardID, &seq); err == nil {
				_, _ = db.Exec(`UPDATE "BulkActionShard" SET status='running', updated_at=NOW() WHERE id=$1`, shardID)
				time.Sleep(400 * time.Millisecond)
				_, _ = db.Exec(`UPDATE "BulkActionShard" SET status='completed', updated_at=NOW() WHERE id=$1`, shardID)
			}
		}
		rows.Close()
	}

	time.Sleep(500 * time.Millisecond)
	_, _ = db.Exec(`UPDATE "BulkActionOperation" SET status='completed', updated_at=NOW() WHERE id=$1`, opID)

	var planTxt string
	_ = db.QueryRow(`SELECT plan::text FROM "BulkActionOperation" WHERE id=$1`, opID).Scan(&planTxt)
	snap := map[string]any{"summary": map[string]any{"status": "completed"}}
	if planTxt != "" {
		snap["plan"] = json.RawMessage(planTxt)
	}
	b, _ := json.Marshal(snap)
	_, _ = db.Exec(`INSERT INTO "BulkActionAudit"(op_id, user_id, kind, snapshot) VALUES ($1,$2,'after',$3::jsonb)`, opID, uid, string(b))
}
