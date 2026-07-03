#!/usr/bin/env python3
import urllib.parse
import psycopg2
import sys

def test_connection():
    # 解码数据库URL获取密码
    db_url = "postgresql://postgres:%24GL%28~x%5DT2Q%5BM%40uX4@/gm_db?host=/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm&sslmode=disable"
    parsed = urllib.parse.urlparse(db_url)
    password = urllib.parse.unquote(parsed.password)

    print(f"🔧 解码密码: {password}")

    # 创建公网连接字符串
    conn_string = f"host=35.243.74.175 port=5432 dbname=gm_db user=postgres password={password} sslmode=require"
    print(f"🔗 连接字符串: host=35.243.74.175 port=5432 dbname=gm_db user=postgres sslmode=require")

    try:
        print("🔄 正在连接数据库...")
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()

        # 测试查询
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        print(f"✅ 数据库连接成功!")
        print(f"📊 PostgreSQL 版本: {version[0]}")

        # 检查当前schema状态
        cursor.execute("SELECT schemaname FROM pg_tables WHERE schemaname = 'user';")
        user_tables = cursor.fetchall()
        print(f"🗂️  User schema 表数量: {len(user_tables)}")

        # 检查迁移状态
        cursor.execute("SELECT version, dirty FROM public.schema_migrations WHERE version = 1;")
        migrations = cursor.fetchall()
        print(f"📋 迁移状态: {migrations}")

        cursor.close()
        conn.close()

        return True

    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)