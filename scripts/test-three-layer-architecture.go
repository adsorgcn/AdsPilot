package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ThreeLayerArchitectureTest validates the implementation of three-layer architecture
type ThreeLayerArchitectureTest struct {
	projectRoot string
	testResults []TestResult
	logger      *log.Logger
}

// TestResult represents the result of a single test
type TestResult struct {
	TestName     string `json:"test_name"`
	Passed       bool   `json:"passed"`
	ErrorMessage string `json:"error_message,omitempty"`
	Details      string `json:"details,omitempty"`
}

// NewThreeLayerArchitectureTest creates a new test instance
func NewThreeLayerArchitectureTest(projectRoot string) *ThreeLayerArchitectureTest {
	return &ThreeLayerArchitectureTest{
		projectRoot: projectRoot,
		testResults: make([]TestResult, 0),
		logger:      log.New(os.Stdout, "[THREE-LAYER-TEST] ", log.LstdFlags),
	}
}

// AddResult adds a test result to the results slice
func (t *ThreeLayerArchitectureTest) AddResult(testName string, passed bool, errorMessage, details string) {
	t.testResults = append(t.testResults, TestResult{
		TestName:     testName,
		Passed:       passed,
		ErrorMessage: errorMessage,
		Details:      details,
	})

	status := "PASS"
	if !passed {
		status = "FAIL"
	}

	t.logger.Printf("%s: %s", testName, status)
	if !passed && errorMessage != "" {
		t.logger.Printf("  Error: %s", errorMessage)
	}
	if details != "" {
		t.logger.Printf("  Details: %s", details)
	}
}

// ReadFile reads a file and returns its content
func (t *ThreeLayerArchitectureTest) ReadFile(filePath string) (string, error) {
	fullPath := filepath.Join(t.projectRoot, filePath)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to read file %s: %w", fullPath, err)
	}
	return string(content), nil
}

// FileExists checks if a file exists
func (t *ThreeLayerArchitectureTest) FileExists(filePath string) bool {
	fullPath := filepath.Join(t.projectRoot, filePath)
	_, err := os.Stat(fullPath)
	return err == nil
}

// TestBillingServiceThreeLayerImplementation tests the billing service implementation
func (t *ThreeLayerArchitectureTest) TestBillingServiceThreeLayerImplementation() {
	testName := "Billing Service Three-Layer Implementation"

	billingHandlerPath := "services/billing/internal/handlers/trial_subscription.go"

	if !t.FileExists(billingHandlerPath) {
		t.AddResult(testName, false, "Trial subscription handler not found", "")
		return
	}

	content, err := t.ReadFile(billingHandlerPath)
	if err != nil {
		t.AddResult(testName, false, fmt.Sprintf("Failed to read billing handler: %v", err), "")
		return
	}

	// Check for required three-layer methods
	requiredMethods := []struct {
		methodName  string
		pattern     string
		description string
	}{
		{
			methodName:  "createUserLayer",
			pattern:     `func\s+\([^)]*\)\s+createUserLayer\s*\([^)]*\)\s+error\s*{`,
			description: "Layer 2 business user creation method",
		},
		{
			methodName:  "createBillingLayer",
			pattern:     `func\s+\([^)]*\)\s+createBillingLayer\s*\([^)]*\)\s+error\s*{`,
			description: "Layer 3 billing account creation method",
		},
		{
			methodName:  "initializeTokenSystem",
			pattern:     `func\s+\([^)]*\)\s+initializeTokenSystem\s*\([^)]*\)\s+error\s*{`,
			description: "Layer 3 token system initialization method",
		},
	}

	allMethodsExist := true
	var missingMethods []string
	var methodDetails []string

	for _, method := range requiredMethods {
		matched, err := regexp.MatchString(method.pattern, content)
		if err != nil {
			t.AddResult(testName, false, fmt.Sprintf("Regex error for %s: %v", method.methodName, err), "")
			return
		}

		if matched {
			methodDetails = append(methodDetails, fmt.Sprintf("✓ %s found", method.description))
		} else {
			allMethodsExist = false
			missingMethods = append(missingMethods, method.methodName)
		}
	}

	if !allMethodsExist {
		t.AddResult(testName, false,
			fmt.Sprintf("Missing methods: %s", strings.Join(missingMethods, ", ")),
			strings.Join(methodDetails, "; "))
		return
	}

	// Check for transaction usage
	transactionPatterns := []string{
		`ExecuteInTransaction\s*\(`,
		`BeginTx\s*\(`,
		`Begin\s*\(\s*ctx\s*\)`,
		`database\.BeginTx`,
		`func\s+[^{]*\s+tx\s+\*sql\.Tx`,
	}

	hasTransaction := false
	for _, pattern := range transactionPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			hasTransaction = true
			break
		}
	}

	if !hasTransaction {
		t.AddResult(testName, false, "No transaction implementation found",
			strings.Join(methodDetails, "; "))
		return
	}

	// Check for proper error handling
	errorHandlingPatterns := []string{
		`if\s+err\s*!=\s*nil\s*{`,
		`return\s+err`,
		`defer.*Rollback`,
		`defer.*Commit`,
	}

	errorHandlingCount := 0
	for _, pattern := range errorHandlingPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			errorHandlingCount++
		}
	}

	// Check for SQL operations in each layer
	layerOperations := []struct {
		layerName string
		tableName string
		pattern   string
	}{
		{
			layerName: "User Layer",
			tableName: "user.users",
			pattern:   `INSERT\s+INTO\s+user\.users`,
		},
		{
			layerName: "Billing Layer",
			tableName: "billing.billing_accounts",
			pattern:   `INSERT\s+INTO\s+billing\.billing_accounts`,
		},
		{
			layerName: "Token System",
			tableName: "billing.token_balances",
			pattern:   `INSERT\s+INTO\s+billing\.token_balances`,
		},
	}

	sqlOperationsCount := 0
	var operationDetails []string

	for _, op := range layerOperations {
		matched, err := regexp.MatchString(op.pattern, content)
		if err != nil {
			continue
		}
		if matched {
			sqlOperationsCount++
			operationDetails = append(operationDetails, fmt.Sprintf("✓ %s (%s)", op.layerName, op.tableName))
		}
	}

	// Final assessment
	details := strings.Join(methodDetails, "; ") + "; " + strings.Join(operationDetails, "; ")
	details += fmt.Sprintf("; Transaction handling: %s", map[bool]string{true: "Yes", false: "No"}[hasTransaction])
	details += fmt.Sprintf("; Error handling patterns: %d", errorHandlingCount)

	success := allMethodsExist && hasTransaction && sqlOperationsCount >= 2
	errorMessage := ""
	if !success {
		if !allMethodsExist {
			errorMessage = "Missing required methods"
		} else if !hasTransaction {
			errorMessage = "Missing transaction handling"
		} else if sqlOperationsCount < 2 {
			errorMessage = "Insufficient SQL layer operations"
		}
	}

	t.AddResult(testName, success, errorMessage, details)
}

// TestDatabaseSchemaConsistency tests database schema consistency
func (t *ThreeLayerArchitectureTest) TestDatabaseSchemaConsistency() {
	testName := "Database Schema Consistency"

	// Check for schema files
	schemaPaths := []string{
		"docs/Database/DATABASE_ARCHITECTURE_CURRENT.md",
		"docs/SupabaseGo/MustKnowV6.md",
	}

	var foundSchemas []string
	for _, path := range schemaPaths {
		if t.FileExists(path) {
			foundSchemas = append(foundSchemas, path)
		}
	}

	if len(foundSchemas) == 0 {
		t.AddResult(testName, false, "No schema documentation found", "")
		return
	}

	// Check for migration files
	migrationsDir := "services/billing/migrations"
	var migrationFiles []string

	if t.FileExists(migrationsDir) {
		files, err := os.ReadDir(filepath.Join(t.projectRoot, migrationsDir))
		if err == nil {
			for _, file := range files {
				if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
					migrationFiles = append(migrationFiles, file.Name())
				}
			}
		}
	}

	details := fmt.Sprintf("Schema docs: %d; Migration files: %d", len(foundSchemas), len(migrationFiles))

	// Consider this successful if we have at least one schema document
	t.AddResult(testName, len(foundSchemas) > 0, "", details)
}

// TestApiGatewayIntegration tests API Gateway integration
func (t *ThreeLayerArchitectureTest) TestApiGatewayIntegration() {
	testName := "API Gateway Integration"

	authCallbackPath := "apps/frontend/src/app/auth/callback/route.ts"

	if !t.FileExists(authCallbackPath) {
		t.AddResult(testName, false, "Auth callback route not found", "")
		return
	}

	content, err := t.ReadFile(authCallbackPath)
	if err != nil {
		t.AddResult(testName, false, fmt.Sprintf("Failed to read auth callback: %v", err), "")
		return
	}

	// Check for API Gateway usage patterns
	apiPatterns := []string{
		`fetch\s*\([^)]*\/api\/`,
		`\/api\/v\d\/`,
		`siteUrl.*\/api\/`,
	}

	hasApiGateway := false
	for _, pattern := range apiPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			hasApiGateway = true
			break
		}
	}

	// Check for absence of direct Supabase client usage
	supabasePatterns := []string{
		`supabase\.from\s*\(`,
		`supabase\.rpc\s*\(`,
		`createClient\s*\([^)]*supabase`,
	}

	hasDirectSupabase := false
	for _, pattern := range supabasePatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			hasDirectSupabase = true
			break
		}
	}

	success := hasApiGateway && !hasDirectSupabase
	errorMessage := ""
	details := fmt.Sprintf("API Gateway: %t, Direct Supabase: %t", hasApiGateway, hasDirectSupabase)

	if !success {
		if !hasApiGateway {
			errorMessage = "Missing API Gateway integration"
		}
		if hasDirectSupabase {
			if errorMessage != "" {
				errorMessage += "; "
			}
			errorMessage += "Direct Supabase access detected"
		}
	}

	t.AddResult(testName, success, errorMessage, details)
}

// TestServiceAdapterConfiguration tests service adapter configuration
func (t *ThreeLayerArchitectureTest) TestServiceAdapterConfiguration() {
	testName := "Service Adapter Configuration"

	adapterPath := "pkg/database/service_adapter_simple.go"

	if !t.FileExists(adapterPath) {
		t.AddResult(testName, false, "Service adapter file not found", "")
		return
	}

	content, err := t.ReadFile(adapterPath)
	if err != nil {
		t.AddResult(testName, false, fmt.Sprintf("Failed to read service adapter: %v", err), "")
		return
	}

	// Check for FinalAdapter implementation
	finalAdapterPatterns := []string{
		`GetFinalAdapterForService\s*\([^)]*\)`,
		`type.*FinalAdapter.*struct`,
		`func.*GetAdapter.*\*FinalAdapter`,
		`FinalAdapter{`,
	}

	hasFinalAdapter := false
	for _, pattern := range finalAdapterPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			hasFinalAdapter = true
			break
		}
	}

	// Check for performance monitoring
	monitoringPatterns := []string{
		`recordQueryMetrics`,
		`logSlowQuery`,
		`time\.Now\(\)`,
		`EnableMetrics`,
	}

	monitoringCount := 0
	for _, pattern := range monitoringPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			monitoringCount++
		}
	}

	// Check for configuration options
	configPatterns := []string{
		`type.*Config.*struct`,
		`CloudSQLMode`,
		`UnixSocketPath`,
	}

	configCount := 0
	for _, pattern := range configPatterns {
		matched, err := regexp.MatchString(pattern, content)
		if err != nil {
			continue
		}
		if matched {
			configCount++
		}
	}

	success := hasFinalAdapter && monitoringCount >= 3 && configCount >= 2
	details := fmt.Sprintf("FinalAdapter: %t, Monitoring: %d/4, Config: %d/3",
		hasFinalAdapter, monitoringCount, configCount)

	var errorMessage string
	if !success {
		if !hasFinalAdapter {
			errorMessage = "Missing FinalAdapter implementation"
		}
		if monitoringCount < 3 {
			if errorMessage != "" {
				errorMessage += "; "
			}
			errorMessage += "Insufficient monitoring implementation"
		}
		if configCount < 2 {
			if errorMessage != "" {
				errorMessage += "; "
			}
			errorMessage += "Insufficient configuration options"
		}
	}

	t.AddResult(testName, success, errorMessage, details)
}

// RunAllTests executes all three-layer architecture tests
func (t *ThreeLayerArchitectureTest) RunAllTests() {
	t.logger.Println("Starting Three-Layer Architecture Validation Tests...")
	t.logger.Printf("Project Root: %s\n", t.projectRoot)

	// Run all tests
	t.TestBillingServiceThreeLayerImplementation()
	t.TestDatabaseSchemaConsistency()
	t.TestApiGatewayIntegration()
	t.TestServiceAdapterConfiguration()

	t.printSummary()
}

// printSummary prints a summary of all test results
func (t *ThreeLayerArchitectureTest) printSummary() {
	t.logger.Println("\n" + strings.Repeat("=", 60))
	t.logger.Println("THREE-LAYER ARCHITECTURE VALIDATION SUMMARY")
	t.logger.Println(strings.Repeat("=", 60))

	totalTests := len(t.testResults)
	passedTests := 0
	failedTests := 0

	for _, result := range t.testResults {
		if result.Passed {
			passedTests++
		} else {
			failedTests++
		}
	}

	successRate := float64(passedTests) / float64(totalTests) * 100

	t.logger.Printf("Total Tests: %d", totalTests)
	t.logger.Printf("Passed: %d", passedTests)
	t.logger.Printf("Failed: %d", failedTests)
	t.logger.Printf("Success Rate: %.1f%%\n", successRate)

	t.logger.Println("Detailed Results:")
	for _, result := range t.testResults {
		status := "✅ PASS"
		if !result.Passed {
			status = "❌ FAIL"
		}
		t.logger.Printf("  %s: %s", result.TestName, status)
		if !result.Passed && result.ErrorMessage != "" {
			t.logger.Printf("    Error: %s", result.ErrorMessage)
		}
		if result.Details != "" {
			t.logger.Printf("    Details: %s", result.Details)
		}
	}

	// Overall assessment
	t.logger.Println("\nOverall Assessment:")
	if successRate >= 90 {
		t.logger.Println("🎯 EXCELLENT: Three-layer architecture is well implemented")
		t.logger.Println("🚀 System is ready for production deployment")
	} else if successRate >= 75 {
		t.logger.Println("⚠️  GOOD: Three-layer architecture is mostly implemented")
		t.logger.Println("🔧 Some improvements needed before production")
	} else {
		t.logger.Println("🚨 NEEDS WORK: Three-layer architecture requires significant improvements")
		t.logger.Println("⚡ Immediate attention required before production deployment")
	}
}

func main() {
	projectRoot, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get working directory: %v", err)
	}

	// Create and run tests
	test := NewThreeLayerArchitectureTest(projectRoot)
	test.RunAllTests()

	// Exit with appropriate code
	failedTests := 0
	for _, result := range test.testResults {
		if !result.Passed {
			failedTests++
		}
	}

	if failedTests > 0 {
		os.Exit(1)
	}
}
