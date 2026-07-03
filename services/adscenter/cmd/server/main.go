package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/errors"
	"github.com/ScientificInternet/Google-Monetize/pkg/logger"
	"github.com/ScientificInternet/Google-Monetize/pkg/metrics"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adsconfig "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/storage"
	"github.com/go-redis/redis/v8"
	_ "github.com/lib/pq"
)

type Campaign struct {
	Name string `json:"name"`
}

var (
	dbAdapter *storage.AdsCenterAdapter
	db        *sql.DB // 向后兼容
	rdb       *redis.Client
	ctx       = context.Background()
	log       = logger.Get()
)

func main() {
	// Load config (DATABASE_URL may come from Secret Manager)
	cfg, err := adsconfig.Load(context.Background())
	if err != nil {
		log.Fatal().Err(err).Msg("Error loading config")
	}

	// 创建数据库适配器
	dbAdapter, err = storage.NewAdsCenterAdapter(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Error creating database adapter")
	}
	defer dbAdapter.Close()

	// 确保表结构存在
	if err := dbAdapter.EnsureTablesExist(ctx); err != nil {
		log.Warn().Err(err).Msg("Failed to ensure tables exist (may require manual migration)")
	}

	// 获取适配器状态
	if status, err := dbAdapter.GetAdapterStatus(ctx); err == nil {
		log.Info().Str("mode", fmt.Sprintf("%v", status.Mode)).
			Bool("connected", status.Connected).
			Bool("has_db_admin", status.HasDBAdmin).
			Str("db_admin_status", status.DBAdminStatus).
			Msg("Database adapter initialized")
	}

	// 向后兼容：保留直接数据库连接
	db = dbAdapter.GetDirectDB()
	if db != nil {
		defer db.Close()
		if err := db.Ping(); err != nil {
			log.Fatal().Err(err).Msg("Error pinging the database at startup")
		}
		log.Info().Msg("Successfully connected to the database!")
	} else {
		log.Info().Msg("Using database adapter without direct connection")
	}

	// Redis is optional in local; only initialize when REDIS_URL is present
	redisURL := os.Getenv("REDIS_URL")
	var opt *redis.Options
	var rerr error
	if redisURL != "" {
		opt, err = redis.ParseURL(redisURL)
		rerr = err
	}
	if rerr == nil && opt != nil {
		rdb = redis.NewClient(opt)
		if _, err = rdb.Ping(ctx).Result(); err == nil {
			log.Info().Msg("Successfully connected to Redis!")
		} else {
			log.Warn().Err(err).Msg("Redis configured but not reachable")
		}
	} else {
		log.Info().Msg("REDIS_URL not set; skipping Redis init")
	}

	// Initialize metrics
	m := metrics.New(metrics.Config{
		ServiceName: "adscenter",
		Namespace:   "gm",
	})

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", healthCheckHandler)
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		c, cancel := context.WithTimeout(r.Context(), 800*time.Millisecond)
		defer cancel()

		// 使用适配器检查连接状态
		if status, err := dbAdapter.GetAdapterStatus(c); err != nil || !status.Connected {
			var errMsg string
			if err != nil {
				errMsg = err.Error()
			} else {
				errMsg = "database adapter not connected"
			}
			errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": errMsg})
			return
		}

		// 如果有直接连接，也检查它
		if db != nil {
			if err := db.PingContext(c); err != nil {
				errors.Write(w, r, http.StatusInternalServerError, "NOT_READY", "dependencies not ready", map[string]string{"db": err.Error()})
				return
			}
		}

		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/metrics", metrics.Handler())

	protected := http.NewServeMux()
	protected.HandleFunc("/adscenter/campaigns", createCampaignHandler)
	protected.HandleFunc("/adscenter/adapter-status", adapterStatusHandler)
	protected.HandleFunc("/adscenter/test-db-operations", testDBOperationsHandler)

	// Supabase Auth middleware
	mux.Handle("/", middleware.AuthMiddleware(protected))

	log.Info().Str("port", cfg.Port).Msg("Adscenter service starting...")
	// Wrap root with RequestID and Metrics middleware
	root := middleware.RequestID()(m.Middleware(mux))
	if err := http.ListenAndServe(":"+cfg.Port, root); err != nil {
		log.Fatal().Err(err).Msg("Failed to start server")
	}
}

// no-op helpers removed

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	// 使用适配器检查数据库健康状态
	var dbErr error
	if status, err := dbAdapter.GetAdapterStatus(r.Context()); err != nil {
		dbErr = err
	} else if !status.Connected {
		dbErr = fmt.Errorf("database adapter not connected")
	} else if db != nil {
		// 如果有直接连接，也检查它
		dbErr = db.Ping()
	}

	redisErr := rdb.Ping(ctx).Err()
	if dbErr != nil || redisErr != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Health check failed:\n")
		if dbErr != nil {
			fmt.Fprintf(w, "  - Database error: %v\n", dbErr)
		}
		if redisErr != nil {
			fmt.Fprintf(w, "  - Redis error: %v\n", redisErr)
		}
		return
	}
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "OK")
}

func createCampaignHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)
	var campaign Campaign
	if err := json.NewDecoder(r.Body).Decode(&campaign); err != nil {
		errors.Write(w, r, http.StatusBadRequest, "INVALID_ARGUMENT", err.Error(), nil)
		return
	}

	// Record ad creation metrics
	m := metrics.GetGlobalBusinessMetrics()
	// Use placeholder values since campaign details aren't fully available in this simple handler
	m.AddCounter(metrics.MetricAdsCreated, 1, map[string]string{
		"user_id":     userID,
		"campaign_id": "unknown", // Will be enhanced when full campaign data is available
		"platform":    "google_ads",
	})

	log.Info().Str("userID", userID).Str("campaignName", campaign.Name).Msg("Adscenter campaign created")
	w.WriteHeader(http.StatusCreated)
}

// adapterStatusHandler 返回数据库适配器状态
func adapterStatusHandler(w http.ResponseWriter, r *http.Request) {
	status, err := dbAdapter.GetAdapterStatus(r.Context())
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// testDBOperationsHandler 测试数据库操作
func testDBOperationsHandler(w http.ResponseWriter, r *http.Request) {
	userID, _ := r.Context().Value(middleware.UserIDKey).(string)

	// 测试创建审计事件
	err := dbAdapter.CreateAuditEvent(r.Context(), userID, "test_operation", map[string]interface{}{
		"message":   "Test database operation",
		"timestamp": time.Now().Unix(),
	})
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "DB_ERROR", "Failed to create audit event", map[string]string{"error": err.Error()})
		return
	}

	// 测试获取审计事件
	events, err := dbAdapter.GetUserAuditEvents(r.Context(), userID, 5, "test_operation")
	if err != nil {
		errors.Write(w, r, http.StatusInternalServerError, "DB_ERROR", "Failed to get audit events", map[string]string{"error": err.Error()})
		return
	}

	response := map[string]interface{}{
		"message":            "Database operations test successful",
		"user_id":            userID,
		"audit_events_count": len(events),
		"latest_events":      events,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
