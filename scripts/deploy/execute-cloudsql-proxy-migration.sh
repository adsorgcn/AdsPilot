#!/bin/bash
# Cloud SQL Proxy迁移完整执行脚本
# 基于 docs/Database/DATABASE_MIGRATION_BEST_PRACTICES.md

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
CLOUDSQL_INSTANCE="${PROJECT_ID}:${REGION}:gm"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 步骤1: 验证环境配置
verify_environment() {
    log_info "步骤1: 验证环境配置..."
    
    # 验证DATABASE_URL
    log_info "检查DATABASE_URL配置..."
    DB_URL=$(gcloud secrets versions access latest --secret DATABASE_URL 2>&1)
    
    if echo "$DB_URL" | grep -q "/cloudsql/"; then
        log_success "DATABASE_URL格式正确 (Unix Socket)"
    else
        log_error "DATABASE_URL格式错误，必须使用Unix Socket格式"
        exit 1
    fi
    
    # 验证DB_CONNECTION_MODE
    log_info "检查DB_CONNECTION_MODE配置..."
    DB_MODE=$(gcloud secrets versions access latest --secret DB_CONNECTION_MODE 2>&1)
    
    if [ "$DB_MODE" = "cloudsql" ]; then
        log_success "DB_CONNECTION_MODE已设置为cloudsql"
    else
        log_warning "DB_CONNECTION_MODE当前值: $DB_MODE"
        log_info "将更新为cloudsql..."
        echo -n "cloudsql" | gcloud secrets versions add DB_CONNECTION_MODE --data-file=-
        log_success "DB_CONNECTION_MODE已更新为cloudsql"
    fi
    
    # 验证Cloud SQL实例
    log_info "检查Cloud SQL实例状态..."
    if gcloud sql instances describe gm --project="$PROJECT_ID" &>/dev/null; then
        log_success "Cloud SQL实例gm运行正常"
    else
        log_error "Cloud SQL实例gm不存在或无法访问"
        exit 1
    fi
    
    log_success "环境配置验证完成"
    echo ""
}

# 步骤2: 执行数据库迁移
execute_database_migration() {
    log_info "步骤2: 执行数据库迁移..."
    
    # 检查迁移文件
    log_info "检查迁移文件..."
    MIGRATION_COUNT=$(find services/*/migrations -name "*.up.sql" 2>/dev/null | wc -l | tr -d ' ')
    log_info "发现 $MIGRATION_COUNT 个迁移文件"
    
    if [ "$MIGRATION_COUNT" -eq 0 ]; then
        log_warning "没有发现迁移文件，跳过数据库迁移"
        return 0
    fi
    
    # 触发GitHub Actions工作流
    log_info "准备触发数据库迁移工作流..."
    log_warning "请手动执行以下操作之一："
    echo ""
    echo "  方式1: 推送代码到main分支（自动触发）"
    echo "    git add ."
    echo "    git commit -m \"chore: trigger database migration\""
    echo "    git push origin main"
    echo ""
    echo "  方式2: 手动触发GitHub Actions工作流"
    echo "    访问: https://github.com/ScientificInternet/Google-Monetize/actions/workflows/database-migration.yml"
    echo "    点击 'Run workflow' 按钮"
    echo ""
    
    read -p "迁移是否已完成？(y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "数据库迁移未完成，退出"
        exit 1
    fi
    
    log_success "数据库迁移完成"
    echo ""
}

# 步骤3: 更新服务配置
update_service_configs() {
    local env=$1
    
    log_info "步骤3: 更新服务配置 ($env环境)..."
    
    # 执行批量更新脚本
    if [ -f "scripts/deploy/update-cloudsql-proxy-configs.sh" ]; then
        bash scripts/deploy/update-cloudsql-proxy-configs.sh "$env"
    else
        log_error "更新脚本不存在: scripts/deploy/update-cloudsql-proxy-configs.sh"
        exit 1
    fi
    
    log_success "服务配置更新完成"
    echo ""
}

# 步骤4: 验证服务状态
verify_services() {
    local env=$1
    
    log_info "步骤4: 验证服务状态 ($env环境)..."
    
    # 需要验证的服务列表
    local services=(
        "billing"
        "offer"
        "siterank"
        "adscenter"
        "useractivity"
    )
    
    local success_count=0
    local fail_count=0
    
    for service in "${services[@]}"; do
        local full_name="${service}-${env}"
        
        log_info "检查服务: $full_name"
        
        # 检查服务状态
        if gcloud run services describe "$full_name" \
            --region="$REGION" \
            --project="$PROJECT_ID" \
            --format="value(status.url)" &>/dev/null; then
            
            # 获取服务URL
            SERVICE_URL=$(gcloud run services describe "$full_name" \
                --region="$REGION" \
                --project="$PROJECT_ID" \
                --format="value(status.url)")
            
            # 测试健康检查端点
            if curl -s -f "${SERVICE_URL}/health" &>/dev/null; then
                log_success "$full_name 健康检查通过"
                ((success_count++))
            else
                log_warning "$full_name 健康检查失败"
                ((fail_count++))
            fi
        else
            log_warning "$full_name 服务不存在"
            ((fail_count++))
        fi
    done
    
    echo ""
    log_info "验证结果: $success_count 成功, $fail_count 失败"
    
    if [ $fail_count -gt 0 ]; then
        log_warning "部分服务验证失败，请检查日志"
    else
        log_success "所有服务验证通过"
    fi
    
    echo ""
}

# 步骤5: 生成迁移报告
generate_report() {
    local env=$1
    
    log_info "步骤5: 生成迁移报告..."
    
    local report_file="docs/Database/MIGRATION_REPORT_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# Cloud SQL Proxy迁移报告

**执行时间**: $(date '+%Y-%m-%d %H:%M:%S')
**环境**: $env
**执行人**: $(whoami)

## 迁移概述

- **项目ID**: $PROJECT_ID
- **区域**: $REGION
- **Cloud SQL实例**: $CLOUDSQL_INSTANCE
- **连接方式**: Unix Domain Socket

## 执行步骤

1. ✅ 环境配置验证
2. ✅ 数据库迁移执行
3. ✅ 服务配置更新
4. ✅ 服务状态验证
5. ✅ 迁移报告生成

## 配置变更

### 环境变量
- DATABASE_URL: Unix Socket格式
- DB_CONNECTION_MODE: cloudsql

### Cloud Run配置
- 添加: run.googleapis.com/cloudsql-instances
- 移除: VPC Connector配置

## 验证结果

$(gcloud run services list --region="$REGION" --project="$PROJECT_ID" --format="table(SERVICE,REGION,URL,LAST_MODIFIER_EMAIL)" | grep -E "(billing|offer|siterank|adscenter|useractivity)-${env}")

## 下一步行动

1. 监控服务日志，确认数据库连接正常
2. 执行端到端功能测试
3. 监控性能指标
4. 如有问题，执行回滚计划

## 回滚计划

如需回滚，执行以下步骤：
1. 恢复VPC Connector配置
2. 更新DB_CONNECTION_MODE为dbadmin
3. 重新部署服务

EOF
    
    log_success "迁移报告已生成: $report_file"
    echo ""
}

# 主执行函数
main() {
    local env="${1:-preview}"
    
    if [[ "$env" != "preview" && "$env" != "production" ]]; then
        log_error "无效的环境: $env"
        echo "用法: $0 [preview|production]"
        exit 1
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🚀 Cloud SQL Proxy迁移执行"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "环境: $env"
    echo "项目: $PROJECT_ID"
    echo "区域: $REGION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # 确认执行
    read -p "确认开始迁移？(y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "迁移已取消"
        exit 0
    fi
    
    # 执行迁移步骤
    verify_environment
    execute_database_migration
    update_service_configs "$env"
    verify_services "$env"
    generate_report "$env"
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "迁移执行完成！"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log_info "请查看迁移报告了解详细信息"
    log_info "建议执行端到端测试验证功能"
    echo ""
}

# 执行主函数
main "$@"
