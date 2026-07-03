package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/ScientificInternet/Google-Monetize/tools/dbctl/commands"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type Config struct {
	AdminURL string `mapstructure:"admin_url"`
	Token    string `mapstructure:"token"`
}

type ApiResponse struct {
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Success bool        `json:"success,omitempty"`
}

var (
	config  Config
	rootCmd = &cobra.Command{
		Use:   "dbctl",
		Short: "Database management CLI tool",
		Long:  `dbctl is a CLI tool for managing Google-Monetize databases through the db-admin service`,
	}
)

func init() {
	cobra.OnInitialize(initConfig)

	// 全局flags
	rootCmd.PersistentFlags().String("admin-url", "", "db-admin service URL")
	rootCmd.PersistentFlags().String("token", "", "Authentication token")
	viper.BindPFlag("admin_url", rootCmd.PersistentFlags().Lookup("admin-url"))
	viper.BindPFlag("token", rootCmd.PersistentFlags().Lookup("token"))

	// 子命令
	connectCmd := &cobra.Command{
		Use:   "connect [service]",
		Short: "Connect to a service database",
		Args:  cobra.ExactArgs(1),
		Run:   connectService,
	}

	statusCmd := &cobra.Command{
		Use:   "status",
		Short: "Check status of all databases",
		Run:   checkStatus,
	}

	schemaCmd := &cobra.Command{
		Use:   "schema [service]",
		Short: "Get database schema for a service",
		Args:  cobra.ExactArgs(1),
		Run:   getSchema,
	}

	sqlCmd := &cobra.Command{
		Use:   "sql [service] [query]",
		Short: "Execute SQL query",
		Args:  cobra.ExactArgs(2),
		Run:   executeSQL,
	}

	scriptCmd := &cobra.Command{
		Use:   "script [service] [file]",
		Short: "Execute SQL script from file",
		Args:  cobra.ExactArgs(2),
		Run:   executeScript,
	}

	migrateCmd := &cobra.Command{
		Use:   "migrate [service]",
		Short: "Apply migrations for a service",
		Args:  cobra.ExactArgs(1),
		Run:   migrateService,
	}

	backupCmd := &cobra.Command{
		Use:   "backup [service]",
		Short: "Create backup for a service",
		Args:  cobra.ExactArgs(1),
		Run:   backupService,
	}

	validateCmd := &cobra.Command{
		Use:   "validate [service]",
		Short: "Validate schema for a service",
		Args:  cobra.ExactArgs(1),
		Run:   validateService,
	}

	deployCmd := &cobra.Command{
		Use:   "deploy-schemas",
		Short: "Deploy all schema changes",
		Run:   deploySchemas,
	}

	restoreCmd := &cobra.Command{
		Use:   "restore [service] [backup_id]",
		Short: "Restore database from backup",
		Args:  cobra.ExactArgs(2),
		Run:   restoreService,
	}

	logsCmd := &cobra.Command{
		Use:   "logs",
		Short: "Show audit logs",
		Run:   showAuditLogs,
	}

	historyCmd := &cobra.Command{
		Use:   "history [service]",
		Short: "Show migration history",
		Args:  cobra.ExactArgs(1),
		Run:   showMigrationHistory,
	}

	// 添加 DDL 命令
	rootCmd.AddCommand(commands.DDLCommand)

	// 添加子命令到根命令
	rootCmd.AddCommand(connectCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(schemaCmd)
	rootCmd.AddCommand(sqlCmd)
	rootCmd.AddCommand(scriptCmd)
	rootCmd.AddCommand(migrateCmd)
	rootCmd.AddCommand(backupCmd)
	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(deployCmd)
	rootCmd.AddCommand(restoreCmd)
	rootCmd.AddCommand(logsCmd)
	rootCmd.AddCommand(historyCmd)
}

func initConfig() {
	// 设置配置文件名称和路径
	viper.SetConfigName(".dbctl")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("$HOME")
	viper.AddConfigPath(".")

	// 环境变量
	viper.SetEnvPrefix("DBCTL")
	viper.AutomaticEnv()

	// 读取配置文件
	if err := viper.ReadInConfig(); err == nil {
		log.Printf("Using config file: %s", viper.ConfigFileUsed())
	}

	// 解析配置
	if err := viper.Unmarshal(&config); err != nil {
		log.Fatalf("Failed to unmarshal config: %v", err)
	}

	// 默认值
	if config.AdminURL == "" {
		config.AdminURL = "http://localhost:8080"
	}

	// 检查必要的环境变量
	if os.Getenv("DB_ADMIN_URL") != "" {
		config.AdminURL = os.Getenv("DB_ADMIN_URL")
	}
	if os.Getenv("DB_ADMIN_TOKEN") != "" {
		config.Token = os.Getenv("DB_ADMIN_TOKEN")
	}
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func makeRequest(method, endpoint string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %v", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequest(method, config.AdminURL+endpoint, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if config.Token != "" {
		req.Header.Set("Authorization", config.Token)
	}

	client := &http.Client{}
	return client.Do(req)
}

func printJSON(data interface{}) {
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling JSON: %v\n", err)
		return
	}
	fmt.Println(string(jsonData))
}

func connectService(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("🔗 Connecting to %s database...\n", service)

	resp, err := makeRequest("GET", fmt.Sprintf("/api/v1/databases/%s/status", service), nil)
	if err != nil {
		log.Fatalf("Failed to connect to %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to connect to %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	fmt.Printf("✅ Connected to %s\n", service)
	printJSON(result)
}

func checkStatus(cmd *cobra.Command, args []string) {
	fmt.Println("📊 Checking database status...")

	resp, err := makeRequest("GET", "/api/v1/databases", nil)
	if err != nil {
		log.Fatalf("Failed to get databases: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get databases: HTTP %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func getSchema(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("📋 Getting schema for %s...\n", service)

	resp, err := makeRequest("GET", fmt.Sprintf("/api/v1/databases/%s/schema", service), nil)
	if err != nil {
		log.Fatalf("Failed to get schema for %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get schema for %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func executeSQL(cmd *cobra.Command, args []string) {
	service := args[0]
	query := args[1]
	fmt.Printf("💻 Executing SQL on %s: %s\n", service, query)

	body := map[string]interface{}{
		"query": query,
	}

	resp, err := makeRequest("POST", fmt.Sprintf("/api/v1/databases/%s/query", service), body)
	if err != nil {
		log.Fatalf("Failed to execute SQL on %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to execute SQL on %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func executeScript(cmd *cobra.Command, args []string) {
	service := args[0]
	filePath := args[1]

	// 读取SQL文件
	content, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Failed to read script file: %v", err)
	}

	fmt.Printf("📜 Executing script %s on %s...\n", filepath.Base(filePath), service)

	body := map[string]interface{}{
		"sql": string(content),
	}

	resp, err := makeRequest("POST", fmt.Sprintf("/api/v1/databases/%s/execute", service), body)
	if err != nil {
		log.Fatalf("Failed to execute script on %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to execute script on %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func migrateService(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("🚀 Migrating %s...\n", service)

	// 获取迁移历史
	resp, err := makeRequest("GET", fmt.Sprintf("/api/v1/migrations/%s?limit=1", service), nil)
	if err != nil {
		log.Fatalf("Failed to get migration history for %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get migration history for %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	fmt.Printf("✅ Migration history retrieved for %s\n", service)
	printJSON(result)
}

func backupService(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("💾 Creating backup for %s...\n", service)

	body := map[string]interface{}{
		"name":        fmt.Sprintf("backup-%s-%s", service, time.Now().Format("20060102-150405")),
		"description": fmt.Sprintf("Manual backup for %s service", service),
		"compress":    true,
	}

	resp, err := makeRequest("POST", fmt.Sprintf("/api/v1/databases/%s/backups", service), body)
	if err != nil {
		log.Fatalf("Failed to create backup for %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		log.Fatalf("Failed to create backup for %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	fmt.Printf("✅ Backup created for %s\n", service)
	printJSON(result)
}

func validateService(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("✅ Validating schema for %s...\n", service)

	body := map[string]interface{}{
		"check_data":  false,
		"strict_mode": false,
	}

	resp, err := makeRequest("POST", fmt.Sprintf("/api/v1/databases/%s/validate", service), body)
	if err != nil {
		log.Fatalf("Failed to validate %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Schema validation failed for %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	if valid, ok := result["valid"].(bool); ok && valid {
		fmt.Printf("✅ Schema validation passed for %s\n", service)
	} else {
		fmt.Printf("❌ Schema validation failed for %s\n", service)
	}
	printJSON(result)
}

func restoreService(cmd *cobra.Command, args []string) {
	service, backupId := args[0], args[1]
	fmt.Printf("🔄 Restoring %s from backup %s...\n", service, backupId)

	body := map[string]interface{}{
		"backup_id":      backupId,
		"target_service": service,
		"dry_run":        false,
	}

	resp, err := makeRequest("POST", fmt.Sprintf("/api/v1/databases/%s/restore", service), body)
	if err != nil {
		log.Fatalf("Failed to restore %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to restore %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	fmt.Printf("✅ Restore completed for %s\n", service)
	printJSON(result)
}

func showAuditLogs(cmd *cobra.Command, args []string) {
	fmt.Println("📋 Fetching audit logs...")

	resp, err := makeRequest("GET", "/api/v1/audit/logs?limit=50", nil)
	if err != nil {
		log.Fatalf("Failed to get audit logs: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get audit logs: HTTP %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func showMigrationHistory(cmd *cobra.Command, args []string) {
	service := args[0]
	fmt.Printf("📜 Getting migration history for %s...\n", service)

	resp, err := makeRequest("GET", fmt.Sprintf("/api/v1/migrations/%s?limit=20", service), nil)
	if err != nil {
		log.Fatalf("Failed to get migration history for %s: %v", service, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get migration history for %s: HTTP %d", service, resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	printJSON(result)
}

func deploySchemas(cmd *cobra.Command, args []string) {
	fmt.Println("🚀 Deploying all schema changes...")

	// 获取所有数据库
	resp, err := makeRequest("GET", "/api/v1/databases", nil)
	if err != nil {
		log.Fatalf("Failed to get databases: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Fatalf("Failed to get databases: HTTP %d", resp.StatusCode)
	}

	var databasesResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&databasesResp); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	databases, ok := databasesResp["databases"].([]interface{})
	if !ok {
		log.Fatalf("Invalid databases response format")
	}

	// 对每个服务执行验证
	for _, databaseInterface := range databases {
		database, ok := databaseInterface.(map[string]interface{})
		if !ok {
			continue
		}

		serviceName, ok := database["name"].(string)
		if !ok {
			continue
		}

		fmt.Printf("🔍 Validating %s...\n", serviceName)
		validateService(cmd, []string{serviceName})
	}

	fmt.Println("✅ All schemas validated successfully!")
}
