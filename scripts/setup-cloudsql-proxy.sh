#!/bin/bash

# Cloud SQL Proxy Setup Script
# 创建和配置Cloud SQL Proxy实例以支持Autoads项目数据库访问

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要工具
check_prerequisites() {
    log_info "检查必要工具和权限..."

    # 检查gcloud命令
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI未安装，请先安装Google Cloud SDK"
        exit 1
    fi

    # 检查是否已登录
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        log_error "未登录Google Cloud账户，请运行: gcloud auth login"
        exit 1
    fi

    # 检查当前项目
    PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
    if [[ -z "$PROJECT_ID" ]]; then
        log_error "未设置项目ID，请运行: gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi

    log_success "权限检查通过，当前项目: $PROJECT_ID"
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."

    # 项目配置
    export PROJECT_ID="${PROJECT_ID:-${GCP_PROJECT_ID}}"
    export REGION="${REGION:-us-central1}"
    export INSTANCE_NAME="${INSTANCE_NAME:-gm-proxy}"
    export DATABASE_NAME="${DATABASE_NAME:-gm_db}"
    export SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-cloudsql-proxy}"
    export SERVICE_ACCOUNT="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

    # 数据库配置
    export DB_VERSION="${DB_VERSION:-POSTGRES_15}"
    export DB_TIER="${DB_TIER:-db-custom-4-16384}"
    export DB_DISK_SIZE="${DB_DISK_SIZE:-100GB}"
    export DB_STORAGE_TYPE="${DB_STORAGE_TYPE:-PD_SSD}"

    # 备份配置
    export BACKUP_START_TIME="${BACKUP_START_TIME:-02:00}"
    export BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

    # 网络配置
    export NETWORK_NAME="${NETWORK_NAME:-default}"
    export ASSIGN_PUBLIC_IP="${ASSIGN_PUBLIC_IP:-true}"

    log_info "项目配置:"
    log_info "  - 项目ID: $PROJECT_ID"
    log_info "  - 区域: $REGION"
    log_info "  - 实例名: $INSTANCE_NAME"
    log_info "  - 数据库名: $DATABASE_NAME"
    log_info "  - 服务账户: $SERVICE_ACCOUNT"
}

# 创建Cloud SQL实例
create_cloudsql_instance() {
    log_info "创建Cloud SQL实例..."

    # 检查实例是否已存在
    if gcloud sql instances describe "$INSTANCE_NAME" --format="value(name)" 2>/dev/null; then
        log_warning "Cloud SQL实例 $INSTANCE_NAME 已存在，跳过创建"
        return
    fi

    log_info "正在创建Cloud SQL实例: $INSTANCE_NAME"

    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version="$DB_VERSION" \
        --tier="$DB_TIER" \
        --region="$REGION" \
        --storage-type="$DB_STORAGE_TYPE" \
        --storage-size="$DB_DISK_SIZE" \
        --backup-start-time="$BACKUP_START_TIME" \
        --retained-backups-count="$BACKUP_RETENTION_DAYS" \
        --network="$NETWORK_NAME" \
        --assign-public-ip="$ASSIGN_PUBLIC_IP" \
        --no-backup

    # 等待实例创建完成
    log_info "等待Cloud SQL实例创建完成..."
    gcloud sql instances wait "$INSTANCE_NAME" --timeout=600s

    log_success "Cloud SQL实例创建完成"
}

# 创建数据库
create_database() {
    log_info "创建数据库: $DATABASE_NAME"

    # 检查数据库是否已存在
    if gcloud sql databases list --instance="$INSTANCE_NAME" --filter="name:$DATABASE_NAME" --format="value(name)" | grep -q "$DATABASE_NAME"; then
        log_warning "数据库 $DATABASE_NAME 已存在，跳过创建"
        return
    fi

    gcloud sql databases create "$DATABASE_NAME" \
        --instance="$INSTANCE_NAME" \
        --charset=UTF8 \
        --collation=en_US.UTF8

    log_success "数据库创建完成"
}

# 创建服务账户
create_service_account() {
    log_info "创建服务账户: $SERVICE_ACCOUNT_NAME"

    # 检查服务账户是否已存在
    if gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
        log_warning "服务账户 $SERVICE_ACCOUNT 已存在，跳过创建"
        return
    fi

    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Cloud SQL Proxy Service Account" \
        --description="Service account for Cloud SQL Proxy to access Autoads database"

    log_success "服务账户创建完成"
}

# 授予权限
grant_permissions() {
    log_info "配置服务账户权限..."

    # 授予Cloud SQL Client角色
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/cloudsql.client"

    # 授予Cloud SQL Editor角色
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SERVICE_ACCOUNT" \
        --role="roles/cloudsql.editor"

    # 创建数据库用户
    log_info "创建数据库用户..."
    gcloud sql users create "$SERVICE_ACCOUNT" \
        --instance="$INSTANCE_NAME" \
        --type=CLOUD_SQL_SERVICE_ACCOUNT

    log_success "权限配置完成"
}

# 生成连接信息
generate_connection_info() {
    log_info "生成连接信息..."

    # 获取实例公共IP
    PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
        --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "")

    # 获取实例连接名称
    CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
        --format="value(connectionName)" 2>/dev/null || echo "")

    # 生成连接字符串
    CONNECTION_STRING="postgres://$SERVICE_ACCOUNT:@$PUBLIC_IP:5432/$DATABASE_NAME?sslmode=require"

    log_info "连接信息:"
    log_info "  - 公共IP: $PUBLIC_IP"
    log_info "  - 连接名称: $CONNECTION_NAME"
    log_info "  - 连接字符串: $CONNECTION_STRING"

    # 保存到环境文件
    cat > .env.cloudsql << EOF
# Cloud SQL Configuration
CLOUDSQL_PROJECT_ID=$PROJECT_ID
CLOUDSQL_REGION=$REGION
CLOUDSQL_INSTANCE_NAME=$INSTANCE_NAME
CLOUDSQL_DATABASE_NAME=$DATABASE_NAME
CLOUDSQL_CONNECTION_NAME=$CONNECTION_NAME
CLOUDSQL_PUBLIC_IP=$PUBLIC_IP
CLOUDSQL_SERVICE_ACCOUNT=$SERVICE_ACCOUNT
CLOUDSQL_CONNECTION_STRING="$CONNECTION_STRING"
EOF

    log_success "连接信息已保存到 .env.cloudsql"
}

# 创建Docker Compose配置
create_docker_compose() {
    log_info "创建Docker Compose配置..."

    mkdir -p scripts/database

    cat > scripts/database/docker-compose.cloudsql.yml << 'EOF'
version: '3.8'

services:
  # Cloud SQL Proxy服务
  cloudsql-proxy:
    image: gcr.io/cloudsql-docker/gce-proxy:1.28.0
    container_name: gm-cloudsql-proxy
    restart: unless-stopped

    command:
      - /cloud_sql_proxy
      - -instances=${CLOUDSQL_CONNECTION_NAME}=tcp:0.0.0.0:5432
      - -credential_file=/config/credentials.json
      - -verbose
      - -log_debug_stdout

    environment:
      - CLOUDSQL_CONNECTION_NAME=${CLOUDSQL_CONNECTION_NAME}
      - CLOUDSQL_DATABASE_NAME=${CLOUDSQL_DATABASE_NAME}

    volumes:
      - ./config:/config:ro
      - ./logs:/logs

    ports:
      - "5432:5432"

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h localhost -p 5432"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

    networks:
      - gm-network

  # 数据库迁移服务
  migrator:
    build:
      context: ../..
      dockerfile: tools/migrator/Dockerfile

    container_name: gm-migrator
    restart: "no"

    environment:
      - CLOUDSQL_HOST=cloudsql-proxy
      - CLOUDSQL_PORT=5432
      - CLOUDSQL_DATABASE=${CLOUDSQL_DATABASE_NAME}
      - CLOUDSQL_USER=${CLOUDSQL_SERVICE_ACCOUNT}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - ENVIRONMENT=development
      - MIGRATIONS_DIR=/migrations

    volumes:
      - ../../migrations:/migrations:ro
      - ../../logs:/logs

    depends_on:
      cloudsql-proxy:
        condition: service_healthy

    networks:
      - gm-network

    command: >
      sh -c "
        echo 'Waiting for database connection...' &&
        while ! nc -z cloudsql-proxy 5432; do
          echo 'Database not ready, waiting...' &&
          sleep 2;
        done &&
        echo 'Database is ready, starting migrations...' &&
        ./migrator --domains user-domain,activity-domain,offer-domain,billing-domain
      "

  # 连接池服务
  connection-pool:
    build:
      context: ../..
      dockerfile: services/connection-pool/Dockerfile

    container_name: gm-connection-pool
    restart: unless-stopped

    environment:
      - CLOUDSQL_HOST=cloudsql-proxy
      - CLOUDSQL_PORT=5432
      - CLOUDSQL_DATABASE=${CLOUDSQL_DATABASE_NAME}
      - CLOUDSQL_USER=${CLOUDSQL_SERVICE_ACCOUNT}
      - POOL_MAX_CONNECTIONS=50
      - POOL_MIN_CONNECTIONS=5
      - POOL_CONNECTION_TIMEOUT=30s
      - POOL_IDLE_TIMEOUT=300s
      - POOL_MAX_LIFETIME=3600s
      - METRICS_PORT=9090
      - HEALTH_CHECK_PORT=8080

    ports:
      - "9090:9090"  # Prometheus metrics
      - "8080:8080"  # Health check

    depends_on:
      cloudsql-proxy:
        condition: service_healthy

    networks:
      - gm-network

    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  gm-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  logs:
    driver: local
  config:
    driver: local
EOF

    log_success "Docker Compose配置已创建"
}

# 创建监控配置
create_monitoring_config() {
    log_info "创建监控配置..."

    mkdir -p monitoring/prometheus monitoring/grafana

    # Prometheus配置
    cat > monitoring/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'connection-pool'
    static_configs:
      - targets: ['connection-pool:9090']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'cloudsql-proxy'
    static_configs:
      - targets: ['cloudsql-proxy:9090']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    metrics_path: '/metrics'
    scrape_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF

    # Grafana配置
    cat > monitoring/grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

    # 告警规则
    mkdir -p monitoring/prometheus/rules
    cat > monitoring/prometheus/rules/database.yml << 'EOF'
groups:
  - name: database.rules
    rules:
      - alert: ConnectionPoolHighUsage
        expr: connection_pool_active_connections / connection_pool_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "连接池使用率过高"
          description: "连接池使用率已达到 {{ $value | humanizePercentage }}"

      - alert: DatabaseSlowQueries
        expr: postgres_query_duration_seconds{quantile="0.95"} > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "数据库慢查询"
          description: "95%的查询执行时间超过5秒: {{ $value }}s"

      - alert: DatabaseConnectionErrors
        expr: increase(postgres_stat_database_xact_commit_total[5m]) == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "数据库连接异常"
          description: "数据库在5分钟内没有新事务，可能存在连接问题"
EOF

    log_success "监控配置已创建"
}

# 创建启动脚本
create_startup_scripts() {
    log_info "创建启动脚本..."

    # 启动脚本
    cat > scripts/start-cloudsql.sh << 'EOF'
#!/bin/bash

# 启动Cloud SQL Proxy和相关服务

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查环境文件
if [[ ! -f ".env.cloudsql" ]]; then
    log_error "环境文件 .env.cloudsql 不存在，请先运行 setup-cloudsql-proxy.sh"
    exit 1
fi

# 加载环境变量
source .env.cloudsql

log_info "启动Cloud SQL Proxy服务..."

# 启动服务
docker-compose -f scripts/database/docker-compose.cloudsql.yml up -d

log_info "等待服务启动..."
sleep 30

# 检查服务状态
log_info "检查服务状态..."
docker-compose -f scripts/database/docker-compose.cloudsql.yml ps

# 健康检查
log_info "执行健康检查..."
if curl -f http://localhost:8080/health >/dev/null 2>&1; then
    log_success "连接池服务健康状态正常"
else
    log_warning "连接池服务可能未完全启动，请稍后检查"
fi

log_success "Cloud SQL Proxy服务启动完成"
log_info "连接字符串: $CLOUDSQL_CONNECTION_STRING"
log_info "监控面板: http://localhost:3000 (admin/admin)"
log_info "Prometheus: http://localhost:9090"
EOF

    # 停止脚本
    cat > scripts/stop-cloudsql.sh << 'EOF'
#!/bin/bash

# 停止Cloud SQL Proxy和相关服务

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

log_info "停止Cloud SQL Proxy服务..."

docker-compose -f scripts/database/docker-compose.cloudsql.yml down

log_info "清理Docker资源..."
docker system prune -f

log_info "Cloud SQL Proxy服务已停止"
EOF

    # 状态检查脚本
    cat > scripts/check-cloudsql-status.sh << 'EOF'
#!/bin/bash

# 检查Cloud SQL Proxy状态

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $1"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

# 检查Docker服务
log_info "检查Docker服务状态..."
docker-compose -f scripts/database/docker-compose.cloudsql.yml ps

# 检查连接池健康状态
log_info "检查连接池健康状态..."
if curl -s http://localhost:8080/health | jq . >/dev/null 2>&1; then
    HEALTH_STATUS=$(curl -s http://localhost:8080/health | jq -r '.status')
    if [[ "$HEALTH_STATUS" == "healthy" ]]; then
        log_success "连接池服务健康"
    else
        log_error "连接池服务异常: $HEALTH_STATUS"
    fi
else
    log_error "无法连接到连接池服务"
fi

# 检查数据库连接
log_info "检查数据库连接..."
if command -v psql &>/dev/null; then
    if [[ -f ".env.cloudsql" ]]; then
        source .env.cloudsql
        if PGPASSWORD="" psql -h localhost -p 5432 -U "$CLOUDSQL_SERVICE_ACCOUNT" -d "$CLOUDSQL_DATABASE_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "数据库连接正常"
        else
            log_error "数据库连接失败"
        fi
    else
        log_warning "环境文件不存在，跳过数据库连接检查"
    fi
else
    log_warning "PostgreSQL客户端未安装，跳过数据库连接检查"
fi

# 检查监控服务
log_info "检查监控服务..."
if curl -f http://localhost:9090/targets >/dev/null 2>&1; then
    log_success "Prometheus监控服务正常"
else
    log_error "Prometheus监控服务异常"
fi

if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
    log_success "Grafana监控面板正常"
else
    log_error "Grafana监控面板异常"
fi
EOF

    # 设置执行权限
    chmod +x scripts/start-cloudsql.sh scripts/stop-cloudsql.sh scripts/check-cloudsql-status.sh

    log_success "启动脚本创建完成"
}

# 主函数
main() {
    log_info "开始设置Cloud SQL Proxy..."
    log_info "========================================"

    check_prerequisites
    setup_environment
    create_cloudsql_instance
    create_database
    create_service_account
    grant_permissions
    generate_connection_info
    create_docker_compose
    create_monitoring_config
    create_startup_scripts

    log_success "========================================"
    log_success "Cloud SQL Proxy设置完成！"
    log_info ""
    log_info "下一步操作："
    log_info "1. 运行 'source .env.cloudsql' 加载环境变量"
    log_info "2. 运行 'bash scripts/start-cloudsql.sh' 启动服务"
    log_info "3. 运行 'bash scripts/check-cloudsql-status.sh' 检查状态"
    log_info ""
    log_info "更多信息请查看 docs/Database/COMPREHENSIVE_DATABASE_STRATEGY.md"
}

# 执行主函数
main "$@"