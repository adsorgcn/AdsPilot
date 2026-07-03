#!/usr/bin/env python3
import urllib.parse
import os
import psycopg2

# 从环境变量获取数据库URL
db_url = "postgresql://postgres:%24GL%28~x%5DT2Q%5BM%40uX4@/gm_db?host=/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm&sslmode=disable"

# 解析URL获取密码
parsed = urllib.parse.urlparse(db_url)
password = urllib.parse.unquote(parsed.password)
print(f"Password: {password}")

# 创建公网连接
conn_string = f"host=35.243.74.175 port=5432 dbname=gm_db user=postgres password={password} sslmode=require"
print(f"Connection string: host=35.243.74.175 port=5432 dbname=gm_db user=postgres sslmode=require")

try:
    # 连接数据库
    conn = psycopg2.connect(conn_string)
    cursor = conn.cursor()

    # 清理数据库
    cursor.execute("DELETE FROM public.schema_migrations WHERE version=1 AND dirty=true;")
    cursor.execute("DROP SCHEMA IF EXISTS \"user\" CASCADE;")

    # 验证清理结果
    cursor.execute("SELECT * FROM public.schema_migrations WHERE version=1;")
    result = cursor.fetchall()

    conn.commit()
    cursor.close()
    conn.close()

    print("✅ Database cleaned successfully!")
    print(f"Remaining schema_migrations: {result}")

except Exception as e:
    print(f"❌ Error: {e}")