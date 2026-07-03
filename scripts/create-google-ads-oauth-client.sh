#!/bin/bash
#
# Google Ads OAuth 客户端创建脚本
# 用途: 在当前 GCP 项目中创建新的 OAuth 2.0 客户端用于 Google Ads API
#

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"
PROJECT_NUMBER="644672509127"

echo "=========================================="
echo "Google Ads OAuth 客户端创建指南"
echo "=========================================="
echo ""
echo "项目信息:"
echo "  Project ID: $PROJECT_ID"
echo "  Project Number: $PROJECT_NUMBER"
echo ""

# 检查是否已经配置了 OAuth consent screen
echo "步骤 1: 检查 OAuth consent screen 配置"
echo "----------------------------------------"
echo ""
echo "访问以下链接配置 OAuth consent screen (如果尚未配置):"
echo "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""
echo "配置要点:"
echo "  - User Type: External (外部)"
echo "  - App name: Google-Monetize"
echo "  - User support email: 您的邮箱"
echo "  - Developer contact: 您的邮箱"
echo "  - Scopes: https://www.googleapis.com/auth/adwords (Google Ads API)"
echo ""
read -p "OAuth consent screen 已配置? (y/n): " CONSENT_READY

if [[ "$CONSENT_READY" != "y" ]]; then
  echo "请先配置 OAuth consent screen，然后重新运行此脚本"
  exit 1
fi

echo ""
echo "步骤 2: 创建 OAuth 2.0 客户端 ID"
echo "----------------------------------------"
echo ""
echo "访问以下链接创建新的 OAuth 客户端:"
echo "https://console.cloud.google.com/apis/credentials/oauthclient?project=$PROJECT_ID"
echo ""
echo "配置参数:"
echo "  1. Application type: Web application"
echo "  2. Name: Google Ads OAuth Client"
echo ""
echo "  3. Authorized JavaScript origins:"
echo "     https://www.urlchecker.dev"
echo "     https://www.${APP_DOMAIN}"
echo "     https://urlchecker.dev"
echo "     https://${APP_DOMAIN}"
echo ""
echo "  4. Authorized redirect URIs:"
echo "     https://www.urlchecker.dev/api/v1/adscenter/oauth/callback"
echo "     https://www.${APP_DOMAIN}/api/v1/adscenter/oauth/callback"
echo "     https://urlchecker.dev/api/v1/adscenter/oauth/callback"
echo "     https://${APP_DOMAIN}/api/v1/adscenter/oauth/callback"
echo ""
echo "     (可选) 添加本地开发环境:"
echo "     http://localhost:3000/api/v1/adscenter/oauth/callback"
echo ""

read -p "OAuth 客户端已创建? (y/n): " CLIENT_CREATED

if [[ "$CLIENT_CREATED" != "y" ]]; then
  echo "请先创建 OAuth 客户端，然后重新运行此脚本"
  exit 1
fi

echo ""
echo "步骤 3: 获取 OAuth 凭据"
echo "----------------------------------------"
echo ""
echo "创建完成后，Google Cloud Console 会显示:"
echo "  - Client ID: 644672509127-xxxxx.apps.googleusercontent.com"
echo "  - Client Secret: ${GOOGLE_OAUTH_CLIENT_SECRET}"
echo ""
echo "请输入这些信息:"
echo ""

read -p "Client ID: " NEW_CLIENT_ID
read -sp "Client Secret: " NEW_CLIENT_SECRET
echo ""
echo ""

# 验证输入格式
if [[ ! "$NEW_CLIENT_ID" =~ ^${PROJECT_NUMBER}- ]]; then
  echo "❌ 错误: Client ID 应该以 ${PROJECT_NUMBER}- 开头"
  echo "   您输入的: $NEW_CLIENT_ID"
  exit 1
fi

if [[ ! "$NEW_CLIENT_ID" =~ \.apps\.googleusercontent\.com$ ]]; then
  echo "❌ 错误: Client ID 应该以 .apps.googleusercontent.com 结尾"
  exit 1
fi

if [[ ! "$NEW_CLIENT_SECRET" =~ ^GOCSPX- ]]; then
  echo "❌ 错误: Client Secret 应该以 GOCSPX- 开头"
  exit 1
fi

echo "✅ OAuth 凭据格式验证通过"
echo ""

echo "步骤 4: 更新 Secret Manager"
echo "----------------------------------------"
echo ""

# 备份旧的配置
echo "备份当前配置..."
OLD_CLIENT_ID=$(gcloud secrets versions access latest --secret="GOOGLE_ADS_OAUTH_CLIENT_ID" --project="$PROJECT_ID" 2>/dev/null || echo "")
OLD_CLIENT_SECRET=$(gcloud secrets versions access latest --secret="GOOGLE_ADS_OAUTH_CLIENT_SECRET" --project="$PROJECT_ID" 2>/dev/null || echo "")

if [[ -n "$OLD_CLIENT_ID" ]]; then
  echo "当前 Client ID: ${OLD_CLIENT_ID:0:30}..."
  echo "来自项目: ${OLD_CLIENT_ID%%-*}"
fi

echo ""
read -p "确认更新 Secret Manager? (y/n): " CONFIRM_UPDATE

if [[ "$CONFIRM_UPDATE" != "y" ]]; then
  echo "取消更新"
  exit 0
fi

# 更新 GOOGLE_ADS_OAUTH_CLIENT_ID
echo ""
echo "更新 GOOGLE_ADS_OAUTH_CLIENT_ID..."
echo -n "$NEW_CLIENT_ID" | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_ID \
  --data-file=- \
  --project="$PROJECT_ID"

if [[ $? -eq 0 ]]; then
  echo "✅ GOOGLE_ADS_OAUTH_CLIENT_ID 更新成功"
else
  echo "❌ GOOGLE_ADS_OAUTH_CLIENT_ID 更新失败"
  exit 1
fi

# 更新 GOOGLE_ADS_OAUTH_CLIENT_SECRET
echo ""
echo "更新 GOOGLE_ADS_OAUTH_CLIENT_SECRET..."
echo -n "$NEW_CLIENT_SECRET" | gcloud secrets versions add GOOGLE_ADS_OAUTH_CLIENT_SECRET \
  --data-file=- \
  --project="$PROJECT_ID"

if [[ $? -eq 0 ]]; then
  echo "✅ GOOGLE_ADS_OAUTH_CLIENT_SECRET 更新成功"
else
  echo "❌ GOOGLE_ADS_OAUTH_CLIENT_SECRET 更新失败"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ OAuth 客户端配置完成"
echo "=========================================="
echo ""
echo "新配置信息:"
echo "  Client ID: $NEW_CLIENT_ID"
echo "  Project Number: ${NEW_CLIENT_ID%%-*}"
echo "  Secret Manager: 已更新"
echo ""
echo "旧配置备份 (如需回滚):"
if [[ -n "$OLD_CLIENT_ID" ]]; then
  echo "  Old Client ID: ${OLD_CLIENT_ID:0:50}..."
fi
echo ""
echo "下一步:"
echo "  1. 重新部署使用 Google Ads OAuth 的服务"
echo "  2. 测试 OAuth 登录流程"
echo "  3. 验证 API 调用是否正常"
echo ""
echo "部署命令:"
echo "  git commit -m 'chore: migrate Google Ads OAuth to current GCP project'"
echo "  git push origin main"
echo ""
