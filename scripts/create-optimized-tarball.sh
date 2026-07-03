#!/bin/bash
# Google-Monetize 优化Tarball创建脚本
# 根据Monorepo构建最佳实践实现

set -euo pipefail

PROJECT_ID="${1:-gm-dev}"
SERVICE_NAME="${2:-billing}"

log() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ℹ️ $1"
}

error() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ❌ $1"
    exit 1
}

success() {
    echo "[$(date +'%Y-%m-%dT%H:%M:%S')] ✅ $1"
}

# 显示使用说明
if [[ "${1:-}" == "--help" ]]; then
    cat << 'EOF'
Google-Monetize 优化Tarball创建工具

用法:
  $0 create-optimized-tarball.sh [--backend SERVICE_NAME] [--frontend SERVICE_NAME] [options]

选项:
  --help, -h          显示此帮助信息
  --backend SERVICE_NAME  指定后端服务名称（默认: billing）
  --frontend SERVICE_NAME 指定前端服务名称（默认: console）
  --exclude PATTERN   指定排除模式（支持多个）
  --dry-run          显示将要包含的文件，但不实际创建

示例:
  # 创建billing服务的优化tarball
  $0 create-optimized-tarball.sh --backend billing

  # 创建console服务的优化tarball
  $0 create-optimized-tarball.sh --frontend console

  # 创建所有服务的优化tarball
  $0 create-optimized-tarball.sh

  # 只打包必需文件，排除开发依赖
  $0 create-optimized-tarball.sh --backend billing --exclude "node_modules" ".git"

  # 预览模式
  $0 create-optimized-tarball.sh --dry-run --backend billing
EOF
    exit 0
fi

# 解析参数
BACKEND_SERVICE=""
FRONTEND_SERVICE=""
EXCLUDE_PATTERNS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backend)
            BACKEND_SERVICE="$2"
            shift
            ;;
        --frontend)
            FRONTEND_SERVICE="$2"
            shift
            ;;
        --exclude)
            EXCLUDE_PATTERNS+=("$2")
            shift
            ;;
        *)
            break
            ;;
    esac
    shift
done

# 默认值设置
if [[ -z "$BACKEND_SERVICE" ]]; then
    BACKEND_SERVICE="billing"
fi

if [[ -z "$FRONTEND_SERVICE" ]]; then
    FRONTEND_SERVICE="console"
fi

log "🔧 开始创建 $BACKEND_SERVICE 服务的优化Tarball..."

# 确定服务路径
SERVICE_DIR="services/$BACKEND_SERVICE"
if [[ ! -d "$SERVICE_DIR" ]]; then
    error "❌ 服务目录不存在: $SERVICE_DIR"
    exit 1
fi

# 创建临时目录
TEMP_DIR="/tmp/gm-$(date +%s)"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# 构建工作区
WORKSPACE_DIR="$TEMP_DIR/workspace"
mkdir -p "$WORKSPACE_DIR"

# 复制go.work和相关文件
log "📋 复制go.workspace相关文件..."
cp ../../../go.work "$WORKSPACE_DIR/go.work"
cp ../../../go.work.sum "$WORKSPACE_DIR/go.work.sum"

# 复制共享包
log "📦 复制pkg目录..."
if [[ -d "pkg" ]]; then
    cp -r ../../../pkg "$WORKSPACE_DIR/pkg"
else
    log "⚠️ pkg目录不存在，跳过共享包复制"
fi

# 复制服务代码
log "📂 复制$BACKEND_SERVICE 服务代码..."
if [[ -d "$SERVICE_DIR" ]]; then
    mkdir -p "$WORKSPACE_DIR/services/$BACKEND_SERVICE"
    cp -r ../../../services/$BACKEND_SERVICE/* "$WORKSPACE_DIR/services/$BACKEND_SERVICE"
else
    log "⚠️ 服务目录不存在: $SERVICE_DIR"
fi

# 复制schema和migrations
log "📄 复制schema和migrations..."
if [[ -d "$SERVICE_DIR" ]]; then
    cp -r ../../../services/$BACKEND_SERVICE/schemas "$WORKSPACE_DIR/services/$BACKEND_SERVICE/schemas"
    cp -r ../../../services/$BACKEND_SERVICE/migrations "$WORKSPACE_DIR/services/$BACKEND_SERVICE/migrations"
else
    log "⚠️ 服务目录不存在: $SERVICE_DIR"
fi

# 复制部署脚本
log "🔧 复制部署脚本..."
if [[ -d "deployments" ]]; then
    mkdir -p "$WORKSPACE_DIR/deployments"
    cp -r ../../../deployments/* "$WORKSPACE_DIR/deployments"
else
    log "⚠️ 部署目录不存在"
fi

# 复制共享库
log "📦 复制共享依赖库..."
if [[ -d "vendor" ]]; then
    cp -r ../../../vendor "$WORKSPACE_DIR/vendor"
else
    log "⚠️ vendor目录不存在"
fi

# 应用排除模式
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS+=" --exclude=$pattern"
done

# 构建优化配置
log "🔧 准备优化配置..."

# 创建统一目录结构
# 复制以下结构，确保构建工具能找到所有必要文件
mkdir -p "$WORKSPACE_DIR/services/$BACKEND_SERVICE"
mkdir -p "$WORKSPACE_DIR/services/$BACKEND_SERVICE/schemas"
mkdir -p "$WORKSPACE_DIR/services/$BACKEND_SERVICE/migrations"

# 应用优化的源tarball内容
# 基于Monorepo文档的优化策略，使用--dry-run检查
if [[ "${1:-}" == "--dry-run" ]]; then
    log "🔍 预览模式: 不会创建tarball，仅显示将要包含的文件"
    DRY_RUN=true
else
    DRY_RUN=false
fi

# 显示将要包含的文件
log "📋 将要包含的文件和目录:"
echo "服务: $BACKEND_SERVICE"
echo "工作区: $WORKSPACE_DIR"
echo ""

# 显示构建内容（如果有的话）
if [[ -n "$DRY_RUN" ]]; then
    log ""
    find "$WORKSPACE_DIR" -type f -name "*.go" | head -20 | while read -r file; do
        echo "  $file"
    done
fi

# 执行Cloud Build构建
log "🚀 开始Cloud Build构建..."

# 构建命令
SUBMISSION_NAME="${PROJECT_ID}_create-optimized-tarball"
if [[ "$FRONTEND_SERVICE" == "console" ]]; then
    SUBMISSION_NAME="${PROJECT_ID}_create-frontend-optimized-tarball"
fi

gcloud builds submit $SUBMISSION_NAME \
    --config=cloudbuild.yaml \
    --region=asia-northeast1 \
    --source-dir="$WORKSPACE_DIR" \
    --substitutions=_PROJECT_ID="$PROJECT_ID",_BACKEND_SERVICE="$BACKEND_SERVICE"_FRONTEND_SERVICE="$FRONTEND_SERVICE" \
    --submit-only \
    --async 2>&1 | tee /tmp/cloud-build-$$.log

# 检查构建结果
BUILD_ID=$(gcloud builds list --filter="id~$SUBMISSION_NAME" --limit=1 --format="value(id)" | grep -o "id~$SUBMISSION_NAME" | head -1 | awk '{print $2}')

if [[ -z "$BUILD_ID" ]]; then
    error "❌ Cloud Build构建失败或超时"
    exit 1
fi

# 轮询构建状态
log "🔍 轮询Cloud Build状态..."
for i in {1..60}; do
    STATUS=$(gcloud builds describe $BUILD_ID --format="value(status)" 2>/dev/null)
    case $STATUS in
        SUCCESS)
            success "✅ Cloud Build构建成功！"
            break
            ;;
        FAILURE)
            error "❌ Cloud Build构建失败"
            break
            ;;
        TIMEOUT)
            sleep 2
            ;;
        *)
            ;;
    esac
    echo -n "\r构建进度: $STATUS ($i/60)"
    sleep 1
done

if [[ $STATUS == "SUCCESS" ]]; then
    # 清理临时目录
    rm -rf "$TEMP_DIR"
    success "🎉 优化Tarball创建完成！"
    exit 0
else
    error "❌ Cloud Build构建失败"
    exit 1
fi