#!/bin/bash

# 部署通知脚本
# 用于发送部署相关的通知

set -e

NOTIFICATION_TYPE=${1:-success}  # success, failure, rollback, warning
ENVIRONMENT=${2:-preview}
MESSAGE=${3:-"部署操作完成"}
DETAILS=${4:-""}

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 显示使用说明
show_usage() {
    echo "部署通知脚本"
    echo ""
    echo "用法: $0 [通知类型] [环境] [消息] [详情]"
    echo ""
    echo "通知类型:"
    echo "  success   - 成功通知 (默认)"
    echo "  failure   - 失败通知"
    echo "  rollback  - 回滚通知"
    echo "  warning   - 警告通知"
    echo ""
    echo "环境:"
    echo "  preview     - 预发环境 (默认)"
    echo "  production  - 生产环境"
    echo ""
    echo "示例:"
    echo "  $0 success preview \"部署成功\" \"版本: v1.2.3\""
    echo "  $0 failure production \"部署失败\" \"错误: 数据库连接失败\""
}

# 获取环境信息
get_environment_info() {
    case $ENVIRONMENT in
        preview)
            echo "urlchecker.dev"
            ;;
        production)
            echo "${APP_DOMAIN}"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# 获取通知颜色和图标
get_notification_style() {
    case $NOTIFICATION_TYPE in
        success)
            echo "good:✅"
            ;;
        failure)
            echo "danger:❌"
            ;;
        rollback)
            echo "warning:🔄"
            ;;
        warning)
            echo "warning:⚠️"
            ;;
        *)
            echo "good:ℹ️"
            ;;
    esac
}

# 发送Slack通知
send_slack_notification() {
    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        log_warning "Slack webhook URL未配置，跳过Slack通知"
        return 0
    fi
    
    local domain=$(get_environment_info)
    local style_info=$(get_notification_style)
    local color=$(echo "$style_info" | cut -d: -f1)
    local icon=$(echo "$style_info" | cut -d: -f2)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local payload=$(cat << EOF
{
    "text": "$icon 部署通知 - $ENVIRONMENT",
    "attachments": [
        {
            "color": "$color",
            "fields": [
                {
                    "title": "环境",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "域名",
                    "value": "$domain",
                    "short": true
                },
                {
                    "title": "状态",
                    "value": "$NOTIFICATION_TYPE",
                    "short": true
                },
                {
                    "title": "时间",
                    "value": "$timestamp",
                    "short": true
                },
                {
                    "title": "消息",
                    "value": "$MESSAGE",
                    "short": false
                }
                $([ -n "$DETAILS" ] && echo ",{\"title\": \"详情\", \"value\": \"$DETAILS\", \"short\": false}")
            ],
            "footer": "部署系统",
            "ts": $(date +%s)
        }
    ]
}
EOF
    )
    
    if curl -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --silent --show-error > /dev/null 2>&1; then
        log_success "Slack通知发送成功"
    else
        log_error "Slack通知发送失败"
    fi
}

# 发送邮件通知
send_email_notification() {
    if [ -z "$NOTIFICATION_EMAIL" ]; then
        log_warning "通知邮箱未配置，跳过邮件通知"
        return 0
    fi
    
    local domain=$(get_environment_info)
    local style_info=$(get_notification_style)
    local icon=$(echo "$style_info" | cut -d: -f2)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local subject="$icon 部署通知 - $ENVIRONMENT - $NOTIFICATION_TYPE"
    local body=$(cat << EOF
部署通知
========

环境: $ENVIRONMENT
域名: $domain
状态: $NOTIFICATION_TYPE
时间: $timestamp

消息: $MESSAGE

$([ -n "$DETAILS" ] && echo -e "详情:\n$DETAILS\n")

---
此邮件由部署系统自动发送
EOF
    )
    
    if echo "$body" | mail -s "$subject" "$NOTIFICATION_EMAIL" 2>/dev/null; then
        log_success "邮件通知发送成功"
    else
        log_warning "邮件通知发送失败（可能未安装mail命令）"
    fi
}

# 发送企业微信通知
send_wechat_notification() {
    if [ -z "$WECHAT_WEBHOOK_URL" ]; then
        log_warning "企业微信webhook URL未配置，跳过企业微信通知"
        return 0
    fi
    
    local domain=$(get_environment_info)
    local style_info=$(get_notification_style)
    local icon=$(echo "$style_info" | cut -d: -f2)
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    local content="$icon **部署通知**\n\n"
    content+="**环境**: $ENVIRONMENT\n"
    content+="**域名**: $domain\n"
    content+="**状态**: $NOTIFICATION_TYPE\n"
    content+="**时间**: $timestamp\n"
    content+="**消息**: $MESSAGE\n"
    [ -n "$DETAILS" ] && content+="\n**详情**: $DETAILS"
    
    local payload=$(cat << EOF
{
    "msgtype": "markdown",
    "markdown": {
        "content": "$content"
    }
}
EOF
    )
    
    if curl -X POST "$WECHAT_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        --silent --show-error > /dev/null 2>&1; then
        log_success "企业微信通知发送成功"
    else
        log_error "企业微信通知发送失败"
    fi
}

# 记录通知日志
log_notification() {
    local log_file="notifications-$(date +%Y%m%d).log"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local domain=$(get_environment_info)
    
    echo "$timestamp,$NOTIFICATION_TYPE,$ENVIRONMENT,$domain,$MESSAGE,$DETAILS" >> "$log_file"
    log_info "通知记录已保存到: $log_file"
}

# 发送所有配置的通知
send_all_notifications() {
    log_info "开始发送部署通知..."
    log_info "类型: $NOTIFICATION_TYPE | 环境: $ENVIRONMENT"
    log_info "消息: $MESSAGE"
    [ -n "$DETAILS" ] && log_info "详情: $DETAILS"
    
    # 发送各种通知
    send_slack_notification
    send_email_notification
    send_wechat_notification
    
    # 记录日志
    log_notification
    
    log_success "通知发送完成"
}

# 验证参数
validate_parameters() {
    if [[ ! "$NOTIFICATION_TYPE" =~ ^(success|failure|rollback|warning)$ ]]; then
        log_error "无效的通知类型: $NOTIFICATION_TYPE"
        show_usage
        exit 1
    fi
    
    if [[ ! "$ENVIRONMENT" =~ ^(preview|production)$ ]]; then
        log_error "无效的环境: $ENVIRONMENT"
        show_usage
        exit 1
    fi
    
    if [ -z "$MESSAGE" ]; then
        log_error "消息不能为空"
        show_usage
        exit 1
    fi
}

# 脚本入口
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    show_usage
    exit 0
fi

validate_parameters
send_all_notifications