#!/bin/bash

# 部署状态监控脚本
# 持续监控部署后的应用状态

set -e

ENVIRONMENT=${1:-preview}
DURATION=${2:-300}  # 默认监控5分钟
INTERVAL=${3:-30}   # 默认30秒检查一次
BASE_URL=""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

# 显示使用说明
show_usage() {
    echo "部署状态监控脚本"
    echo ""
    echo "用法: $0 [环境] [持续时间(秒)] [检查间隔(秒)]"
    echo ""
    echo "参数:"
    echo "  环境        - preview 或 production (默认: preview)"
    echo "  持续时间    - 监控持续时间，单位秒 (默认: 300)"
    echo "  检查间隔    - 检查间隔，单位秒 (默认: 30)"
    echo ""
    echo "示例:"
    echo "  $0 preview 600 60    # 监控预发环境10分钟，每分钟检查一次"
    echo "  $0 production        # 监控生产环境5分钟，每30秒检查一次"
}

# 验证环境参数
validate_environment() {
    case $ENVIRONMENT in
        preview)
            BASE_URL="https://urlchecker.dev"
            ;;
        production)
            BASE_URL="https://${APP_DOMAIN}"
            ;;
        *)
            log_error "无效的环境: $ENVIRONMENT"
            show_usage
            exit 1
            ;;
    esac
}

# 检查应用健康状态
check_health() {
    local health_status="unknown"
    local response_time=0
    local http_status=0
    
    # 测量响应时间和状态码
    local curl_output=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$BASE_URL/health" 2>/dev/null || echo "000:0")
    http_status=$(echo "$curl_output" | cut -d: -f1)
    response_time=$(echo "$curl_output" | cut -d: -f2)
    
    if [ "$http_status" = "200" ]; then
        health_status="healthy"
    else
        health_status="unhealthy"
    fi
    
    echo "$health_status:$response_time:$http_status"
}

# 检查数据库连接
check_database() {
    local db_json=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "{}")
    local status=$(echo "$db_json" | jq -r '.checks.database.status // "unknown"' 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then echo "connected"; else echo "disconnected"; fi
}

# 检查Redis连接
check_redis() {
    local r_json=$(curl -s "$BASE_URL/health" 2>/dev/null || echo "{}")
    local status=$(echo "$r_json" | jq -r '.checks.redis.status // "unknown"' 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then echo "connected"; else echo "disconnected"; fi
}

# 检查错误率
check_error_rate() {
    # 这里可以集成APM工具或日志分析
    # 暂时返回模拟数据
    echo "0.5"  # 0.5% 错误率
}

# 单次健康检查
perform_health_check() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # 获取各项指标
    local health_info=$(check_health)
    local health_status=$(echo "$health_info" | cut -d: -f1)
    local response_time=$(echo "$health_info" | cut -d: -f2)
    local http_status=$(echo "$health_info" | cut -d: -f3)
    
    local db_status=$(check_database)
    local redis_status=$(check_redis)
    local error_rate=$(check_error_rate)
    
    # 计算响应时间（毫秒）
    local response_time_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    
    # 显示状态
    if [ "$health_status" = "healthy" ]; then
        log_success "✅ 应用健康 | 响应时间: ${response_time_ms}ms | 数据库: $db_status | Redis: $redis_status"
    else
        log_error "❌ 应用异常 | HTTP状态: $http_status | 数据库: $db_status | Redis: $redis_status"
    fi
    
    # 检查响应时间告警
    if [ "$response_time_ms" -gt 2000 ]; then
        log_warning "⚠️  响应时间过长: ${response_time_ms}ms"
    fi
    
    # 检查数据库连接
    if [ "$db_status" != "connected" ]; then
        log_error "🔴 数据库连接异常: $db_status"
    fi
    
    # 检查Redis连接
    if [ "$redis_status" != "connected" ]; then
        log_error "🔴 Redis连接异常: $redis_status"
    fi
    
    # 记录到日志文件
    local log_file="monitoring-${ENVIRONMENT}-$(date +%Y%m%d).log"
    echo "$timestamp,$health_status,$response_time_ms,$db_status,$redis_status,$error_rate" >> "$log_file"
    
    # 返回整体状态
    if [ "$health_status" = "healthy" ] && [ "$db_status" = "connected" ] && [ "$redis_status" = "connected" ]; then
        return 0
    else
        return 1
    fi
}

# 生成监控报告
generate_monitoring_report() {
    local end_time=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="monitoring-${ENVIRONMENT}-$(date +%Y%m%d).log"
    local report_file="monitoring-report-${ENVIRONMENT}-$(date +%Y%m%d_%H%M%S).json"
    
    # 统计数据
    local total_checks=0
    local successful_checks=0
    local failed_checks=0
    
    if [ -f "$log_file" ]; then
        total_checks=$(wc -l < "$log_file")
        successful_checks=$(grep -c ",healthy," "$log_file" || echo "0")
        failed_checks=$((total_checks - successful_checks))
    fi
    
    local success_rate=0
    if [ "$total_checks" -gt 0 ]; then
        success_rate=$(echo "scale=2; $successful_checks * 100 / $total_checks" | bc -l)
    fi
    
    # 生成JSON报告
    cat > "$report_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "baseUrl": "$BASE_URL",
  "monitoringPeriod": {
    "startTime": "$start_time",
    "endTime": "$end_time",
    "durationSeconds": $DURATION
  },
  "statistics": {
    "totalChecks": $total_checks,
    "successfulChecks": $successful_checks,
    "failedChecks": $failed_checks,
    "successRate": $success_rate
  },
  "configuration": {
    "checkInterval": $INTERVAL,
    "monitoringDuration": $DURATION
  },
  "status": "completed"
}
EOF
    
    log_success "监控报告已生成: $report_file"
    log_info "总检查次数: $total_checks | 成功: $successful_checks | 失败: $failed_checks | 成功率: ${success_rate}%"
}

# 主监控循环
main_monitoring_loop() {
    local start_time=$(date +%s)
    local end_time=$((start_time + DURATION))
    local check_count=0
    local failure_count=0
    local consecutive_failures=0
    
    log_info "开始监控 $ENVIRONMENT 环境"
    log_info "监控地址: $BASE_URL"
    log_info "监控时长: ${DURATION}秒 | 检查间隔: ${INTERVAL}秒"
    log_info "预计检查次数: $((DURATION / INTERVAL))"
    echo ""
    
    while [ $(date +%s) -lt $end_time ]; do
        check_count=$((check_count + 1))
        
        if perform_health_check; then
            consecutive_failures=0
        else
            failure_count=$((failure_count + 1))
            consecutive_failures=$((consecutive_failures + 1))
            
            # 连续失败告警
            if [ "$consecutive_failures" -ge 3 ]; then
                log_error "🚨 连续 $consecutive_failures 次检查失败！"
                
                # 这里可以发送告警通知
                # send_alert "连续健康检查失败" "$ENVIRONMENT" "$consecutive_failures"
            fi
        fi
        
        # 等待下次检查
        if [ $(date +%s) -lt $end_time ]; then
            sleep $INTERVAL
        fi
    done
    
    echo ""
    log_info "监控完成"
    log_info "总检查次数: $check_count | 失败次数: $failure_count"
    
    if [ "$failure_count" -eq 0 ]; then
        log_success "🎉 监控期间应用运行稳定，无异常！"
    else
        log_warning "⚠️  监控期间发现 $failure_count 次异常"
    fi
}

# 发送告警通知（可选）
send_alert() {
    local message="$1"
    local environment="$2"
    local details="$3"
    
    # 这里可以集成Slack、邮件、短信等告警方式
    log_warning "告警: $message (环境: $environment, 详情: $details)"
}

# 检查依赖
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        log_info "请安装缺少的依赖后重试"
        exit 1
    fi
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

# 验证参数
if ! [[ "$DURATION" =~ ^[0-9]+$ ]] || [ "$DURATION" -lt 60 ]; then
    log_error "监控时长必须是大于等于60的数字"
    exit 1
fi

if ! [[ "$INTERVAL" =~ ^[0-9]+$ ]] || [ "$INTERVAL" -lt 10 ]; then
    log_error "检查间隔必须是大于等于10的数字"
    exit 1
fi

check_dependencies
validate_environment

# 记录开始时间
start_time=$(date '+%Y-%m-%d %H:%M:%S')

# 执行监控
main_monitoring_loop

# 生成报告
generate_monitoring_report
