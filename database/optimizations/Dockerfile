FROM postgres:17-alpine

# 复制SQL文件
COPY apply-indexes.sql /tmp/

# 复制执行脚本
COPY entrypoint.sh /tmp/

RUN chmod +x /tmp/entrypoint.sh

ENTRYPOINT ["/tmp/entrypoint.sh"]
