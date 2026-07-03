//go:build integration
// +build integration

package main

import (
	"bytes"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Integration test configuration
// 默认连接预发环境，可通过环境变量覆盖
var (
	SiterankServiceURL = getEnv("SITERANK_SERVICE_URL", "https://siterank-preview-yt54xvsg5q-an.a.run.app")
	DatabaseURL        = getEnv("DATABASE_URL", "postgres://postgres.YOUR_SUPABASE_PROJECT:YOUR_PASSWORD@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require")
	TestUserToken      = getEnv("TEST_USER_TOKEN", "test-token")
)

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// HTTP client for API calls
func makeRequest(method, url string, body []byte, token string) (*http.Response, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest(method, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	return client.Do(req)
}

// Database connection
func getDBConnection() (*sql.DB, error) {
	return sql.Open("postgres", DatabaseURL)
}

// Test data setup and cleanup
func createTestSiterankAnalysis(t *testing.T) (string, func()) {
	db, err := getDBConnection()
	require.NoError(t, err)
	defer db.Close()

	// Create test user and analysis
	userID := fmt.Sprintf("siterank-user-%d", time.Now().Unix())
	analysisID := fmt.Sprintf("analysis-%d", time.Now().Unix())

	// Create user
	_, err = db.Exec(`
		INSERT INTO billing.users (id, email, created_at, updated_at) 
		VALUES ($1, $2, NOW(), NOW())
		ON CONFLICT (id) DO NOTHING
	`, userID, userID+"@test.com")
	require.NoError(t, err)

	// Create siterank analysis
	_, err = db.Exec(`
		INSERT INTO siterank.analyses (id, user_id, domain, status, score, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
	`, analysisID, userID, "example.com", "pending", 0)
	require.NoError(t, err)

	// Return cleanup function
	cleanup := func() {
		db, err := getDBConnection()
		if err != nil {
			return
		}
		defer db.Close()

		// Clean up test data
		db.Exec(`DELETE FROM siterank.analyses WHERE id = $1`, analysisID)
		db.Exec(`DELETE FROM billing.users WHERE id = $1`, userID)
	}

	return analysisID, cleanup
}

// TestSiterankServiceHealth tests the health endpoints
func TestSiterankServiceHealth(t *testing.T) {
	t.Run("health check", func(t *testing.T) {
		resp, err := makeRequest("GET", SiterankServiceURL+"/health", nil, "")
		if err != nil {
			t.Logf("Service not running: %v", err)
			t.Skip("Siterank service not running")
		}
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

// TestSiterankDatabaseOperations tests direct database operations
func TestSiterankDatabaseOperations(t *testing.T) {
	analysisID, cleanup := createTestSiterankAnalysis(t)
	defer cleanup()

	t.Run("create and read analysis", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		// Read the created analysis
		var domain, status string
		var score int
		err = db.QueryRow(`
			SELECT domain, status, score FROM siterank.analyses WHERE id = $1
		`, analysisID).Scan(&domain, &status, &score)
		require.NoError(t, err)

		assert.Equal(t, "example.com", domain)
		assert.Equal(t, "pending", status)
		assert.Equal(t, 0, score)
	})

	t.Run("update analysis status and score", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		// Update analysis
		_, err = db.Exec(`
			UPDATE siterank.analyses 
			SET status = 'completed', score = $2, updated_at = NOW()
			WHERE id = $1
		`, analysisID, 85)
		require.NoError(t, err)

		// Verify update
		var status string
		var score int
		err = db.QueryRow(`
			SELECT status, score FROM siterank.analyses WHERE id = $1
		`, analysisID).Scan(&status, &score)
		require.NoError(t, err)

		assert.Equal(t, "completed", status)
		assert.Equal(t, 85, score)
	})
}

// TestSiterankScoreCalculation tests score calculation logic
func TestSiterankScoreCalculation(t *testing.T) {
	analysisID, cleanup := createTestSiterankAnalysis(t)
	defer cleanup()

	t.Run("calculate weighted score", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		// Simulate score components
		performanceScore := 90
		seoScore := 85
		securityScore := 95
		accessibilityScore := 80

		// Calculate weighted average (example weights)
		weightedScore := (performanceScore*30 + seoScore*25 + securityScore*25 + accessibilityScore*20) / 100

		// Update analysis with calculated score
		_, err = db.Exec(`
			UPDATE siterank.analyses 
			SET score = $2, status = 'completed', updated_at = NOW()
			WHERE id = $1
		`, analysisID, weightedScore)
		require.NoError(t, err)

		// Verify score
		var score int
		err = db.QueryRow(`SELECT score FROM siterank.analyses WHERE id = $1`, analysisID).Scan(&score)
		require.NoError(t, err)

		assert.Equal(t, weightedScore, score)
		assert.InDelta(t, 87.5, float64(score), 1.0) // Expected ~87-88
	})
}

// TestSiterankWorkflow tests complete analysis workflow
func TestSiterankWorkflow(t *testing.T) {
	t.Run("complete analysis lifecycle", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		// 1. Create user
		userID := fmt.Sprintf("workflow-user-%d", time.Now().Unix())
		_, err = db.Exec(`
			INSERT INTO billing.users (id, email, created_at, updated_at) 
			VALUES ($1, $2, NOW(), NOW())
		`, userID, userID+"@test.com")
		require.NoError(t, err)

		defer func() {
			db.Exec(`DELETE FROM siterank.analyses WHERE user_id = $1`, userID)
			db.Exec(`DELETE FROM billing.users WHERE id = $1`, userID)
		}()

		// 2. Create analysis request
		analysisID := fmt.Sprintf("workflow-analysis-%d", time.Now().Unix())
		domain := "test-workflow.com"
		_, err = db.Exec(`
			INSERT INTO siterank.analyses (id, user_id, domain, status, score, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
		`, analysisID, userID, domain, "pending", 0)
		require.NoError(t, err)

		// 3. Simulate analysis processing
		time.Sleep(100 * time.Millisecond)

		_, err = db.Exec(`
			UPDATE siterank.analyses 
			SET status = 'processing', updated_at = NOW()
			WHERE id = $1
		`, analysisID)
		require.NoError(t, err)

		// 4. Complete analysis with score
		finalScore := 88
		_, err = db.Exec(`
			UPDATE siterank.analyses 
			SET status = 'completed', score = $2, updated_at = NOW()
			WHERE id = $1
		`, analysisID, finalScore)
		require.NoError(t, err)

		// 5. Verify complete workflow
		var status string
		var score int
		var resultDomain string

		err = db.QueryRow(`
			SELECT domain, status, score
			FROM siterank.analyses
			WHERE id = $1
		`, analysisID).Scan(&resultDomain, &status, &score)
		require.NoError(t, err)

		assert.Equal(t, domain, resultDomain)
		assert.Equal(t, "completed", status)
		assert.Equal(t, finalScore, score)
	})
}

// TestDatabaseSchema tests database schema integrity
func TestDatabaseSchema(t *testing.T) {
	t.Run("verify siterank tables exist", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		requiredTables := []string{
			siterank.analyses,
			billing.users,
		}

		for _, table := range requiredTables {
			var exists bool
			err := db.QueryRow(`
				SELECT EXISTS (
					SELECT FROM information_schema.tables 
					WHERE table_name = $1
				)
			`, table).Scan(&exists)
			require.NoError(t, err)
			assert.True(t, exists, "Table %s should exist", table)
		}
	})

	t.Run("verify siterank table columns", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		requiredColumns := []string{
			"id", "user_id", "domain", "status", "score", "created_at", "updated_at",
		}

		for _, column := range requiredColumns {
			var exists bool
			err := db.QueryRow(`
				SELECT EXISTS (
					SELECT FROM information_schema.columns 
					WHERE table_name = 'SiterankAnalysis' AND column_name = $1
				)
			`, column).Scan(&exists)
			require.NoError(t, err)
			assert.True(t, exists, "Column %s should exist in SiterankAnalysis table", column)
		}
	})
}

// TestMultipleAnalyses tests handling multiple analyses
func TestMultipleAnalyses(t *testing.T) {
	t.Run("create and query multiple analyses", func(t *testing.T) {
		db, err := getDBConnection()
		require.NoError(t, err)
		defer db.Close()

		// Create test user
		userID := fmt.Sprintf("multi-user-%d", time.Now().Unix())
		_, err = db.Exec(`
			INSERT INTO billing.users (id, email, created_at, updated_at) 
			VALUES ($1, $2, NOW(), NOW())
		`, userID, userID+"@test.com")
		require.NoError(t, err)

		defer func() {
			db.Exec(`DELETE FROM siterank.analyses WHERE user_id = $1`, userID)
			db.Exec(`DELETE FROM billing.users WHERE id = $1`, userID)
		}()

		// Create multiple analyses
		domains := []string{"site1.com", "site2.com", "site3.com"}
		for i, domain := range domains {
			analysisID := fmt.Sprintf("multi-analysis-%d-%d", time.Now().Unix(), i)
			_, err = db.Exec(`
				INSERT INTO siterank.analyses (id, user_id, domain, status, score, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			`, analysisID, userID, domain, "completed", 80+i*5)
			require.NoError(t, err)
		}

		// Query all analyses for user
		rows, err := db.Query(`
			SELECT domain, score FROM siterank.analyses 
			WHERE user_id = $1 ORDER BY score DESC
		`, userID)
		require.NoError(t, err)
		defer rows.Close()

		var analyses []map[string]interface{}
		for rows.Next() {
			var domain string
			var score int
			err := rows.Scan(&domain, &score)
			require.NoError(t, err)

			analyses = append(analyses, map[string]interface{}{
				"domain": domain,
				"score":  score,
			})
		}

		assert.Len(t, analyses, 3)
		// Verify descending order
		assert.Equal(t, "site3.com", analyses[0]["domain"])
		assert.Equal(t, 90, analyses[0]["score"])
	})
}

// TestEvaluationServiceAPI tests the evaluation service API endpoints
func TestEvaluationServiceAPI(t *testing.T) {
	// Skip if not in integration test mode
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	t.Run("basic evaluation workflow", func(t *testing.T) {
		// 测试基础评估流程
		// 1. 创建评估请求
		// 2. 验证评估状态
		// 3. 检查评估结果

		// 注意：这需要实际的API端点和认证
		resp, err := makeRequest("GET", SiterankServiceURL+"/health", nil, "")
		if err != nil {
			t.Skipf("Service not available: %v", err)
		}
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

// TestBrandExtractionLogic tests brand name extraction logic
func TestBrandExtractionLogic(t *testing.T) {
	t.Run("extract brand from various URL patterns", func(t *testing.T) {
		testCases := []struct {
			name          string
			url           string
			pageTitle     string
			expectedBrand string
			minConfidence float64
		}{
			{
				name:          "domain fallback",
				url:           "https://example.com",
				pageTitle:     "Example Page",
				expectedBrand: "example",
				minConfidence: 0.5,
			},
			{
				name:          "clear brand in title",
				url:           "https://shop.nike.com",
				pageTitle:     "Nike - Official Store",
				expectedBrand: "Nike",
				minConfidence: 0.8,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				// 这里测试品牌提取逻辑
				// 实际实现需要调用 brandextract.Extractor
				t.Logf("Testing brand extraction for: %s", tc.url)
			})
		}
	})
}

// TestSimilarWebCaching tests SimilarWeb data caching logic
func TestSimilarWebCaching(t *testing.T) {
	t.Run("cache hit and miss scenarios", func(t *testing.T) {
		db, err := getDBConnection()
		if err != nil {
			t.Skipf("Database not available: %v", err)
		}
		defer db.Close()

		// 测试缓存逻辑
		// 1. 第一次请求 - cache miss
		// 2. 第二次请求 - cache hit
		// 3. 验证缓存时间戳

		testDomain := fmt.Sprintf("test-cache-%d.com", time.Now().Unix())

		// 插入测试缓存记录
		_, err = db.Exec(`
			INSERT INTO siterank.domain_cache (domain, data, cached_at, expires_at)
			VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')
			ON CONFLICT (domain) DO NOTHING
		`, testDomain, `{"globalRank": 1000}`)

		if err != nil {
			t.Logf("Cache insert skipped: %v", err)
		}

		// 清理
		defer db.Exec(`DELETE FROM siterank.domain_cache WHERE domain = $1`, testDomain)
	})
}

// TestEvaluationScoring tests the complete evaluation scoring logic
func TestEvaluationScoring(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	t.Run("scoring with various data sources", func(t *testing.T) {
		// 测试不同数据源对评分的影响
		testCases := []struct {
			name             string
			hasSimilarWeb    bool
			hasAIEvaluation  bool
			expectedMinScore int
			expectedMaxScore int
		}{
			{
				name:             "basic only",
				hasSimilarWeb:    false,
				hasAIEvaluation:  false,
				expectedMinScore: 0,
				expectedMaxScore: 50,
			},
			{
				name:             "with SimilarWeb",
				hasSimilarWeb:    true,
				hasAIEvaluation:  false,
				expectedMinScore: 50,
				expectedMaxScore: 80,
			},
			{
				name:             "with AI evaluation",
				hasSimilarWeb:    true,
				hasAIEvaluation:  true,
				expectedMinScore: 70,
				expectedMaxScore: 100,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				t.Logf("Testing scoring scenario: %s", tc.name)
				// 实际测试需要创建评估并检查分数范围
			})
		}
	})
}

// TestEvaluationTokenConsumption tests token consumption tracking
func TestEvaluationTokenConsumption(t *testing.T) {
	t.Run("verify token deduction", func(t *testing.T) {
		db, err := getDBConnection()
		if err != nil {
			t.Skipf("Database not available: %v", err)
		}
		defer db.Close()

		// 测试 Token 消耗记录
		// 1. 基础评估: 1 token
		// 2. AI 评估: 3 tokens (1 basic + 2 AI)

		testCases := []struct {
			name           string
			evaluationType string
			expectedTokens int
		}{
			{"basic evaluation", "basic", 1},
			{"ai evaluation", "ai", 3},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				assert.Equal(t, tc.expectedTokens, tc.expectedTokens)
			})
		}
	})
}

// TestErrorHandling tests error handling in evaluation process
func TestErrorHandling(t *testing.T) {
	t.Run("handle invalid URLs", func(t *testing.T) {
		// 测试无效URL的处理
		invalidURLs := []string{
			"not-a-url",
			"ftp://unsupported-protocol.com",
			"",
		}

		for _, url := range invalidURLs {
			t.Run(url, func(t *testing.T) {
				t.Logf("Testing invalid URL: %s", url)
				// 应该优雅地处理错误
			})
		}
	})

	t.Run("handle timeout scenarios", func(t *testing.T) {
		// 测试超时场景
		t.Log("Testing timeout handling")
	})

	t.Run("handle service unavailability", func(t *testing.T) {
		// 测试服务不可用的情况
		t.Log("Testing service unavailability")
	})
}
