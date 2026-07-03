package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// UserGrowthData represents user growth analytics
type UserGrowthData struct {
	Period        string      `json:"period"` // daily, weekly, monthly
	DataPoints    []DataPoint `json:"dataPoints"`
	TotalUsers    int         `json:"totalUsers"`
	NewUsersToday int         `json:"newUsersToday"`
	NewUsersWeek  int         `json:"newUsersWeek"`
	NewUsersMonth int         `json:"newUsersMonth"`
}

// TokenConsumptionData represents token consumption analytics
type TokenConsumptionData struct {
	Period        string        `json:"period"`
	DataPoints    []DataPoint   `json:"dataPoints"`
	TotalConsumed int64         `json:"totalConsumed"`
	ConsumedToday int64         `json:"consumedToday"`
	ConsumedWeek  int64         `json:"consumedWeek"`
	ConsumedMonth int64         `json:"consumedMonth"`
	TopConsumers  []TopConsumer `json:"topConsumers"`
}

// RevenueData represents revenue analytics
type RevenueData struct {
	Period            string      `json:"period"`
	DataPoints        []DataPoint `json:"dataPoints"`
	TotalRevenue      float64     `json:"totalRevenue"`
	RevenueToday      float64     `json:"revenueToday"`
	RevenueWeek       float64     `json:"revenueWeek"`
	RevenueMonth      float64     `json:"revenueMonth"`
	ActiveSubscribers int         `json:"activeSubscribers"`
	MRR               float64     `json:"mrr"` // Monthly Recurring Revenue
}

// ActivityData represents user activity analytics
type ActivityData struct {
	Period           string      `json:"period"`
	DataPoints       []DataPoint `json:"dataPoints"`
	DAU              int         `json:"dau"` // Daily Active Users
	WAU              int         `json:"wau"` // Weekly Active Users
	MAU              int         `json:"mau"` // Monthly Active Users
	TotalEvaluations int64       `json:"totalEvaluations"`
	TotalOffers      int64       `json:"totalOffers"`
}

// DataPoint represents a time series data point
type DataPoint struct {
	Date  string  `json:"date"`
	Value float64 `json:"value"`
	Label string  `json:"label,omitempty"`
}

// TopConsumer represents a top token consumer
type TopConsumer struct {
	UserID    string `json:"userId"`
	UserEmail string `json:"userEmail,omitempty"`
	UserName  string `json:"userName,omitempty"`
	Consumed  int64  `json:"consumed"`
	PlanName  string `json:"planName,omitempty"`
}

// getUserGrowthAnalytics handles GET /api/v1/console/analytics/users
// BE-083: 实现用户增长数据
func (h *Handler) getUserGrowthAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	query := r.URL.Query()
	period := query.Get("period") // daily, weekly, monthly
	if period == "" {
		period = "daily"
	}

	days := 30
	if daysParam := query.Get("days"); daysParam != "" {
		if d, err := strconv.Atoi(daysParam); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	// Get total users
	var totalUsers int
	err := h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "User"`).Scan(&totalUsers)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count users: %v", err), http.StatusInternalServerError)
		return
	}

	// Get new users today
	var newUsersToday int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "User"
		WHERE DATE("createdAt") = CURRENT_DATE
	`).Scan(&newUsersToday)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count new users today: %v", err), http.StatusInternalServerError)
		return
	}

	// Get new users this week
	var newUsersWeek int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "User"
		WHERE "createdAt" >= DATE_TRUNC('week', NOW())
	`).Scan(&newUsersWeek)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count new users this week: %v", err), http.StatusInternalServerError)
		return
	}

	// Get new users this month
	var newUsersMonth int
	err = h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "User"
		WHERE "createdAt" >= DATE_TRUNC('month', NOW())
	`).Scan(&newUsersMonth)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count new users this month: %v", err), http.StatusInternalServerError)
		return
	}

	// Get time series data
	var dataPoints []DataPoint
	var timeSeriesQuery string

	switch period {
	case "daily":
		timeSeriesQuery = `
			SELECT
				DATE("createdAt") as date,
				COUNT(*) as count
			FROM "User"
			WHERE "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE("createdAt")
			ORDER BY date DESC
		`
	case "weekly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('week', "createdAt")::date as date,
				COUNT(*) as count
			FROM "User"
			WHERE "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('week', "createdAt")
			ORDER BY date DESC
		`
	case "monthly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('month', "createdAt")::date as date,
				COUNT(*) as count
			FROM "User"
			WHERE "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('month', "createdAt")
			ORDER BY date DESC
		`
	default:
		timeSeriesQuery = `
			SELECT
				DATE("createdAt") as date,
				COUNT(*) as count
			FROM "User"
			WHERE "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE("createdAt")
			ORDER BY date DESC
		`
	}

	timeSeriesQuery = fmt.Sprintf(timeSeriesQuery, days)

	rows, err := h.DB.Query(ctx, timeSeriesQuery)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query time series: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var date time.Time
		var count float64
		if err := rows.Scan(&date, &count); err != nil {
			continue
		}
		dataPoints = append(dataPoints, DataPoint{
			Date:  date.Format("2006-01-02"),
			Value: count,
		})
	}

	response := UserGrowthData{
		Period:        period,
		DataPoints:    dataPoints,
		TotalUsers:    totalUsers,
		NewUsersToday: newUsersToday,
		NewUsersWeek:  newUsersWeek,
		NewUsersMonth: newUsersMonth,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getTokenConsumptionAnalytics handles GET /api/v1/console/analytics/tokens
// BE-084: 实现Token消耗数据
func (h *Handler) getTokenConsumptionAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	query := r.URL.Query()
	period := query.Get("period")
	if period == "" {
		period = "daily"
	}

	days := 30
	if daysParam := query.Get("days"); daysParam != "" {
		if d, err := strconv.Atoi(daysParam); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	// Get total consumed tokens (all time)
	var totalConsumed int64
	err := h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(amount)), 0)
		FROM "TokenTransaction"
		WHERE type = 'consume' AND amount < 0
	`).Scan(&totalConsumed)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to calculate total consumption: %v", err), http.StatusInternalServerError)
		return
	}

	// Get consumed today
	var consumedToday int64
	err = h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(amount)), 0)
		FROM "TokenTransaction"
		WHERE type = 'consume' AND amount < 0
		  AND DATE("createdAt") = CURRENT_DATE
	`).Scan(&consumedToday)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to calculate today's consumption: %v", err), http.StatusInternalServerError)
		return
	}

	// Get consumed this week
	var consumedWeek int64
	err = h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(amount)), 0)
		FROM "TokenTransaction"
		WHERE type = 'consume' AND amount < 0
		  AND "createdAt" >= DATE_TRUNC('week', NOW())
	`).Scan(&consumedWeek)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to calculate week's consumption: %v", err), http.StatusInternalServerError)
		return
	}

	// Get consumed this month
	var consumedMonth int64
	err = h.DB.QueryRow(ctx, `
		SELECT COALESCE(SUM(ABS(amount)), 0)
		FROM "TokenTransaction"
		WHERE type = 'consume' AND amount < 0
		  AND "createdAt" >= DATE_TRUNC('month', NOW())
	`).Scan(&consumedMonth)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to calculate month's consumption: %v", err), http.StatusInternalServerError)
		return
	}

	// Get time series data
	var dataPoints []DataPoint
	var timeSeriesQuery string

	switch period {
	case "daily":
		timeSeriesQuery = `
			SELECT
				DATE("createdAt") as date,
				COALESCE(SUM(ABS(amount)), 0) as consumed
			FROM "TokenTransaction"
			WHERE type = 'consume' AND amount < 0
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE("createdAt")
			ORDER BY date DESC
		`
	case "weekly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('week', "createdAt")::date as date,
				COALESCE(SUM(ABS(amount)), 0) as consumed
			FROM "TokenTransaction"
			WHERE type = 'consume' AND amount < 0
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('week', "createdAt")
			ORDER BY date DESC
		`
	case "monthly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('month', "createdAt")::date as date,
				COALESCE(SUM(ABS(amount)), 0) as consumed
			FROM "TokenTransaction"
			WHERE type = 'consume' AND amount < 0
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('month', "createdAt")
			ORDER BY date DESC
		`
	default:
		timeSeriesQuery = `
			SELECT
				DATE("createdAt") as date,
				COALESCE(SUM(ABS(amount)), 0) as consumed
			FROM "TokenTransaction"
			WHERE type = 'consume' AND amount < 0
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE("createdAt")
			ORDER BY date DESC
		`
	}

	timeSeriesQuery = fmt.Sprintf(timeSeriesQuery, days)

	rows, err := h.DB.Query(ctx, timeSeriesQuery)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to query time series: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var date time.Time
		var consumed int64
		if err := rows.Scan(&date, &consumed); err != nil {
			continue
		}
		dataPoints = append(dataPoints, DataPoint{
			Date:  date.Format("2006-01-02"),
			Value: float64(consumed),
		})
	}

	// Get top 10 consumers
	topConsumers := []TopConsumer{}
	topQuery := `
		SELECT
			t."userId",
			u.email,
			u.name,
			COALESCE(SUM(ABS(t.amount)), 0) as consumed,
			s."planName"
		FROM "TokenTransaction" t
		LEFT JOIN "User" u ON t."userId" = u.id
		LEFT JOIN "Subscription" s ON t."userId" = s."userId"
		WHERE t.type = 'consume' AND t.amount < 0
		  AND t."createdAt" >= NOW() - INTERVAL '%d days'
		GROUP BY t."userId", u.email, u.name, s."planName"
		ORDER BY consumed DESC
		LIMIT 10
	`

	topQuery = fmt.Sprintf(topQuery, days)
	topRows, err := h.DB.Query(ctx, topQuery)
	if err == nil {
		defer topRows.Close()
		for topRows.Next() {
			var tc TopConsumer
			topRows.Scan(&tc.UserID, &tc.UserEmail, &tc.UserName, &tc.Consumed, &tc.PlanName)
			topConsumers = append(topConsumers, tc)
		}
	}

	response := TokenConsumptionData{
		Period:        period,
		DataPoints:    dataPoints,
		TotalConsumed: totalConsumed,
		ConsumedToday: consumedToday,
		ConsumedWeek:  consumedWeek,
		ConsumedMonth: consumedMonth,
		TopConsumers:  topConsumers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getRevenueAnalytics handles GET /api/v1/console/analytics/revenue
// BE-085: 实现收入统计数据
func (h *Handler) getRevenueAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	query := r.URL.Query()
	period := query.Get("period")
	if period == "" {
		period = "monthly"
	}

	days := 90
	if daysParam := query.Get("days"); daysParam != "" {
		if d, err := strconv.Atoi(daysParam); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	// Count active subscribers
	var activeSubscribers int
	err := h.DB.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM "Subscription"
		WHERE status = 'active'
		  AND ("currentPeriodEnd" IS NULL OR "currentPeriodEnd" > NOW())
	`).Scan(&activeSubscribers)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to count active subscribers: %v", err), http.StatusInternalServerError)
		return
	}

	// Calculate MRR (Monthly Recurring Revenue)
	// Assuming plan prices: Starter=0, Pro=$29, Elite=$99
	planPrices := map[string]float64{
		"starter": 0,
		"pro":     29,
		"elite":   99,
	}

	var mrr float64
	mrrQuery := `
		SELECT "planName", COUNT(*) as count
		FROM "Subscription"
		WHERE status = 'active'
		  AND ("currentPeriodEnd" IS NULL OR "currentPeriodEnd" > NOW())
		GROUP BY "planName"
	`

	rows, err := h.DB.Query(ctx, mrrQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var planName string
			var count int
			if err := rows.Scan(&planName, &count); err == nil {
				if price, ok := planPrices[planName]; ok {
					mrr += price * float64(count)
				}
			}
		}
	}

	// For revenue data points, we'll use subscription creation dates as proxy
	// In production, you'd integrate with Stripe API or payment processor
	var dataPoints []DataPoint
	var timeSeriesQuery string

	switch period {
	case "daily":
		timeSeriesQuery = `
			SELECT
				DATE("createdAt") as date,
				COUNT(*) as count
			FROM "Subscription"
			WHERE status = 'active'
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE("createdAt")
			ORDER BY date DESC
		`
	case "weekly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('week', "createdAt")::date as date,
				COUNT(*) as count
			FROM "Subscription"
			WHERE status = 'active'
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('week', "createdAt")
			ORDER BY date DESC
		`
	case "monthly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('month', "createdAt")::date as date,
				COUNT(*) as count
			FROM "Subscription"
			WHERE status = 'active'
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('month', "createdAt")
			ORDER BY date DESC
		`
	default:
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('month', "createdAt")::date as date,
				COUNT(*) as count
			FROM "Subscription"
			WHERE status = 'active'
			  AND "createdAt" >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('month', "createdAt")
			ORDER BY date DESC
		`
	}

	timeSeriesQuery = fmt.Sprintf(timeSeriesQuery, days)

	tsRows, err := h.DB.Query(ctx, timeSeriesQuery)
	if err == nil {
		defer tsRows.Close()
		for tsRows.Next() {
			var date time.Time
			var count float64
			if err := tsRows.Scan(&date, &count); err == nil {
				dataPoints = append(dataPoints, DataPoint{
					Date:  date.Format("2006-01-02"),
					Value: count,
					Label: "New Subscriptions",
				})
			}
		}
	}

	response := RevenueData{
		Period:            period,
		DataPoints:        dataPoints,
		TotalRevenue:      mrr * 12, // Estimated ARR
		RevenueToday:      0,        // Would need payment processor integration
		RevenueWeek:       0,
		RevenueMonth:      mrr,
		ActiveSubscribers: activeSubscribers,
		MRR:               mrr,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// getActivityAnalytics handles GET /api/v1/console/analytics/activity
// BE-086: 实现活跃度数据
func (h *Handler) getActivityAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse query parameters
	query := r.URL.Query()
	period := query.Get("period")
	if period == "" {
		period = "daily"
	}

	days := 30
	if daysParam := query.Get("days"); daysParam != "" {
		if d, err := strconv.Atoi(daysParam); err == nil && d > 0 && d <= 365 {
			days = d
		}
	}

	// Calculate DAU (Daily Active Users) - users who had any activity today
	// Activity = created offers, performed evaluations, checked in, etc.
	var dau int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM (
			SELECT "userId" as user_id FROM "Offer" WHERE DATE("createdAt") = CURRENT_DATE
			UNION
			SELECT user_id FROM checkins WHERE DATE(checked_in_at) = CURRENT_DATE
		) active_users
	`).Scan(&dau)

	// Calculate WAU (Weekly Active Users)
	var wau int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM (
			SELECT "userId" as user_id FROM "Offer" WHERE "createdAt" >= DATE_TRUNC('week', NOW())
			UNION
			SELECT user_id FROM checkins WHERE checked_in_at >= DATE_TRUNC('week', NOW())
		) active_users
	`).Scan(&wau)

	// Calculate MAU (Monthly Active Users)
	var mau int
	h.DB.QueryRow(ctx, `
		SELECT COUNT(DISTINCT user_id) FROM (
			SELECT "userId" as user_id FROM "Offer" WHERE "createdAt" >= DATE_TRUNC('month', NOW())
			UNION
			SELECT user_id FROM checkins WHERE checked_in_at >= DATE_TRUNC('month', NOW())
		) active_users
	`).Scan(&mau)

	// Get total offers
	var totalOffers int64
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM "Offer"`).Scan(&totalOffers)

	// Get total evaluations (from siterank service schema)
	var totalEvaluations int64
	h.DB.QueryRow(ctx, `SELECT COUNT(*) FROM offer_evaluations`).Scan(&totalEvaluations)

	// Get time series activity data
	var dataPoints []DataPoint
	var timeSeriesQuery string

	switch period {
	case "daily":
		timeSeriesQuery = `
			SELECT
				DATE(date) as date,
				COUNT(DISTINCT user_id) as active_users
			FROM (
				SELECT "createdAt" as date, "userId" as user_id FROM "Offer"
				UNION ALL
				SELECT checked_in_at as date, user_id FROM checkins
			) activities
			WHERE date >= NOW() - INTERVAL '%d days'
			GROUP BY DATE(date)
			ORDER BY date DESC
		`
	case "weekly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('week', date)::date as date,
				COUNT(DISTINCT user_id) as active_users
			FROM (
				SELECT "createdAt" as date, "userId" as user_id FROM "Offer"
				UNION ALL
				SELECT checked_in_at as date, user_id FROM checkins
			) activities
			WHERE date >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('week', date)
			ORDER BY date DESC
		`
	case "monthly":
		timeSeriesQuery = `
			SELECT
				DATE_TRUNC('month', date)::date as date,
				COUNT(DISTINCT user_id) as active_users
			FROM (
				SELECT "createdAt" as date, "userId" as user_id FROM "Offer"
				UNION ALL
				SELECT checked_in_at as date, user_id FROM checkins
			) activities
			WHERE date >= NOW() - INTERVAL '%d days'
			GROUP BY DATE_TRUNC('month', date)
			ORDER BY date DESC
		`
	default:
		timeSeriesQuery = `
			SELECT
				DATE(date) as date,
				COUNT(DISTINCT user_id) as active_users
			FROM (
				SELECT "createdAt" as date, "userId" as user_id FROM "Offer"
				UNION ALL
				SELECT checked_in_at as date, user_id FROM checkins
			) activities
			WHERE date >= NOW() - INTERVAL '%d days'
			GROUP BY DATE(date)
			ORDER BY date DESC
		`
	}

	timeSeriesQuery = fmt.Sprintf(timeSeriesQuery, days)

	rows, err := h.DB.Query(ctx, timeSeriesQuery)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var date time.Time
			var activeUsers float64
			if err := rows.Scan(&date, &activeUsers); err == nil {
				dataPoints = append(dataPoints, DataPoint{
					Date:  date.Format("2006-01-02"),
					Value: activeUsers,
					Label: "Active Users",
				})
			}
		}
	}

	response := ActivityData{
		Period:           period,
		DataPoints:       dataPoints,
		DAU:              dau,
		WAU:              wau,
		MAU:              mau,
		TotalEvaluations: totalEvaluations,
		TotalOffers:      totalOffers,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
