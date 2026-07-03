FROM postgres:17-alpine

# 复制迁移脚本
COPY schemas/sql/019_schema_isolation.up.sql /migrations/

# 设置工作目录
WORKDIR /migrations

# 设置入口点
ENTRYPOINT ["psql"]
