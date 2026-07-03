package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/pkg/apierrors"
	pcache "github.com/ScientificInternet/Google-Monetize/pkg/cache"
	dbutil "github.com/ScientificInternet/Google-Monetize/pkg/database"
	"github.com/ScientificInternet/Google-Monetize/pkg/middleware"
	adsstub "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/ads"
	adscfg "github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/config"
	"github.com/ScientificInternet/Google-Monetize/services/adscenter/internal/storage"
	chi "github.com/go-chi/chi/v5"
	guuid "github.com/google/uuid"
)

// MiscHandler handles miscellaneous endpoints (Reports, Strategies, Accounts)
type MiscHandler struct {
	DB *sql.DB
	RC *pcache.Cache
}

// NewMiscHandler creates a new misc handler
func NewMiscHandler(db *sql.DB, rc *pcache.Cache) *MiscHandler {
	return &MiscHandler{DB: db, RC: rc}
}

// HandleAccounts returns the list of accessible customer resource names for the current user
// GET /api/v1/adscenter/accounts
func (h *MiscHandler) HandleAccounts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()
	items, cacheStatus, err := h.loadAccountsSnapshot(ctx, uid)
	if err != nil {
		apiErr := apierrors.InternalError("Failed to load accounts")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	if cacheStatus != "" {
		w.Header().Set("X-Cache", cacheStatus)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// HandleAccountsStream streams account snapshots using SSE.
// GET /api/v1/adscenter/accounts/stream
func (h *MiscHandler) HandleAccountsStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		apiErr := apierrors.InternalError("Streaming unsupported")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	sendSnapshot := func() (bool, error) {
		items, _, err := h.loadAccountsSnapshot(ctx, uid)
		if err != nil {
			return false, err
		}

		payload, err := json.Marshal(map[string]any{"items": items})
		if err != nil {
			return false, err
		}

		if _, err := fmt.Fprintf(w, "event: accounts\ndata: %s\n\n", payload); err != nil {
			return false, err
		}

		flusher.Flush()
		return hasSyncingAccounts(items), nil
	}

	active, err := sendSnapshot()
	if err != nil {
		if ctx.Err() == nil {
			log.Printf("[adscenter] stream initial snapshot failed: %v", err)
		}
		return
	}

	interval := 20 * time.Second
	if active {
		interval = 5 * time.Second
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			active, err := sendSnapshot()
			if err != nil {
				if ctx.Err() == nil {
					log.Printf("[adscenter] stream send failed: %v", err)
				}
				return
			}

			desired := 20 * time.Second
			if active {
				desired = 5 * time.Second
			}

			if desired != interval {
				interval = desired
				ticker.Reset(interval)
			}
		}
	}
}

func (h *MiscHandler) loadAccountsSnapshot(ctx context.Context, uid string) ([]accountPayload, string, error) {
	cacheKey := fmt.Sprintf("adscenter:accounts:%s", uid)

	if h.RC != nil && h.RC.Ready() {
		if cached, ok := h.RC.Get(ctx, cacheKey); ok {
			var wrapper struct {
				Items []accountPayload `json:"items"`
			}
			if err := json.Unmarshal([]byte(cached), &wrapper); err == nil {
				return wrapper.Items, "HIT", nil
			}
		}
	}

	if supaAccounts, err := h.listSupabaseAccounts(ctx, uid); err == nil {
		if len(supaAccounts) > 0 {
			h.cacheAccountsSnapshot(ctx, cacheKey, supaAccounts)
			return supaAccounts, "MISS", nil
		}
	} else if !isUndefinedAdsConnectionsErr(err) {
		return nil, "", err
	}

	cfgAds, _ := adscfg.LoadAdsCreds(ctx)

	tokenEnc, _, _, err := storage.GetUserRefreshToken(ctx, h.DB, uid)
	if err != nil || strings.TrimSpace(tokenEnc) == "" {
		return nil, "", fmt.Errorf("missing refresh token")
	}

	var userRT string
	if pt, ok := DecryptWithRotation(tokenEnc); ok {
		userRT = pt
	} else {
		if os.Getenv("REFRESH_TOKEN_ENC_KEY_B64") != "" || os.Getenv("REFRESH_TOKEN_ENC_KEY_B64_OLD") != "" {
			return nil, "", fmt.Errorf("decrypt refresh token failed")
		}
		userRT = tokenEnc
	}

	live, err := adsstub.NewClient(ctx, adsstub.LiveConfig{
		DeveloperToken:    cfgAds.DeveloperToken,
		OAuthClientID:     cfgAds.OAuthClientID,
		OAuthClientSecret: cfgAds.OAuthClientSecret,
		RefreshToken:      userRT,
		LoginCustomerID:   cfgAds.LoginCustomerID,
	})
	if err != nil {
		return nil, "", err
	}
	defer live.Close()

	names, err := live.ListAccessibleCustomers(ctx)
	if err != nil {
		return nil, "", err
	}

	items := make([]accountPayload, 0, len(names))
	for _, rn := range names {
		id := rn
		if i := strings.LastIndex(rn, "/"); i >= 0 {
			id = rn[i+1:]
		}
		connectedAt := time.Now().UTC().Format(time.RFC3339)
		payload := accountPayload{
			ID:               id,
			AccountID:        id,
			AccountName:      rn,
			Status:           "active",
			Provider:         "google",
			CurrencyCode:     "USD",
			Timezone:         "UTC",
			ConnectedAt:      connectedAt,
			CreatedAt:        connectedAt,
			UpdatedAt:        connectedAt,
			TotalCost:        0,
			TotalRevenue:     0,
			TotalConversions: 0,
			Roas:             0,
			LinkedOffers:     0,
			ActiveCampaigns:  0,
		}
		payload.applyDefaults()
		items = append(items, payload)
	}

	h.cacheAccountsSnapshot(ctx, cacheKey, items)

	return items, "MISS", nil
}

func (h *MiscHandler) cacheAccountsSnapshot(ctx context.Context, key string, items []accountPayload) {
	if h.RC == nil || !h.RC.Ready() {
		return
	}

	payload := map[string]any{"items": items}
	if data, err := json.Marshal(payload); err == nil {
		h.RC.Set(ctx, key, string(data), 5*time.Minute)
	}
}

func hasSyncingAccounts(accounts []accountPayload) bool {
	for _, account := range accounts {
		status := strings.ToLower(strings.TrimSpace(account.Status))
		if status == "syncing" || status == "pending" || strings.Contains(status, "sync") {
			return true
		}
	}
	return false
}

// HandleAccountDetail returns detailed information about a single account
// GET /api/v1/adscenter/accounts/{id}
func (h *MiscHandler) HandleAccountDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	accountID := strings.TrimSpace(chi.URLParam(r, "id"))
	if accountID == "" {
		apiErr := apierrors.InvalidRequest("id", "accountId required")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()
	payload, err := h.fetchSupabaseAccount(ctx, uid, accountID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			apiErr := apierrors.NotFound("Account", accountID)
			apiErr.WriteJSON(w, r)
			return
		}
		if isUndefinedAdsConnectionsErr(err) {
			apiErr := apierrors.NotFound("Account", accountID)
			apiErr.WriteJSON(w, r)
			return
		}
		apiErr := apierrors.InternalError("Failed to load account")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	writeJSON(w, http.StatusOK, payload)
}

// HandleSyncAllAccounts updates the synced_at timestamp for all accounts of current user.
// POST /api/v1/adscenter/accounts/sync-all
func (h *MiscHandler) HandleSyncAllAccounts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	if h.DB == nil {
		apiErr := apierrors.InternalError("database not configured")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()
	queryCtx, cancel := dbutil.WithShortQueryTimeout(ctx)
	defer cancel()
	syncedAt := time.Now().UTC()
	res, err := h.DB.ExecContext(queryCtx, `
		UPDATE public.ads_connections
		SET synced_at = $1,
		    updated_at = NOW()
	WHERE user_id = $2
	`, syncedAt, uid)
	if err != nil {
		apiErr := apierrors.InternalError("Failed to update accounts")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	count, _ := res.RowsAffected()

	// Invalidate cache
	if h.RC != nil && h.RC.Ready() {
		cacheKey := fmt.Sprintf("adscenter:accounts:%s", uid)
		h.RC.Del(ctx, cacheKey)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"synced_count": count,
		"synced_at":    syncedAt.Format(time.RFC3339),
	})
}

// HandleSyncAccount updates the synced_at timestamp for a specific account of current user.
// POST /api/v1/adscenter/accounts/{id}/sync
func (h *MiscHandler) HandleSyncAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	accountID := strings.TrimSpace(chi.URLParam(r, "id"))
	if accountID == "" {
		apiErr := apierrors.InvalidRequest("id", "accountId required")
		apiErr.WriteJSON(w, r)
		return
	}

	if h.DB == nil {
		apiErr := apierrors.InternalError("database not configured")
		apiErr.WriteJSON(w, r)
		return
	}

	syncedAt := time.Now().UTC()
	ctx := r.Context()
	queryCtx, cancel := dbutil.WithShortQueryTimeout(ctx)
	defer cancel()
	var res sql.Result
	var err error
	if parsed, parseErr := uuidParse(accountID); parseErr == nil {
		res, err = h.DB.ExecContext(queryCtx, `
			UPDATE public.ads_connections
			SET synced_at = $1,
			    updated_at = NOW()
			WHERE user_id = $2 AND id = $3::uuid
		`, syncedAt, uid, parsed)
	} else {
		res, err = h.DB.ExecContext(queryCtx, `
			UPDATE public.ads_connections
			SET synced_at = $1,
			    updated_at = NOW()
			WHERE user_id = $2 AND account_id = $3
		`, syncedAt, uid, accountID)
	}

	if err != nil {
		apiErr := apierrors.InternalError("Failed to update account")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		apiErr := apierrors.NotFound("account not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	// Invalidate cache
	if h.RC != nil && h.RC.Ready() {
		cacheKey := fmt.Sprintf("adscenter:accounts:%s", uid)
		h.RC.Del(ctx, cacheKey)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"synced_at": syncedAt.Format(time.RFC3339),
	})
}

// HandleDisconnectAccount deletes an account connection for the current user.
// POST /api/v1/adscenter/accounts/{id}/disconnect
func (h *MiscHandler) HandleDisconnectAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	accountID := strings.TrimSpace(chi.URLParam(r, "id"))
	if accountID == "" {
		apiErr := apierrors.InvalidRequest("id", "accountId required")
		apiErr.WriteJSON(w, r)
		return
	}

	if h.DB == nil {
		apiErr := apierrors.InternalError("database not configured")
		apiErr.WriteJSON(w, r)
		return
	}

	ctx := r.Context()
	queryCtx, cancel := dbutil.WithShortQueryTimeout(ctx)
	defer cancel()
	var res sql.Result
	var err error
	if parsed, parseErr := uuidParse(accountID); parseErr == nil {
		res, err = h.DB.ExecContext(queryCtx, `
			DELETE FROM public.ads_connections
			WHERE user_id = $1 AND id = $2::uuid
		`, uid, parsed)
	} else {
		res, err = h.DB.ExecContext(queryCtx, `
			DELETE FROM public.ads_connections
			WHERE user_id = $1 AND account_id = $2
		`, uid, accountID)
	}

	if err != nil {
		apiErr := apierrors.InternalError("Failed to delete account")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}

	if n, _ := res.RowsAffected(); n == 0 {
		apiErr := apierrors.NotFound("account not found", "")
		apiErr.WriteJSON(w, r)
		return
	}

	// Invalidate cache
	if h.RC != nil && h.RC.Ready() {
		cacheKey := fmt.Sprintf("adscenter:accounts:%s", uid)
		h.RC.Del(ctx, cacheKey)
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

// HandleTransferBudget performs a stubbed budget transfer between accounts.
// POST /api/v1/adscenter/transfer-budget
func (h *MiscHandler) HandleTransferBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid == "" {
		apiErr := apierrors.Unauthorized("Unauthorized")
		apiErr.WriteJSON(w, r)
		return
	}

	var payload struct {
		FromAccountID string  `json:"from_account_id"`
		ToAccountID   string  `json:"to_account_id"`
		Amount        float64 `json:"amount"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		apiErr := apierrors.InvalidRequest("body", "invalid request body")
		apiErr.WriteJSON(w, r)
		return
	}

	if payload.FromAccountID == "" || payload.ToAccountID == "" || payload.Amount <= 0 {
		apiErr := apierrors.InvalidRequest("payload", "from_account_id, to_account_id and positive amount required")
		apiErr.WriteJSON(w, r)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":      true,
		"from_account": payload.FromAccountID,
		"to_account":   payload.ToAccountID,
		"amount":       payload.Amount,
		"processed_at": time.Now().UTC().Format(time.RFC3339),
		"initiated_by": uid,
	})
}

type accountPayload struct {
	ID               string  `json:"id"`
	AccountID        string  `json:"accountId"`
	AccountName      string  `json:"accountName"`
	Status           string  `json:"status"`
	Provider         string  `json:"provider"`
	CurrencyCode     string  `json:"currencyCode"`
	Timezone         string  `json:"timezone"`
	ConnectedAt      string  `json:"connectedAt"`
	LastSyncedAt     *string `json:"lastSyncedAt,omitempty"`
	CreatedAt        string  `json:"createdAt"`
	UpdatedAt        string  `json:"updatedAt"`
	TotalCost        float64 `json:"totalCost"`
	TotalRevenue     float64 `json:"totalRevenue"`
	TotalConversions float64 `json:"totalConversions"`
	Roas             float64 `json:"roas"`
	LinkedOffers     int     `json:"linkedOffersCount"`
	ActiveCampaigns  int     `json:"activeCampaignsCount"`
}

func (h *MiscHandler) listSupabaseAccounts(ctx context.Context, userID string) ([]accountPayload, error) {
	if h.DB == nil {
		return nil, errors.New("db not configured")
	}

	queryCtx, cancel := dbutil.WithShortQueryTimeout(ctx)
	defer cancel()

	rows, err := h.DB.QueryContext(queryCtx, `
		SELECT id::text,
		       COALESCE(account_id, '') AS account_id,
		       COALESCE(account_name, '') AS account_name,
		       COALESCE(status, 'active') AS status,
		       COALESCE(provider, 'google') AS provider,
		       synced_at,
		       created_at,
		       COALESCE(updated_at, created_at) AS updated_at
		FROM public.ads_connections
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]accountPayload, 0)
	for rows.Next() {
		var (
			item        accountPayload
			accountID   sql.NullString
			accountName sql.NullString
			status      sql.NullString
			provider    sql.NullString
			syncedAt    sql.NullTime
			createdAt   time.Time
			updatedAt   time.Time
		)

		if err := rows.Scan(&item.ID, &accountID, &accountName, &status, &provider, &syncedAt, &createdAt, &updatedAt); err != nil {
			return nil, err
		}

		item.AccountID = strings.TrimSpace(accountID.String)
		if item.AccountID == "" {
			item.AccountID = item.ID
		}
		item.AccountName = strings.TrimSpace(accountName.String)
		item.Status = strings.ToLower(strings.TrimSpace(status.String))
		item.Provider = strings.TrimSpace(provider.String)
		item.CurrencyCode = "USD"
		item.Timezone = "UTC"
		item.ConnectedAt = createdAt.UTC().Format(time.RFC3339)
		item.CreatedAt = item.ConnectedAt
		item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if syncedAt.Valid {
			formatted := syncedAt.Time.UTC().Format(time.RFC3339)
			item.LastSyncedAt = &formatted
		}
		item.applyDefaults()
		accounts = append(accounts, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return accounts, nil
}

func (h *MiscHandler) fetchSupabaseAccount(ctx context.Context, userID, accountID string) (*accountPayload, error) {
	if h.DB == nil {
		return nil, errors.New("db not configured")
	}

	queryCtx, cancel := dbutil.WithShortQueryTimeout(ctx)
	defer cancel()

	var row *sql.Row
	if parsed, err := uuidParse(accountID); err == nil {
		row = h.DB.QueryRowContext(queryCtx, `
			SELECT id::text,
			       COALESCE(account_id, '') AS account_id,
			       COALESCE(account_name, '') AS account_name,
			       COALESCE(status, 'active') AS status,
			       COALESCE(provider, 'google') AS provider,
			       synced_at,
			       created_at,
			       COALESCE(updated_at, created_at) AS updated_at
			FROM public.ads_connections
			WHERE user_id = $1 AND id = $2::uuid
		`, userID, parsed)
	} else {
		row = h.DB.QueryRowContext(queryCtx, `
			SELECT id::text,
			       COALESCE(account_id, '') AS account_id,
			       COALESCE(account_name, '') AS account_name,
			       COALESCE(status, 'active') AS status,
			       COALESCE(provider, 'google') AS provider,
			       synced_at,
			       created_at,
			       COALESCE(updated_at, created_at) AS updated_at
			FROM public.ads_connections
			WHERE user_id = $1 AND account_id = $2
		`, userID, accountID)
	}

	var (
		item      accountPayload
		accID     sql.NullString
		accName   sql.NullString
		status    sql.NullString
		provider  sql.NullString
		syncedAt  sql.NullTime
		createdAt time.Time
		updatedAt time.Time
	)

	if err := row.Scan(&item.ID, &accID, &accName, &status, &provider, &syncedAt, &createdAt, &updatedAt); err != nil {
		return nil, err
	}

	item.AccountID = strings.TrimSpace(accID.String)
	if item.AccountID == "" {
		item.AccountID = item.ID
	}
	item.AccountName = strings.TrimSpace(accName.String)
	item.Status = strings.ToLower(strings.TrimSpace(status.String))
	item.Provider = strings.TrimSpace(provider.String)
	item.CurrencyCode = "USD"
	item.Timezone = "UTC"
	item.ConnectedAt = createdAt.UTC().Format(time.RFC3339)
	item.CreatedAt = item.ConnectedAt
	item.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
	if syncedAt.Valid {
		formatted := syncedAt.Time.UTC().Format(time.RFC3339)
		item.LastSyncedAt = &formatted
	}
	item.applyDefaults()

	return &item, nil
}

func isUndefinedAdsConnectionsErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "relation \"public.ads_connections\" does not exist") || strings.Contains(msg, "relation \"ads_connections\" does not exist")
}

func uuidParse(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", errors.New("empty uuid")
	}
	if _, err := guuid.Parse(value); err != nil {
		return "", err
	}
	return value, nil
}

func (a *accountPayload) applyDefaults() {
	if a.AccountID == "" {
		a.AccountID = a.ID
	}
	if strings.TrimSpace(a.AccountName) == "" {
		a.AccountName = a.AccountID
	}
	if a.Status == "" {
		a.Status = "active"
	}
	if a.Provider == "" {
		a.Provider = "google"
	}
	if a.CurrencyCode == "" {
		a.CurrencyCode = "USD"
	}
	if a.Timezone == "" {
		a.Timezone = "UTC"
	}
	if strings.TrimSpace(a.ConnectedAt) == "" {
		a.ConnectedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if strings.TrimSpace(a.CreatedAt) == "" {
		a.CreatedAt = a.ConnectedAt
	}
	if strings.TrimSpace(a.UpdatedAt) == "" {
		a.UpdatedAt = a.CreatedAt
	}
	if a.LastSyncedAt != nil && strings.TrimSpace(*a.LastSyncedAt) == "" {
		a.LastSyncedAt = nil
	}
	// For MVP we keep numeric fields zero-initialized
	// but ensure non-negative defaults
	if a.TotalCost < 0 {
		a.TotalCost = 0
	}
	if a.TotalRevenue < 0 {
		a.TotalRevenue = 0
	}
	if a.TotalConversions < 0 {
		a.TotalConversions = 0
	}
	if a.Roas < 0 {
		a.Roas = 0
	}
	if a.LinkedOffers < 0 {
		a.LinkedOffers = 0
	}
	if a.ActiveCampaigns < 0 {
		a.ActiveCampaigns = 0
	}
}

// HandleStrategies returns a built-in list of optimization strategy templates
// GET /api/v1/adscenter/strategies
func (h *MiscHandler) HandleStrategies(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	// Minimal strategy library (can be extended or moved to DB in future)
	strategies := []map[string]any{
		{
			"id":          "budget_increase_win",
			"title":       "提升赢家预算",
			"description": "A/B 测试胜者广告系列增加预算 20%，失败者下调 20%",
			"plan": map[string]any{
				"validateOnly": true,
				"actions": []map[string]any{
					{"type": "ADJUST_BUDGET", "filter": map[string]any{"variant": "A"}, "params": map[string]any{"percent": 20}},
					{"type": "ADJUST_BUDGET", "filter": map[string]any{"variant": "B"}, "params": map[string]any{"percent": -20}},
				},
			},
		},
		{
			"id":          "cpc_tune",
			"title":       "出价微调",
			"description": "根据近期表现对关键词 CPC ±10% 微调",
			"plan": map[string]any{
				"validateOnly": true,
				"actions": []map[string]any{
					{"type": "ADJUST_CPC", "filter": map[string]any{"reason": "low_ctr"}, "params": map[string]any{"percent": 10}},
					{"type": "ADJUST_CPC", "filter": map[string]any{"reason": "high_cpa"}, "params": map[string]any{"percent": -10}},
				},
			},
		},
		{
			"id":          "rotate_link_opportunity",
			"title":       "机会域名换链接",
			"description": "将符合条件的机会域名应用到广告最终链接后缀",
			"plan": map[string]any{
				"validateOnly": true,
				"actions": []map[string]any{
					{"type": "ROTATE_LINK", "params": map[string]any{"targetDomain": "example-opportunity.com"}},
				},
			},
		},
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": strategies, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
}

// HandleReportsBasic aggregates last N days execution audits to produce per-action stats
// GET /api/v1/adscenter/reports/basic?days=7
func (h *MiscHandler) HandleReportsBasic(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		apiErr := apierrors.New(apierrors.CodeInvalidRequest, "Method not allowed", nil)
		apiErr.HTTPStatus = http.StatusMethodNotAllowed
		apiErr.WriteJSON(w, r)
		return
	}

	days := 7
	if v := strings.TrimSpace(r.URL.Query().Get("days")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 60 {
			days = n
		}
	}

	// Short cache (Redis preferred) to avoid frequent heavy aggregation
	uid, _ := r.Context().Value(middleware.UserIDKey).(string)
	if uid != "" && h.RC != nil && h.RC.Ready() {
		key := fmt.Sprintf("ac:report:%s:%d", uid, days)
		if txt, ok := h.RC.Get(r.Context(), key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(txt))
			return
		}
	}

	var db *sql.DB
	needClose := false

	if h.DB != nil {
		db = h.DB
	} else {
		dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dbURL == "" {
			apiErr := apierrors.InternalError("DATABASE_URL not set")
			apiErr.WriteJSON(w, r)
			return
		}
		dbInst, err := sql.Open("postgres", dbURL)
		if err != nil {
			apiErr := apierrors.InternalError("db open failed")
			apiErr.Details = map[string]interface{}{"error": err.Error()}
			apiErr.WriteJSON(w, r)
			return
		}
		db = dbInst
		needClose = true
		defer func() {
			if needClose {
				db.Close()
			}
		}()
	}

	// Group by action.type and status from exec audits
	q := `SELECT (snapshot->'action'->>'type') AS type, (snapshot->>'status') AS status, COUNT(1) AS cnt
          FROM "BulkActionAudit"
          WHERE kind='exec' AND created_at >= NOW() - ($1::text||' days')::interval
          GROUP BY type, status`

	rows, err := db.Query(q, strconv.Itoa(days))
	if err != nil {
		apiErr := apierrors.InternalError("query failed")
		apiErr.Details = map[string]interface{}{"error": err.Error()}
		apiErr.WriteJSON(w, r)
		return
	}
	defer rows.Close()

	type pair struct {
		Tot int64
		Err int64
	}

	agg := map[string]*pair{}

	for rows.Next() {
		var typ, st string
		var cnt int64
		if err := rows.Scan(&typ, &st, &cnt); err != nil {
			continue
		}

		if typ == "" {
			typ = "UNKNOWN"
		}

		p := agg[typ]
		if p == nil {
			p = &pair{}
			agg[typ] = p
		}

		if strings.EqualFold(strings.TrimSpace(st), "error") {
			p.Err += cnt
		} else {
			p.Tot += cnt
		}
	}

	// Build response
	type item struct {
		Type      string  `json:"type"`
		Total     int64   `json:"total"`
		Errors    int64   `json:"errors"`
		ErrorRate float64 `json:"errorRate"`
	}

	items := make([]item, 0, len(agg))

	for t, p := range agg {
		tot := p.Tot + p.Err
		rate := 0.0
		if tot > 0 {
			rate = float64(p.Err) / float64(tot)
		}
		items = append(items, item{Type: t, Total: tot, Errors: p.Err, ErrorRate: rate})
	}

	// Sort: errorRate desc then total desc
	sort.Slice(items, func(i, j int) bool {
		if items[i].ErrorRate == items[j].ErrorRate {
			return items[i].Total > items[j].Total
		}
		return items[i].ErrorRate > items[j].ErrorRate
	})

	resp := map[string]any{"days": days, "items": items, "updatedAt": time.Now().UTC().Format(time.RFC3339)}

	// Cache the response body best-effort
	if uid != "" && h.RC != nil && h.RC.Ready() {
		key := fmt.Sprintf("ac:report:%s:%d", uid, days)
		if b, err := json.Marshal(resp); err == nil {
			h.RC.Set(r.Context(), key, string(b), 5*time.Minute) // 5 min cache
		}
	}

	writeJSON(w, http.StatusOK, resp)
}
