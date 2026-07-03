#!/bin/bash
# 验证部署准备就绪状态

set -e

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
ARTIFACT_REPO="gm-services"

echo "========================================="
echo "  Google-Monetize 部署准备状态检查"
echo "========================================="
echo

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. 检查 GCP 认证
echo "1. 检查 GCP 认证状态..."
if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
    ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
    check_pass "已认证: $ACCOUNT"
else
    check_fail "未认证 GCP"
    exit 1
fi
echo

# 2. 检查项目
echo "2. 检查 GCP 项目..."
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" = "$PROJECT_ID" ]; then
    check_pass "项目: $PROJECT_ID"
else
    check_warn "当前项目: $CURRENT_PROJECT，需要: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID" 2>/dev/null
fi
echo

# 3. 检查 Artifact Registry
echo "3. 检查 Artifact Registry 仓库..."
if gcloud artifacts repositories describe "$ARTIFACT_REPO" \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(name)" 2>/dev/null | grep -q .; then
    check_pass "Artifact Registry: $ARTIFACT_REPO"
else
    check_warn "Artifact Registry 仓库不存在"
    echo "   创建命令: gcloud artifacts repositories create $ARTIFACT_REPO --repository-format=docker --location=$REGION --project=$PROJECT_ID"
fi
echo

# 4. 检查 Cloud Run 服务
echo "4. 检查 Cloud Run 服务..."
if FRONTEND_URL=$(gcloud run services describe frontend \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)" 2>/dev/null); then
    check_pass "Cloud Run frontend: $FRONTEND_URL"
else
    check_warn "Cloud Run 服务 'frontend' 不存在（首次部署将创建）"
fi
echo

# 5. 检查 Firebase CLI
echo "5. 检查 Firebase CLI..."
if command -v firebase &> /dev/null; then
    FIREBASE_VERSION=$(firebase --version 2>/dev/null)
    check_pass "Firebase CLI: $FIREBASE_VERSION"
else
    check_fail "Firebase CLI 未安装"
    echo "   安装命令: npm install -g firebase-tools"
fi
echo

# 6. 检查 Firebase Hosting targets
echo "6. 检查 Firebase Hosting targets..."
cd "$(dirname "$0")/../apps/frontend" 2>/dev/null || cd apps/frontend
if [ -f ".firebaserc" ]; then
    check_pass "Firebase 配置文件存在"
    if firebase target:list --project="$PROJECT_ID" 2>/dev/null | grep -q "gm-preview"; then
        check_pass "Preview target 已配置"
    else
        check_warn "Preview target 未配置"
        echo "   配置命令: firebase target:apply hosting gm-preview gm-preview"
    fi
    if firebase target:list --project="$PROJECT_ID" 2>/dev/null | grep -q "gm-prod"; then
        check_pass "Production target 已配置"
    else
        check_warn "Production target 未配置"
        echo "   配置命令: firebase target:apply hosting gm-prod gm-prod"
    fi
else
    check_warn "Firebase 配置文件不存在"
fi
cd - > /dev/null
echo

# 7. 检查 Firebase CLI 镜像
echo "7. 检查 Firebase CLI Docker 镜像..."
if gcloud container images list --repository="gcr.io/$PROJECT_ID" --format="value(name)" 2>/dev/null | grep -q "firebase"; then
    check_pass "Firebase CLI 镜像: gcr.io/$PROJECT_ID/firebase"
else
    check_warn "Firebase CLI 镜像不存在"
    echo "   构建命令: gcloud builds submit --config=deployments/docker/build-firebase-image.yaml ."
fi
echo

# 8. 检查环境变量文件
echo "8. 检查环境变量文件..."
if [ -f "apps/frontend/.env.preview" ]; then
    check_pass ".env.preview 存在"
else
    check_fail ".env.preview 不存在"
fi

if [ -f "apps/frontend/.env.production" ]; then
    check_pass ".env.production 存在"
else
    check_fail ".env.production 不存在"
fi
echo

# 9. 检查 Secret Manager 密钥
echo "9. 检查 Secret Manager 密钥..."
REQUIRED_SECRETS=(
    "STRIPE_SECRET_KEY"
    "STRIPE_PUBLISHABLE_KEY"
    "STRIPE_WEBHOOK_SECRET_PREVIEW"
    "STRIPE_WEBHOOK_SECRET_PRODUCTION"
    "NEXTAUTH_SECRET"
)

for SECRET in "${REQUIRED_SECRETS[@]}"; do
    if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" 2>/dev/null | grep -q "name:"; then
        check_pass "Secret: $SECRET"
    else
        check_warn "Secret: $SECRET 不存在"
    fi
done
echo

# 10. 检查服务账号权限
echo "10. 检查服务账号权限..."
SA="codex-dev@$PROJECT_ID.iam.gserviceaccount.com"
REQUIRED_ROLES=(
    "roles/cloudbuild.builds.editor"
    "roles/artifactregistry.writer"
    "roles/run.admin"
    "roles/firebasehosting.admin"
)

echo "   服务账号: $SA"
for ROLE in "${REQUIRED_ROLES[@]}"; do
    if gcloud projects get-iam-policy "$PROJECT_ID" \
        --flatten="bindings[].members" \
        --filter="bindings.members:$SA AND bindings.role=$ROLE" \
        --format="value(bindings.role)" 2>/dev/null | grep -q "$ROLE"; then
        check_pass "权限: $ROLE"
    else
        check_warn "权限: $ROLE 缺失"
    fi
done
echo

# 11. 检查 Cloud Build 日志桶
echo "11. 检查 Cloud Build 日志桶..."
if gsutil ls "gs://gm-build-logs-$REGION" 2>/dev/null | grep -q "gs://"; then
    check_pass "日志桶: gs://gm-build-logs-$REGION"
else
    check_warn "日志桶不存在（将使用默认日志）"
    echo "   创建命令: gsutil mb -l $REGION gs://gm-build-logs-$REGION"
fi
echo

# 总结
echo "========================================="
echo "  检查完成！"
echo "========================================="
echo
echo "📋 下一步操作:"
echo
echo "1. 配置 GitHub Secrets:"
echo "   - GCP_SA_KEY: 服务账号密钥"
echo "   - FIREBASE_SERVICE_ACCOUNT: Firebase 服务账号密钥"
echo
echo "2. 配置 GitHub Variables:"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_REGION: $REGION"
echo "   - ARTIFACT_REPO: $ARTIFACT_REPO"
echo
echo "3. 触发部署:"
echo "   git push origin main  # Preview 部署"
echo "   git push origin production  # Production 部署"
echo
echo "📚 详细文档:"
echo "   docs/deployment/GITHUB_ACTIONS_CHECKLIST.md"
echo