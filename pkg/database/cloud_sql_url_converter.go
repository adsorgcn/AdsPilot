package database

import (
	"fmt"
	"os"
	"strings"
)

// CloudSQLURLConverter Cloud SQL URL转换器
// 将各种格式的数据库URL转换为Cloud SQL标准格式
type CloudSQLURLConverter struct{}

// ConvertToCloudSQLFormat 转换为Cloud SQL标准格式
func (c *CloudSQLURLConverter) ConvertToCloudSQLFormat(projectID, region, instanceName, databaseName string) string {
	// 移除现有连接参数，只保留基本信息
	return fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s",
		projectID, region, instanceName, databaseName)
}

// DetectAndFixCurrentURL 检测并修复当前DATABASE_URL
func (c *CloudSQLURLConverter) DetectAndFixCurrentURL() (string, string, string, error) {
	currentURL := os.Getenv("DATABASE_URL")
	if currentURL == "" {
		return "", "", "", fmt.Errorf("DATABASE_URL environment variable not found")
	}

	fmt.Printf("🔍 Current DATABASE_URL detected: %s\n", maskSensitiveURL(currentURL))

	// 分析当前URL格式
	var suggestedFormat string
	var fixInstructions string

	if strings.Contains(currentURL, "tcp") {
		// TCP直连格式 - 获取项目配置信息
		projectID, region, err := GetProjectConfig()
		if err != nil {
			return "", "", "", fmt.Errorf("failed to get project config: %w", err)
		}

		suggestedFormat = fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s:gm/gm_db", projectID, region)
		fixInstructions = fmt.Sprintf(`🔧 Recommended fix:
  1. Update Secret Manager with new DATABASE_URL
  2. Use this format: %s`, suggestedFormat)
	} else if strings.Contains(currentURL, "/cloudsql/") {
		// 已经是Cloud SQL格式，检查组件完整性
		projectID, region, _ := GetProjectConfig()
		instanceName := "gm"    // 默认实例名
		databaseName := "gm_db" // 默认数据库名

		if !strings.Contains(currentURL, instanceName) {
			suggestedFormat = fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s", projectID, region, instanceName, databaseName)
			fixInstructions = fmt.Sprintf(`🔧 Recommended fix:
  1. Update Secret Manager with corrected instance name
  2. Use this format: %s`, suggestedFormat)
		} else if !strings.Contains(currentURL, databaseName) {
			suggestedFormat = fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s", projectID, region, instanceName, databaseName)
			fixInstructions = fmt.Sprintf(`🔧 Recommended fix:
  1. Update Secret Manager with corrected database name
  2. Use this format: %s`, suggestedFormat)
		} else {
			// 格式正确
			suggestedFormat = currentURL
			fixInstructions = "✅ Current URL format is correct"
		}
	} else if strings.Contains(currentURL, "@localhost") {
		// 本地开发格式
		projectID, region, _ := GetProjectConfig()
		instanceName := "gm"    // 默认实例名
		databaseName := "gm_db" // 默认数据库名
		suggestedFormat = fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s", projectID, region, instanceName, databaseName)
		fixInstructions = fmt.Sprintf(`🔧 Recommended fix for staging:
  1. Update Secret Manager with Cloud SQL format for staging
  2. Use this format: %s`, suggestedFormat)
	} else {
		// 未知格式
		projectID, region, _ := GetProjectConfig()
		instanceName := "gm"    // 默认实例名
		databaseName := "gm_db" // 默认数据库名
		suggestedFormat = fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s", projectID, region, instanceName, databaseName)
		fixInstructions = fmt.Sprintf(`🔧 Recommended fix:
  1. Update Secret Manager with proper Cloud SQL format
  2. Use this format: %s`, suggestedFormat)
	}

	fmt.Printf("💡 Suggested DATABASE_URL format: %s\n", maskSensitiveURL(suggestedFormat))
	fmt.Printf("📋 Fix instructions:\n%s\n", fixInstructions)

	return suggestedFormat, fixInstructions, "", nil
}

// maskSensitiveURL 掩码敏感的URL信息
func maskSensitiveURL(url string) string {
	if !strings.Contains(url, "@") {
		return url
	}

	// 保留协议部分和@符号，掩码用户名和密码
	parts := strings.Split(url, "@")
	if len(parts) >= 2 {
		userPart := parts[0]
		rest := strings.Join(parts[1:], "@")

		// 掩码用户名和密码，只显示前几个字符
		if len(userPart) > 15 {
			userPart = userPart[:12] + "***"
		}

		return userPart + "@" + rest
	}

	return url
}

// ValidateCloudSQLURL 验证Cloud SQL URL格式
func (c *CloudSQLURLConverter) ValidateCloudSQLURL(url string) error {
	if url == "" {
		return fmt.Errorf("URL cannot be empty")
	}

	// 检查必要的组件
	if !strings.HasPrefix(url, "postgresql://") {
		return fmt.Errorf("URL must use postgresql:// protocol")
	}

	if !strings.Contains(url, "/cloudsql/") {
		return fmt.Errorf("URL must contain /cloudsql/ connection string")
	}

	components := strings.Split(strings.TrimPrefix(url, "postgresql://"), "/cloudsql/")
	if len(components) != 4 {
		return fmt.Errorf("URL must have format: postgresql://USER:PASSWORD@/cloudsql:project:region/instance/database")
	}

	return nil
}

// CreateDatabaseURLEnvironmentScript 创建环境变量设置脚本
func (c *CloudSQLURLConverter) CreateDatabaseURLEnvironmentScript(projectID, region, instanceName, databaseName string) string {
	correctURL := c.ConvertToCloudSQLFormat(projectID, region, instanceName, databaseName)

	return fmt.Sprintf(`#!/bin/bash
# Cloud SQL Database URL Fix Script
# Generated for Google-Monetize Cloud SQL migration

echo "🔧 Updating DATABASE_URL to Cloud SQL format..."

# Set the correct DATABASE_URL
export DATABASE_URL="%s"

# Verify the URL format
echo "✅ DATABASE_URL updated successfully!"
echo "📊 URL format: %s"
echo "🔍 To apply permanently, update this in Secret Manager"
`, correctURL, correctURL)
}

// GenerateMigrationGuide 生成迁移指南
func (c *CloudSQLURLConverter) GenerateMigrationGuide(projectID, region, instanceName, databaseName string) string {
	return fmt.Sprintf(`# DATABASE_URL Migration Guide

## 🎯 Current Situation
You have DATABASE_URL environment variable, but it's not in Cloud SQL format.

## 📋 Recommended Solution

### Step 1: Update Secret Manager
In Google Cloud Console or using gcloud CLI:
1. Go to Secret Manager
2. Find your DATABASE_URL secret
3. Update with this format:
%%s

### Step 2: Cloud Run Environment Variables
Ensure these environment variables are set:
- DATABASE_URL (from Secret Manager)
- GCP_PROJECT=%s
- GCP_REGION=%s

### Step 3: Verification
The URL should be: %%s

## 🔍 Current vs Target Format

Current: %%s
Target:  %%s

## ⚠️ Important Notes

1. Keep the same credentials if working
2. The "USER:PASSWORD" should be replaced with actual service account credentials
3. Test connection before deploying to production
`, c.ConvertToCloudSQLFormat(projectID, region, instanceName, databaseName),
		projectID, region, instanceName, databaseName,
		os.Getenv("DATABASE_URL"),
		c.ConvertToCloudSQLFormat(projectID, region, instanceName, databaseName))
}

// GetProjectConfig 获取项目配置
func GetProjectConfig() (projectID, region string, err error) {
	// 从环境变量或配置中获取项目信息
	projectID = os.Getenv("GCP_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT_ID") // 默认项目ID
	}

	region = os.Getenv("GCP_REGION")
	if region == "" {
		region = "asia-northeast1" // 默认区域
	}

	return projectID, region, nil
}
