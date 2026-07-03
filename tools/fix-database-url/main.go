package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 4 {
		fmt.Printf("Usage: %s <project_id> <region> <instance_name> <database_name>\n", os.Args[0])
		fmt.Printf("Example: %s my-project us-central1 my-instance gm_db\n", os.Args[0])
		os.Exit(1)
	}

	projectID := os.Args[1]
	region := os.Args[2]
	instanceName := os.Args[3]
	databaseName := os.Args[4]

	fmt.Printf("🔍 Checking DATABASE_URL format...\n")

	currentURL := os.Getenv("DATABASE_URL")
	if currentURL == "" {
		fmt.Println("❌ DATABASE_URL environment variable not found")
		os.Exit(1)
	}

	fmt.Printf("📊 Current DATABASE_URL: %s\n", maskSensitiveURL(currentURL))

	// 生成正确的Cloud SQL URL
	correctURL := fmt.Sprintf("postgresql://USER:PASSWORD@/cloudsql:%s:%s/%s/%s",
		projectID, region, instanceName, databaseName)

	fmt.Printf("✅ Correct Cloud SQL URL: %s\n", maskSensitiveURL(correctURL))

	// 检查当前URL是否已经是正确格式
	if isCloudSQLFormatCorrect(currentURL, projectID, region, instanceName, databaseName) {
		fmt.Println("✅ DATABASE_URL is already in correct Cloud SQL format")
	} else {
		fmt.Println("❌ DATABASE_URL needs to be updated")
		fmt.Println("\n🔧 To fix DATABASE_URL:")
		fmt.Printf("1. Update Secret Manager with: %s\n", correctURL)
		fmt.Println("2. Or use gcloud CLI:")
		fmt.Printf("   gcloud secrets versions add DATABASE_URL \"%s\"\n", correctURL)
		fmt.Println("3. Redeploy services to get new environment variables")
	}

	fmt.Printf("\n📋 Secret Manager update command:\n")
	fmt.Printf("gcloud secrets versions add DATABASE_URL \"%s\" --project=\"%s\"\n", correctURL, projectID)

	fmt.Println("\n🎯 Next steps:")
	fmt.Println("1. Update DATABASE_URL in Secret Manager")
	fmt.Println("2. Redeploy your services")
	fmt.Println("3. Verify database connectivity")
}

func maskSensitiveURL(url string) string {
	if !strings.Contains(url, "@") {
		return url
	}

	parts := strings.Split(url, "@")
	if len(parts) >= 2 {
		userPart := parts[0]
		rest := strings.Join(parts[1:], "@")

		if len(userPart) > 15 {
			userPart = userPart[:12] + "***"
		}

		return userPart + "@" + rest
	}

	return url
}

func isCloudSQLFormatCorrect(url, projectID, region, instanceName, databaseName string) bool {
	// 基本的Cloud SQL格式检查
	return strings.Contains(url, "/cloudsql/") &&
		strings.Contains(url, projectID) &&
		strings.Contains(url, region) &&
		strings.Contains(url, instanceName) &&
		strings.Contains(url, databaseName)
}
