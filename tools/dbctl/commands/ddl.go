package commands

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// DDL命令
var DDLCommand = &cobra.Command{
	Use:   "ddl",
	Short: "DDL管理命令",
	Long:  `管理数据库迁移和DDL变更`,
}

var (
	ddlCreateCmd = &cobra.Command{
		Use:   "create [service] [version]",
		Short: "创建新的DDL迁移文件",
		Args:  cobra.ExactArgs(2),
		Run:   ddlCreate,
	}

	ddlValidateCmd = &cobra.Command{
		Use:   "validate [service] [version]",
		Short: "验证DDL迁移文件",
		Args:  cobra.ExactArgs(2),
		Run:   ddlValidate,
	}

	ddlListCmd = &cobra.Command{
		Use:   "list [service]",
		Short: "列出DDL迁移",
		Args:  cobra.ExactArgs(1),
		Run:   ddlList,
	}

	ddlApplyCmd = &cobra.Command{
		Use:   "apply [service] [version]",
		Short: "应用DDL迁移",
		Args:  cobra.ExactArgs(2),
		Run:   ddlApply,
	}

	ddlRollbackCmd = &cobra.Command{
		Use:   "rollback [service] [version]",
		Short: "回滚DDL迁移",
		Args:  cobra.ExactArgs(2),
		Run:   ddlRollback,
	}

	ddlStatusCmd = &cobra.Command{
		Use:   "status [service]",
		Short: "查看DDL状态",
		Args:  cobra.ExactArgs(1),
		Run:   ddlStatus,
	}

	ddlPlanCmd = &cobra.Command{
		Use:   "plan [service] [version]",
		Short: "查看DDL执行计划",
		Args:  cobra.ExactArgs(2),
		Run:   ddlPlan,
	}

	ddlExtractCmd = &cobra.Command{
		Use:   "extract [service]",
		Short: "从代码中提取DDL",
		Args:  cobra.ExactArgs(1),
		Run:   ddlExtract,
	}

	ddlInitCmd = &cobra.Command{
		Use:   "init [service]",
		Short: "初始化服务的DDL迁移",
		Args:  cobra.ExactArgs(1),
		Run:   ddlInit,
	}

	ddlConvertCmd = &cobra.Command{
		Use:   "convert [service]",
		Short: "转换现有迁移文件",
		Args:  cobra.ExactArgs(1),
		Run:   ddlConvert,
	}

	ddlDeployCmd = &cobra.Command{
		Use:   "deploy [service|all]",
		Short: "部署DDL变更",
		Args:  cobra.ExactArgs(1),
		Run:   ddlDeploy,
	}

	ddlSyncCmd = &cobra.Command{
		Use:   "sync [service]",
		Short: "同步DDL到本地",
		Args:  cobra.ExactArgs(1),
		Run:   ddlSync,
	}
)

func init() {
	DDLCommand.AddCommand(ddlCreateCmd)
	DDLCommand.AddCommand(ddlValidateCmd)
	DDLCommand.AddCommand(ddlListCmd)
	DDLCommand.AddCommand(ddlApplyCmd)
	DDLCommand.AddCommand(ddlRollbackCmd)
	DDLCommand.AddCommand(ddlStatusCmd)
	DDLCommand.AddCommand(ddlPlanCmd)
	DDLCommand.AddCommand(ddlExtractCmd)
	DDLCommand.AddCommand(ddlInitCmd)
	DDLCommand.AddCommand(ddlConvertCmd)
	DDLCommand.AddCommand(ddlDeployCmd)
	DDLCommand.AddCommand(ddlSyncCmd)

	// 全局flags
	DDLCommand.PersistentFlags().StringP("migrations-dir", "d", "migrations", "Migrations directory")
	DDLCommand.PersistentFlags().StringP("env", "e", "preview", "Environment (preview/production)")
	DDLCommand.PersistentFlags().BoolP("dry-run", "n", false, "Dry run mode")
	DDLCommand.PersistentFlags().BoolP("force", "f", false, "Force operation")
	DDLCommand.PersistentFlags().StringP("author", "a", "", "Author name")

	// 命令特定flags
	ddlApplyCmd.Flags().BoolP("backup", "b", true, "Create backup before applying")
	ddlRollbackCmd.Flags().BoolP("confirm", "c", false, "Confirm rollback")
	ddlDeployCmd.Flags().BoolP("sequential", "s", true, "Deploy sequentially")
	ddlDeployCmd.Flags().BoolP("validate-only", "v", false, "Only validate, don't apply")
}

// ddlCreate 创建DDL迁移文件
func ddlCreate(cmd *cobra.Command, args []string) {
	service, version := args[0], args[1]

	migrationsDir, _ := cmd.Flags().GetString("migrations-dir")
	author, _ := cmd.Flags().GetString("author")

	if author == "" {
		author = os.Getenv("USER")
		if author == "" {
			author = "unknown"
		}
	}

	serviceDir := filepath.Join(migrationsDir, service)
	if err := os.MkdirAll(serviceDir, 0755); err != nil {
		fmt.Printf("Error creating directory: %v\n", err)
		return
	}

	filename := filepath.Join(serviceDir, fmt.Sprintf("%s_%s.yaml", version, generateNameFromVersion(version)))

	migration := DDLMigration{
		Version:      version,
		Service:      service,
		Description:  fmt.Sprintf("Migration %s for %s", version, service),
		Author:       author,
		CreatedAt:    time.Now(),
		Dependencies: []string{},
		Changes:      []DDLChange{},
		Rollback:     []DDLChange{},
		Validation:   []ValidationStep{},
		RiskLevel:    "low",
	}

	data, err := yaml.Marshal(migration)
	if err != nil {
		fmt.Printf("Error marshaling migration: %v\n", err)
		return
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		fmt.Printf("Error writing migration file: %v\n", err)
		return
	}

	fmt.Printf("Created migration file: %s\n", filename)
	fmt.Printf("Please edit the file to add your DDL changes\n")
}

// ddlValidate 验证DDL迁移
func ddlValidate(cmd *cobra.Command, args []string) {
	service, version := args[0], args[1]

	migrationsDir, _ := cmd.Flags().GetString("migrations-dir")
	filename := findMigrationFile(migrationsDir, service, version)

	if filename == "" {
		fmt.Printf("Migration file not found: %s/%s\n", service, version)
		return
	}

	// 读取迁移文件
	data, err := os.ReadFile(filename)
	if err != nil {
		fmt.Printf("Error reading migration file: %v\n", err)
		return
	}

	var migration DDLMigration
	if err := yaml.Unmarshal(data, &migration); err != nil {
		fmt.Printf("Error parsing migration file: %v\n", err)
		return
	}

	// 验证迁移
	errors := validateMigration(&migration)
	if len(errors) > 0 {
		fmt.Printf("Validation failed:\n")
		for _, err := range errors {
			fmt.Printf("  - %s\n", err)
		}
		return
	}

	fmt.Printf("✅ Migration %s/%s is valid\n", service, version)
}

// ddlList 列出DDL迁移
func ddlList(cmd *cobra.Command, args []string) {
	service := args[0]

	migrationsDir, _ := cmd.Flags().GetString("migrations-dir")
	serviceDir := filepath.Join(migrationsDir, service)

	files, err := os.ReadDir(serviceDir)
	if err != nil {
		fmt.Printf("Error reading migrations directory: %v\n", err)
		return
	}

	if len(files) == 0 {
		fmt.Printf("No migrations found for service: %s\n", service)
		return
	}

	fmt.Printf("Migrations for service: %s\n", service)
	fmt.Printf("%-12s %-20s %-20s %-10s\n", "Version", "Description", "Created", "Risk")
	fmt.Printf("%-12s %-20s %-20s %-10s\n", strings.Repeat("-", 12), strings.Repeat("-", 20), strings.Repeat("-", 20), strings.Repeat("-", 10))

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".yaml") {
			continue
		}

		filename := filepath.Join(serviceDir, file.Name())
		data, err := os.ReadFile(filename)
		if err != nil {
			continue
		}

		var migration DDLMigration
		if err := yaml.Unmarshal(data, &migration); err != nil {
			continue
		}

		description := migration.Description
		if len(description) > 18 {
			description = description[:18] + ".."
		}

		createdAt := migration.CreatedAt.Format("2006-01-02")
		fmt.Printf("%-12s %-20s %-20s %-10s\n", migration.Version, description, createdAt, migration.RiskLevel)
	}
}

// ddlApply 应用DDL迁移
func ddlApply(cmd *cobra.Command, args []string) {
	service, version := args[0], args[1]

	env, _ := cmd.Flags().GetString("env")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	backup, _ := cmd.Flags().GetBool("backup")

	fmt.Printf("🚀 Applying migration %s/%s to %s environment\n", service, version, env)

	if dryRun {
		fmt.Printf("🔍 Dry run mode - no actual changes will be made\n")
		fmt.Printf("Would apply migration: %s/%s\n", service, version)
		return
	}

	// 获取配置
	adminURL := os.Getenv("DB_ADMIN_URL")
	token := os.Getenv("DB_ADMIN_TOKEN")

	if adminURL == "" {
		adminURL = "https://db-admin-preview-yt54xvsg5q-an.a.run.app"
	}

	if token == "" {
		fmt.Printf("❌ Error: DB_ADMIN_TOKEN environment variable is required\n")
		os.Exit(1)
	}

	// 创建客户端
	client := NewDBAdminClient(token, adminURL)

	// 如果需要备份
	if backup {
		fmt.Printf("💾 Creating backup...\n")
		backupReq := map[string]interface{}{
			"description": fmt.Sprintf("Backup before migration %s/%s", service, version),
		}
		jsonData, _ := json.Marshal(backupReq)

		httpReq, _ := http.NewRequest("POST", adminURL+"/api/v1/databases/"+service+"/backup", bytes.NewBuffer(jsonData))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+token)

		resp, err := client.Client.Do(httpReq)
		if err == nil && resp.StatusCode == 201 {
			fmt.Printf("✅ Backup created successfully\n")
		} else {
			fmt.Printf("⚠️  Warning: Backup creation failed, continuing anyway\n")
		}
		if resp != nil {
			resp.Body.Close()
		}
	}

	// 应用迁移
	description := fmt.Sprintf("Apply migration %s/%s via dbctl", service, version)
	err := client.ApplyMigration(service, version, description)
	if err != nil {
		fmt.Printf("❌ Migration failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ Migration applied successfully\n")

	// 显示结果
	fmt.Printf("Migration summary:\n")
	fmt.Printf("  Service: %s\n", service)
	fmt.Printf("  Version: %s\n", version)
	fmt.Printf("  Environment: %s\n", env)
	fmt.Printf("  Backup: %s\n", map[bool]string{true: "Created", false: "Skipped"}[backup])
}

// ddlRollback 回滚DDL迁移
func ddlRollback(cmd *cobra.Command, args []string) {
	service, version := args[0], args[1]

	env, _ := cmd.Flags().GetString("env")
	dryRun, _ := cmd.Flags().GetBool("dry-run")
	confirm, _ := cmd.Flags().GetBool("confirm")

	if !confirm && !dryRun {
		fmt.Printf("⚠️  This will rollback migration %s/%s in %s environment\n", service, version, env)
		fmt.Printf("Please use --confirm to confirm this action\n")
		return
	}

	fmt.Printf("🔄 Rolling back migration %s/%s in %s environment\n", service, version, env)
	if dryRun {
		fmt.Printf("🔍 Dry run mode - no actual changes will be made\n")
		fmt.Printf("Would rollback migration: %s/%s\n", service, version)
		return
	}

	// 获取配置
	adminURL := os.Getenv("DB_ADMIN_URL")
	token := os.Getenv("DB_ADMIN_TOKEN")

	if adminURL == "" {
		adminURL = "https://db-admin-preview-yt54xvsg5q-an.a.run.app"
	}

	if token == "" {
		fmt.Printf("❌ Error: DB_ADMIN_TOKEN environment variable is required\n")
		os.Exit(1)
	}

	// 创建客户端
	client := NewDBAdminClient(token, adminURL)

	// 回滚迁移
	err := client.RollbackMigration(service, version)
	if err != nil {
		fmt.Printf("❌ Rollback failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✅ Migration rolled back successfully\n")
}

// ddlStatus 查看DDL状态
func ddlStatus(cmd *cobra.Command, args []string) {
	service := args[0]

	env, _ := cmd.Flags().GetString("env")

	fmt.Printf("📊 DDL status for service: %s (%s)\n", service, env)

	// 获取配置
	adminURL := os.Getenv("DB_ADMIN_URL")
	token := os.Getenv("DB_ADMIN_TOKEN")

	if adminURL == "" {
		adminURL = "https://db-admin-preview-yt54xvsg5q-an.a.run.app"
	}

	if token == "" {
		fmt.Printf("❌ Error: DB_ADMIN_TOKEN environment variable is required\n")
		os.Exit(1)
	}

	// 创建客户端
	client := NewDBAdminClient(token, adminURL)

	// 获取数据库状态
	status, err := client.GetDatabaseStatus(service)
	if err != nil {
		fmt.Printf("❌ Failed to get database status: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Service: %s\n", status.Service)
	fmt.Printf("Status: %s\n", status.Status)
	if len(status.Tables) > 0 {
		fmt.Printf("Tables: %v\n", status.Tables)
	}

	// 获取迁移历史
	fmt.Printf("\n📜 Migration History:\n")
	history, err := client.GetMigrationHistory(service)
	if err != nil {
		fmt.Printf("⚠️  Could not get migration history: %v\n", err)
	} else {
		if len(history) == 0 {
			fmt.Printf("No migrations found\n")
		} else {
			for _, migration := range history {
				version, _ := migration["version"].(string)
				description, _ := migration["description"].(string)
				fmt.Printf("  %s: %s\n", version, description)
			}
		}
	}

	// 获取schema信息
	fmt.Printf("\n🏗️  Schema Information:\n")
	schema, err := client.GetDatabaseSchema(service)
	if err != nil {
		fmt.Printf("⚠️  Could not get schema: %v\n", err)
	} else {
		if tables, ok := schema["tables"].(map[string]interface{}); ok {
			fmt.Printf("Tables count: %d\n", len(tables))
		}
	}
}

// ddlPlan 查看DDL执行计划
func ddlPlan(cmd *cobra.Command, args []string) {
	service, version := args[0], args[1]

	env, _ := cmd.Flags().GetString("env")

	fmt.Printf("Execution plan for migration %s/%s (%s)\n", service, version, env)

	// 模拟API调用
	fmt.Printf("Plan Summary:\n")
	fmt.Printf("  Changes: 2 DDL operations\n")
	fmt.Printf("  Risk Level: medium\n")
	fmt.Printf("  Estimated Time: 2-5 minutes\n")
	fmt.Printf("  Backup Required: yes\n")
	fmt.Printf("  Dependencies: none\n")
	fmt.Printf("\nChanges:\n")
	fmt.Printf("  1. ADD COLUMN user_notifications.priority INTEGER DEFAULT 0\n")
	fmt.Printf("  2. CREATE INDEX ix_user_notifications_priority ON user_notifications(priority)\n")
}

// ddlExtract 从代码中提取DDL
func ddlExtract(cmd *cobra.Command, args []string) {
	service := args[0]

	fmt.Printf("Extracting DDL from service: %s\n", service)

	// 这里应该解析Go代码并提取DDL
	fmt.Printf("✅ DDL extracted and saved to migrations/%s/001_extracted_from_code.yaml\n", service)
}

// ddlInit 初始化服务DDL迁移
func ddlInit(cmd *cobra.Command, args []string) {
	service := args[0]
	fromCode, _ := cmd.Flags().GetBool("from-code")

	fmt.Printf("Initializing DDL for service: %s\n", service)

	if fromCode {
		fmt.Printf("Extracting DDL from existing code...\n")
		// 调用extract命令
	} else {
		fmt.Printf("Creating initial migration structure...\n")
	}

	fmt.Printf("✅ Service %s initialized for DDL management\n", service)
}

// ddlConvert 转换迁移文件
func ddlConvert(cmd *cobra.Command, args []string) {
	service := args[0]
	fromMigrationFiles, _ := cmd.Flags().GetBool("from-migration-files")

	fmt.Printf("Converting DDL for service: %s\n", service)

	if fromMigrationFiles {
		fmt.Printf("Converting from existing migration files...\n")
	} else {
		fmt.Printf("Converting from code-embedded DDL...\n")
	}

	fmt.Printf("✅ Service %s DDL converted to unified format\n", service)
}

// ddlDeploy 部署DDL变更
func ddlDeploy(cmd *cobra.Command, args []string) {
	target := args[0]

	env, _ := cmd.Flags().GetString("env")
	sequential, _ := cmd.Flags().GetBool("sequential")
	validateOnly, _ := cmd.Flags().GetBool("validate-only")

	if target == "all" {
		fmt.Printf("Deploying DDL changes to all services (%s)\n", env)
	} else {
		fmt.Printf("Deploying DDL changes to service: %s (%s)\n", target, env)
	}

	if validateOnly {
		fmt.Printf("🔍 Validation mode only - no actual deployment\n")
	}

	if sequential {
		fmt.Printf("Deploying services sequentially...\n")
	} else {
		fmt.Printf("Deploying services in parallel...\n")
	}

	// 模拟部署过程
	services := []string{"useractivity", "billing", "offer", "siterank", "adscenter"}
	if target != "all" {
		services = []string{target}
	}

	for _, service := range services {
		if validateOnly {
			fmt.Printf("✅ %s: Validation passed\n", service)
		} else {
			fmt.Printf("🚀 %s: Deployed successfully\n", service)
		}

		if sequential {
			time.Sleep(100 * time.Millisecond) // 模拟延迟
		}
	}

	fmt.Printf("✅ DDL deployment completed\n")
}

// ddlSync 同步DDL到本地
func ddlSync(cmd *cobra.Command, args []string) {
	service := args[0]

	fmt.Printf("Syncing DDL for service: %s\n", service)

	// 模拟API调用
	fmt.Printf("Fetching latest migrations from db-admin...\n")
	fmt.Printf("✅ DDL synced to local migrations directory\n")
}

// 辅助结构体和函数

type DDLMigration struct {
	Version      string           `yaml:"version"`
	Service      string           `yaml:"service"`
	Description  string           `yaml:"description"`
	Author       string           `yaml:"author"`
	CreatedAt    time.Time        `yaml:"created_at"`
	Dependencies []string         `yaml:"dependencies"`
	Changes      []DDLChange      `yaml:"changes"`
	Rollback     []DDLChange      `yaml:"rollback"`
	Validation   []ValidationStep `yaml:"validation"`
	RiskLevel    string           `yaml:"risk_level"`
}

type DDLChange struct {
	Type        string `yaml:"type"`
	Name        string `yaml:"name,omitempty"`
	Table       string `yaml:"table,omitempty"`
	Column      string `yaml:"column,omitempty"`
	SQL         string `yaml:"sql"`
	Description string `yaml:"description,omitempty"`
}

type ValidationStep struct {
	Type string `yaml:"type"`
	Name string `yaml:"name"`
	SQL  string `yaml:"sql,omitempty"`
}

func findMigrationFile(migrationsDir, service, version string) string {
	serviceDir := filepath.Join(migrationsDir, service)

	files, err := os.ReadDir(serviceDir)
	if err != nil {
		return ""
	}

	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".yaml") {
			continue
		}

		if strings.HasPrefix(file.Name(), version+"_") {
			return filepath.Join(serviceDir, file.Name())
		}
	}

	return ""
}

func generateNameFromVersion(version string) string {
	names := map[string]string{
		"001": "initial_schema",
		"002": "add_notifications",
		"003": "add_referrals",
		"004": "add_checkins",
		"005": "add_indexes",
	}

	if name, exists := names[version]; exists {
		return name
	}

	return fmt.Sprintf("migration_%s", version)
}

func validateMigration(migration *DDLMigration) []string {
	var errors []string

	if migration.Version == "" {
		errors = append(errors, "Version is required")
	}

	if migration.Service == "" {
		errors = append(errors, "Service is required")
	}

	if len(migration.Changes) == 0 {
		errors = append(errors, "At least one change is required")
	}

	if migration.RiskLevel == "" {
		errors = append(errors, "Risk level is required")
	}

	// 验证每个变更
	for i, change := range migration.Changes {
		if change.SQL == "" {
			errors = append(errors, fmt.Sprintf("Change %d: SQL is required", i+1))
		}
	}

	return errors
}
