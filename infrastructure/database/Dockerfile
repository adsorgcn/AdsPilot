# 数据库迁移Dockerfile - 超轻量级设计（使用Unix Socket）
# 基于DATABASE_MIGRATION_BEST_PRACTICES.md

# 使用Alpine Linux作为基础镜像（最小体积）
FROM alpine:latest

# 安装必要工具
RUN apk add --no-cache \
    postgresql-client \
    ca-certificates \
    curl \
    bash

# 安装golang-migrate工具
RUN curl -L https://github.com/golang-migrate/migrate/releases/download/v4.17.0/migrate.linux-amd64.tar.gz | \
    tar xvz && \
    mv migrate /usr/local/bin/migrate && \
    chmod +x /usr/local/bin/migrate

# 创建工作目录
WORKDIR /migrations

# 复制迁移脚本（构建上下文已经包含优化后的文件结构）
COPY migrate-unix-socket.sh /usr/local/bin/migrate-unix-socket.sh
RUN chmod +x /usr/local/bin/migrate-unix-socket.sh

# 复制所有服务的迁移文件（构建上下文中已经是扁平结构）
COPY billing/ ./billing/
COPY console/ ./console/
COPY adscenter/ ./adscenter/

# 设置环境变量
ENV MIGRATION_DIR=/migrations
ENV CLOUD_SQL_CONNECTION_NAME=""
ENV DB_NAME=gm_db
ENV DB_USER=postgres

# 默认执行迁移脚本
ENTRYPOINT ["/usr/local/bin/migrate-unix-socket.sh"]
CMD ["up"]
