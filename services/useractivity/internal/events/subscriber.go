package events

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	"cloud.google.com/go/pubsub"
	ev "github.com/ScientificInternet/Google-Monetize/pkg/events"
	"github.com/ScientificInternet/Google-Monetize/pkg/serviceclient"
	"net/http"
	"strings"
)

// Global service registry (set by main.go)
var globalServiceRegistry *serviceclient.Registry

// SetGlobalRegistry sets the global service registry for this package
func SetGlobalRegistry(registry *serviceclient.Registry) {
	globalServiceRegistry = registry
}

type Subscriber struct {
	client *pubsub.Client
	sub    *pubsub.Subscription
	db     *sql.DB
	pub    *ev.Publisher
}

func NewSubscriber(ctx context.Context, db *sql.DB, pub *ev.Publisher) (*Subscriber, error) {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	subID := os.Getenv("PUBSUB_SUBSCRIPTION_ID")
	topicID := os.Getenv("PUBSUB_TOPIC_ID")
	if projectID == "" || subID == "" {
		return nil, fmt.Errorf("missing GOOGLE_CLOUD_PROJECT or PUBSUB_SUBSCRIPTION_ID")
	}
	c, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}
	s := c.Subscription(subID)
	exists, err := s.Exists(ctx)
	if err != nil {
		return nil, err
	}
	if !exists {
		if topicID == "" {
			return nil, fmt.Errorf("subscription %s not exist and PUBSUB_TOPIC_ID missing for creation", subID)
		}
		t := c.Topic(topicID)
		s, err = c.CreateSubscription(ctx, subID, pubsub.SubscriptionConfig{Topic: t, AckDeadline: 20 * time.Second})
		if err != nil {
			return nil, err
		}
	}
	// Verify required tables exist (no DDL execution)
	if err := verifyRequiredTables(db); err != nil {
		log.Printf("useractivity: ERROR required tables missing: %v", err)
		log.Printf("useractivity: Please run db-admin migrations to initialize schema")
	}
	log.Printf("useractivity: subscriber initialized (project=%s, sub=%s)", projectID, subID)
	return &Subscriber{client: c, sub: s, db: db, pub: pub}, nil
}

func (s *Subscriber) Start(ctx context.Context) {
	go func() {
		log.Printf("useractivity: starting Receive on subscription %s", s.sub.ID())
		err := s.sub.Receive(ctx, func(cctx context.Context, msg *pubsub.Message) {
			et := msg.Attributes["eventType"]
			if et == "" {
				log.Printf("useractivity: drop message(no eventType)")
				msg.Ack()
				return
			}
			log.Printf("useractivity: received event type=%s", et)
			// Persist event to SQL event store (best-effort)
			_ = s.storeEvent(cctx, et, msg)
			switch et {
			case "SiterankCompleted":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				// unwrap envelope if present
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, "SiterankCompleted")
				// best-effort: project Offer status -> evaluated & write siterankScore if present
				offID, _ := strMap(payload, "offerId")
				uid, _ := strMap(payload, "userId")
				var score *float64
				if v, ok := payload["score"].(float64); ok {
					score = &v
				}
				if offID != "" && uid != "" {
					if score != nil {
						if _, err := s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated', "siterankScore"=$1 WHERE id=$2 AND "userId"=$3`, *score, offID, uid); err != nil {
							_, _ = s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated', siterankScore=$1 WHERE id=$2 AND userid=$3`, *score, offID, uid)
						}
					} else {
						if _, err := s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated' WHERE id=$1 AND "userId"=$2`, offID, uid); err != nil {
							_, _ = s.db.ExecContext(cctx, `UPDATE "Offer" SET status='evaluated' WHERE id=$1 AND userid=$2`, offID, uid)
						}
					}
				}
				msg.Ack()
			case "OfferCreated", "SiterankRequested":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				if et == "OfferCreated" {
					_ = s.projectOfferCreated(cctx, payload)
				}
				msg.Ack()
			case "BrandCoverageComputed":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				msg.Ack()
			case "WorkflowStarted", "WorkflowStepCompleted", "WorkflowCompleted":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				msg.Ack()
			case "BatchOpsTaskQueued", "BatchOpsTaskStarted", "BatchOpsTaskCompleted", "BatchOpsTaskFailed":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				_ = s.projectBatchopenTask(cctx, et, payload)
				if strings.ToLower(strings.TrimSpace(os.Getenv("ENABLE_SAGA"))) == "1" {
					if err := s.handleBatchopenSaga(cctx, et, payload); err != nil {
						log.Printf("useractivity: saga error: %v", err)
					}
				}
				msg.Ack()
			case "BrowserExecRequested", "BrowserExecCompleted":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				msg.Ack()
			case "TokenReserved", "TokenDebited", "TokenReverted", "TokenConsistencyRepaired":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				msg.Ack()
			case "BulkActionFailed", "BulkActionCompleted", "NotificationCreated":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				msg.Ack()
			case "CheckinCompleted":
				var payload map[string]any
				if err := json.Unmarshal(msg.Data, &payload); err != nil {
					log.Printf("useractivity: bad payload for CheckinCompleted: %v", err)
					msg.Nack()
					return
				}
				if dv, ok := payload["data"].(map[string]any); ok {
					payload = dv
				}
				_ = s.insertNotification(cctx, payload, et)
				_ = s.handleCheckinCompleted(cctx, payload)
				msg.Ack()
			default:
				msg.Ack()
			}
		})
		if err != nil {
			log.Printf("useractivity: subscriber stopped: %v", err)
		} else {
			log.Printf("useractivity: Receive returned nil (stopped)")
		}
	}()
}

func (s *Subscriber) Close() {
	if s.client != nil {
		s.client.Close()
	}
}

func (s *Subscriber) insertNotification(ctx context.Context, payload map[string]any, eventType string) error {
	// Resolve userId (best-effort)
	userID := ""
	if v, ok := payload["userId"].(string); ok {
		userID = v
	}
	// Fallback: try resolve from analysisId in SiterankAnalysis
	if userID == "" {
		if aidv, ok := payload["analysisId"].(string); ok && aidv != "" {
			var uid2 string
			if err := s.db.QueryRowContext(ctx, `SELECT user_id FROM "SiterankAnalysis" WHERE id=$1`, aidv).Scan(&uid2); err == nil && uid2 != "" {
				userID = uid2
			}
		}
	}
	// Rule engine: compute title/severity/category and normalized message
	title, msg := composeNotification(eventType, payload)
	messageB, _ := json.Marshal(msg)
	var id int64
	err := s.db.QueryRowContext(ctx, `INSERT INTO useractivity.notifications (user_id, type, title, message, created_at) VALUES ($1,$2,$3,$4,NOW()) RETURNING id`, userID, eventType, title, string(messageB)).Scan(&id)
	if err != nil {
		log.Printf("useractivity: insert failed: %v", err)
	} else {
		log.Printf("useractivity: insert ok userId=%s type=%s id=%d", userID, eventType, id)
	}
	// Best-effort Firestore UI cache
	_ = writeNotificationUI(ctx, userID, map[string]any{"type": eventType, "title": title, "payload": msg, "createdAt": time.Now().UTC()})
	// Publish NotificationSent for downstream consumers (best-effort)
	if s.pub != nil && id > 0 {
		_ = s.pub.Publish(ctx, ev.EventNotificationSent, map[string]any{
			"userId":         userID,
			"notificationId": fmt.Sprintf("%d", id),
			"type":           eventType,
			"title":          title,
			"time":           time.Now().UTC().Format(time.RFC3339),
		}, ev.WithSource("useractivity"), ev.WithSubject(fmt.Sprintf("%d", id)))
	}
	return err
}

// --- Required Tables Verification (MustKnowV7 compliant) ---

func verifyRequiredTables(db *sql.DB) error {
	requiredTables := []string{
		"user_notifications",
		"checkins",
		"user_checkin_stats",
		"referrals",
		"referral_records",
		"event_store",
		"trial_subscriptions",
	}

	for _, table := range requiredTables {
		var exists bool
		err := db.QueryRowContext(context.Background(),
			"SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
			table).Scan(&exists)

		if err != nil {
			return fmt.Errorf("failed to check table %s: %w", table, err)
		}

		if !exists {
			return fmt.Errorf("required table '%s' does not exist - please run db-admin migrations", table)
		}
	}

	log.Printf("useractivity: All required tables verified")
	return nil
}

func (s *Subscriber) storeEvent(ctx context.Context, eventType string, msg *pubsub.Message) error {
	if s == nil || s.db == nil || msg == nil {
		return nil
	}
	// Try to parse envelope for id/type/data
	var env map[string]any
	_ = json.Unmarshal(msg.Data, &env)
	eid := strings.TrimSpace(msg.Attributes["id"]) // optional
	if eid == "" {
		if v, ok := env["id"].(string); ok && v != "" {
			eid = v
		}
	}
	if eid == "" {
		eid = fmt.Sprintf("%d", time.Now().UnixNano())
	}
	name := eventType
	if v, ok := env["type"].(string); ok && v != "" {
		name = v
	}
	// payload
	payload := json.RawMessage(msg.Data)
	// try extract aggregate from common keys
	aggType := ""
	aggID := ""
	// unwrap data if present
	var data map[string]any
	if dv, ok := env["data"]; ok {
		b, _ := json.Marshal(dv)
		_ = json.Unmarshal(b, &data)
	} else {
		_ = json.Unmarshal(msg.Data, &data)
	}
	if data != nil {
		if v, ok := data["offerId"].(string); ok && v != "" {
			aggType, aggID = "Offer", v
		}
		if v, ok := data["taskId"].(string); ok && v != "" {
			aggType, aggID = "BatchopenTask", v
		}
		if v, ok := data["analysisId"].(string); ok && v != "" {
			aggType, aggID = "SiterankAnalysis", v
		}
	}
	// metadata
	meta := map[string]any{"attrs": msg.Attributes}
	if v, ok := env["source"].(string); ok && v != "" {
		meta["source"] = v
	}
	if v, ok := env["subject"].(string); ok && v != "" {
		meta["subject"] = v
	}
	mb, _ := json.Marshal(meta)
	_, err := s.db.ExecContext(ctx, `INSERT INTO event_store(event_id,event_name,aggregate_id,aggregate_type,version,payload,metadata,occurred_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,NOW())`, eid, name, aggID, aggType, 1, string(payload), string(mb))
	if err != nil {
		log.Printf("useractivity: storeEvent failed: %v", err)
	}
	return err
}

func strMap(m map[string]any, k string) (string, bool) {
	if v, ok := m[k]; ok {
		if s, ok2 := v.(string); ok2 {
			return s, true
		}
	}
	return "", false
}

// composeNotification maps an event into a structured in-app notification payload.
// Minimal rules: classify severity & category, keep original payload under data.
func composeNotification(eventType string, p map[string]any) (string, map[string]any) {
	// helpers
	str := func(k string) string {
		if v, ok := p[k].(string); ok {
			return v
		}
		return ""
	}
	now := time.Now().UTC().Format(time.RFC3339)
	msg := map[string]any{
		"severity":  "info",
		"category":  "general",
		"eventType": eventType,
		"time":      now,
		"data":      p,
	}
	title := eventType
	switch eventType {
	case "SiterankCompleted":
		title = "评估完成"
		msg["category"] = "siterank"
		msg["severity"] = "info"
	case "SiterankRequested":
		title = "评估已入队"
		msg["category"] = "siterank"
		msg["severity"] = "info"
	case "OfferCreated":
		title = "Offer 已创建"
		msg["category"] = "offer"
		msg["severity"] = "info"
		if name := str("name"); name != "" {
			msg["summary"] = fmt.Sprintf("%s 已创建", name)
		}
	case "BatchOpsTaskQueued":
		title = "批量任务已入队"
		msg["category"] = "batchopen"
		msg["severity"] = "info"
	case "BatchOpsTaskStarted":
		title = "批量任务开始执行"
		msg["category"] = "batchopen"
		msg["severity"] = "info"
	case "BatchOpsTaskCompleted":
		title = "批量任务完成"
		msg["category"] = "batchopen"
		msg["severity"] = "success"
	case "BatchOpsTaskFailed":
		title = "批量任务失败"
		msg["category"] = "batchopen"
		msg["severity"] = "error"
		if r := str("reason"); r != "" {
			msg["summary"] = r
		}
	case "WorkflowStarted":
		title = "工作流开始"
		msg["category"] = "workflow"
		msg["severity"] = "info"
	case "WorkflowStepCompleted":
		title = "工作流步骤完成"
		msg["category"] = "workflow"
		msg["severity"] = "info"
	case "WorkflowCompleted":
		title = "工作流完成"
		msg["category"] = "workflow"
		msg["severity"] = "success"
	case "TokenReserved":
		title = "已预留代币"
		msg["category"] = "billing"
		msg["severity"] = "info"
	case "TokenDebited":
		title = "扣费成功"
		msg["category"] = "billing"
		msg["severity"] = "success"
	case "TokenReverted":
		title = "已释放预留代币"
		msg["category"] = "billing"
		msg["severity"] = "warn"
	case "TokenConsistencyRepaired":
		title = "账务一致性已修复"
		msg["category"] = "billing"
		msg["severity"] = "success"
		if b, ok := p["userToken"].(float64); ok {
			msg["userToken"] = int64(b)
		}
		if pool, ok := p["pool"].(map[string]any); ok {
			msg["pool"] = pool
		}
		if op, ok := p["operatorUserId"].(string); ok && op != "" {
			msg["operatorUserId"] = op
		}
	case "BrowserExecRequested":
		title = "浏览器执行已请求"
		msg["category"] = "browser_exec"
		msg["severity"] = "info"
		if u := str("url"); u != "" {
			msg["url"] = u
		}
		if t := str("taskId"); t != "" {
			msg["taskId"] = t
		}
	case "BrowserExecCompleted":
		ok := false
		if v, ok2 := p["ok"].(bool); ok2 {
			ok = v
		}
		if ok {
			title = "浏览器执行完成"
			msg["severity"] = "success"
		} else {
			title = "浏览器执行失败"
			msg["severity"] = "error"
		}
		msg["category"] = "browser_exec"
		if t := str("taskId"); t != "" {
			msg["taskId"] = t
		}
		if q, ok2 := p["quality"].(float64); ok2 {
			msg["quality"] = int(q)
		}
	case "BrandCoverageComputed":
		title = "品牌覆盖度已更新"
		msg["category"] = "recommend"
		msg["severity"] = "info"
		if sd := str("seedDomain"); sd != "" {
			msg["seedDomain"] = sd
		}
		if acct := str("accountId"); acct != "" {
			msg["accountId"] = acct
		}
		if r, ok := p["coverageRatio"].(float64); ok {
			msg["coverageRatio"] = r
		}
		if m, ok := p["missingAliases"].([]any); ok {
			msg["missingAliases"] = m
		}
	case "BulkActionFailed":
		title = "批量执行失败"
		msg["category"] = "adscenter"
		msg["severity"] = "error"
		if id := str("operationId"); id != "" {
			msg["operationId"] = id
		}
		if at := str("actionType"); at != "" {
			msg["actionType"] = at
		}
		if e := str("error"); e != "" {
			msg["summary"] = e
		}
	case "BulkActionCompleted":
		title = "批量操作完成"
		msg["category"] = "adscenter"
		msg["severity"] = "success"
		if id := str("operationId"); id != "" {
			msg["operationId"] = id
		}
	case "CheckinCompleted":
		title = "签到奖励已发放"
		msg["category"] = "checkin"
		msg["severity"] = "success"
		if tokens := int64(0); func() bool {
			if v, ok := p["tokenReward"].(float64); ok {
				tokens = int64(v)
				return true
			}
			return false
		}() {
			msg["tokensEarned"] = tokens
			msg["summary"] = fmt.Sprintf("获得 %d 个代币奖励", tokens)
		}
		if streak := int64(0); func() bool {
			if v, ok := p["streak"].(float64); ok {
				streak = int64(v)
				return true
			}
			return false
		}() {
			msg["streak"] = streak
			if streak > 1 {
				msg["summary"] = fmt.Sprintf("连续签到 %d 天，获得代币奖励", streak)
			}
		}
		if checkinDate := str("checkinDate"); checkinDate != "" {
			msg["checkinDate"] = checkinDate
		}
	case "NotificationCreated":
		// passthrough using provided fields
		if t := str("title"); t != "" {
			title = t
		}
		if sev := str("type"); sev != "" {
			msg["severity"] = sev
		} else {
			msg["severity"] = "info"
		}
		msg["category"] = "system"
	default:
		// keep defaults
	}
	return title, msg
}

// --- Saga Coordinator (minimal) ---

func (s *Subscriber) handleBatchopenSaga(ctx context.Context, eventType string, p map[string]any) error {
	// Extract basics
	userID, _ := strMap(p, "userId")
	taskID, _ := strMap(p, "taskId")
	if userID == "" || taskID == "" {
		return nil
	}
	sagaID := "batchopen:" + taskID
	switch eventType {
	case "BatchOpsTaskQueued", "BatchOpsTaskStarted":
		_ = s.sagaUpsertInstance(ctx, sagaID, userID, "batchopen", taskID, "running")
		// reserve tokens (idempotent)
		if err := s.sagaBilling(ctx, userID, taskID, "reserve"); err != nil {
			_ = s.sagaInsertStep(ctx, sagaID, "reserve", "failed", err.Error())
			return err
		}
		_ = s.sagaInsertStep(ctx, sagaID, "reserve", "ok", "")
	case "BatchOpsTaskCompleted":
		if err := s.sagaBilling(ctx, userID, taskID, "commit"); err != nil {
			_ = s.sagaInsertStep(ctx, sagaID, "commit", "failed", err.Error())
			return err
		}
		_ = s.sagaInsertStep(ctx, sagaID, "commit", "ok", "")
		_ = s.sagaUpdateStatus(ctx, sagaID, "completed")
	case "BatchOpsTaskFailed":
		if err := s.sagaBilling(ctx, userID, taskID, "release"); err != nil {
			_ = s.sagaInsertStep(ctx, sagaID, "release", "failed", err.Error())
			return err
		}
		_ = s.sagaInsertStep(ctx, sagaID, "release", "ok", "")
		_ = s.sagaUpdateStatus(ctx, sagaID, "compensated")
	}
	return nil
}

func (s *Subscriber) sagaUpsertInstance(ctx context.Context, sagaID, userID, kind, taskID, status string) error {
	_, err := s.db.ExecContext(ctx, `
        INSERT INTO saga_instance(id, user_id, kind, task_id, status, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
        ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
    `, sagaID, userID, kind, taskID, status)
	return err
}

func (s *Subscriber) sagaUpdateStatus(ctx context.Context, sagaID, status string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE saga_instance SET status=$1, updated_at=NOW() WHERE id=$2`, status, sagaID)
	return err
}

func (s *Subscriber) sagaInsertStep(ctx context.Context, sagaID, name, status, lastErr string) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO saga_step(saga_id, name, status, attempts, last_error, updated_at) VALUES ($1,$2,$3,1,$4,NOW())`, sagaID, name, status, lastErr)
	return err
}

func (s *Subscriber) sagaBilling(ctx context.Context, userID, taskID, action string) error {
	if globalServiceRegistry == nil {
		return fmt.Errorf("service registry not initialized")
	}

	amount := 1
	if v := strings.TrimSpace(os.Getenv("SAGA_RESERVE_AMOUNT")); v != "" {
		var n int
		_, _ = fmt.Sscanf(v, "%d", &n)
		if n > 0 {
			amount = n
		}
	}

	body := map[string]any{"amount": amount, "taskId": taskID}
	if action == "commit" || action == "release" {
		body["txId"] = taskID
	}

	cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	err := globalServiceRegistry.CallJSON(cctx, "billing", serviceclient.Request{
		Method: http.MethodPost,
		Path:   "/api/v1/billing/tokens/" + action,
		Body:   body,
		Headers: map[string]string{
			"X-User-Id":         userID,
			"X-Idempotency-Key": fmt.Sprintf("saga:%s:%s", action, taskID),
		},
	}, nil)

	return err
}

// projectOfferCreated writes the Offer read model row (id,userId,name,originalUrl,status,createdAt)
func (s *Subscriber) projectOfferCreated(ctx context.Context, p map[string]any) error {
	// extract fields safely
	getStr := func(k string) string {
		if v, ok := p[k].(string); ok {
			return v
		}
		return ""
	}
	id := getStr("offerId")
	user := getStr("userId")
	name := getStr("name")
	original := getStr("originalUrl")
	status := getStr("status")
	if id == "" || user == "" || original == "" {
		return nil
	}
	// createdAt is optional; server defaults now()
	_, err := s.db.ExecContext(ctx, `
        INSERT INTO "Offer" (id, userid, name, originalurl, status, created_at)
        VALUES ($1,$2,$3,$4,$5, NOW())
        ON CONFLICT (id) DO NOTHING
    `, id, user, name, original, status)
	if err != nil {
		log.Printf("useractivity: projectOfferCreated failed: %v", err)
	}
	return err
}

// projectBatchopenTask upserts task status into read model table BatchopenTask.
func (s *Subscriber) projectBatchopenTask(ctx context.Context, eventType string, p map[string]any) error {
	getStr := func(k string) string {
		if v, ok := p[k].(string); ok {
			return v
		}
		return ""
	}
	taskID := getStr("taskId")
	userID := getStr("userId")
	offerID := getStr("offerId")
	if taskID == "" || userID == "" {
		return nil
	}
	status := "queued"
	switch eventType {
	case "BatchOpsTaskQueued":
		status = "queued"
	case "BatchOpsTaskStarted":
		status = "running"
	case "BatchOpsTaskCompleted":
		status = "completed"
	case "BatchOpsTaskFailed":
		status = "failed"
	}
	// optional result
	var resultJSON string
	if m, ok := p["result"].(map[string]any); ok {
		if b, err := json.Marshal(m); err == nil {
			resultJSON = string(b)
		}
	}
	// upsert
	if status == "queued" {
		_, err := s.db.ExecContext(ctx, `
            INSERT INTO "BatchopenTask"(id, "userId", "offerId", status, created_at, updated_at)
            VALUES ($1,$2,$3,$4,NOW(),NOW())
            ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW()
        `, taskID, userID, offerID, status)
		if err != nil {
			log.Printf("projectBatchopenTask insert failed: %v", err)
		}
		return err
	}
	if resultJSON != "" {
		_, err := s.db.ExecContext(ctx, `UPDATE "BatchopenTask" SET status=$1, result=$2::jsonb, updated_at=NOW() WHERE id=$3`, status, resultJSON, taskID)
		if err != nil {
			log.Printf("projectBatchopenTask update failed: %v", err)
		}
		return err
	}
	_, err := s.db.ExecContext(ctx, `UPDATE "BatchopenTask" SET status=$1, updated_at=NOW() WHERE id=$2`, status, taskID)
	if err != nil {
		log.Printf("projectBatchopenTask update failed: %v", err)
	}
	return err
}

// handleCheckinCompleted processes checkin events and forwards to billing service for token rewards
func (s *Subscriber) handleCheckinCompleted(ctx context.Context, payload map[string]any) error {
	userID, _ := strMap(payload, "userId")
	checkinID, _ := strMap(payload, "checkinId")
	tokenReward := int64(0)
	if v, ok := payload["tokenReward"].(float64); ok {
		tokenReward = int64(v)
	}

	if userID == "" || checkinID == "" || tokenReward <= 0 {
		log.Printf("useractivity: invalid CheckinCompleted payload: userId=%s, checkinId=%s, tokenReward=%d", userID, checkinID, tokenReward)
		return nil
	}

	log.Printf("useractivity: processing CheckinCompleted for userId=%s, tokenReward=%d", userID, tokenReward)

	// Forward to billing service for token credit (async, best-effort)
	if globalServiceRegistry != nil {
		requestBody := map[string]interface{}{
			"amount":      tokenReward,
			"description": fmt.Sprintf("Daily check-in reward (checkinId: %s)", checkinID),
			"metadata": map[string]interface{}{
				"source":    "useractivity",
				"checkinId": checkinID,
				"eventType": "CheckinCompleted",
			},
		}

		cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()

		err := globalServiceRegistry.CallJSON(cctx, "billing", serviceclient.Request{
			Method: http.MethodPost,
			Path:   "/api/v1/billing/tokens/credit/checkin",
			Body:   requestBody,
			Headers: map[string]string{
				"X-User-Id":      userID,
				"X-Event-Source": "useractivity-checkin",
			},
		}, nil)

		if err != nil {
			log.Printf("useractivity: failed to credit tokens for userId=%s: %v", userID, err)
			// Don't fail the event processing - token credit can be retried separately
			return nil
		}

		log.Printf("useractivity: successfully credited %d tokens to userId=%s via billing service", tokenReward, userID)
	} else {
		log.Printf("useractivity: service registry not initialized, cannot credit tokens for userId=%s", userID)
	}

	return nil
}

func writeNotificationUI(ctx context.Context, userID string, doc map[string]any) error {
	if userID == "" {
		return nil
	}
	if strings.TrimSpace(os.Getenv("FIRESTORE_ENABLED")) != "1" {
		return nil
	}
	pid := strings.TrimSpace(os.Getenv("GOOGLE_CLOUD_PROJECT"))
	if pid == "" {
		pid = strings.TrimSpace(os.Getenv("PROJECT_ID"))
	}
	if pid == "" {
		return nil
	}
	cctx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()
	cli, err := firestore.NewClient(cctx, pid)
	if err != nil {
		return err
	}
	defer cli.Close()
	// auto doc ID (server timestamp fallback); for ordering rely on createdAt
	_, err = cli.Collection("users/"+userID+"/notifications").NewDoc().Set(cctx, doc)
	return err
}
