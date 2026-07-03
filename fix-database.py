#!/usr/bin/env python3
import urllib.parse
import psycopg2
import sys
import os

def fix_database():
    # 解码数据库URL获取密码
    db_url = "postgresql://postgres:%24GL%28~x%5DT2Q%5BM%40uX4@/gm_db?host=/cloudsql/${GCP_PROJECT_ID}:asia-northeast1:gm&sslmode=disable"
    parsed = urllib.parse.urlparse(db_url)
    password = urllib.parse.unquote(parsed.password)

    # 创建公网连接字符串
    conn_string = f"host=35.243.74.175 port=5432 dbname=gm_db user=postgres password={password} sslmode=require"

    try:
        print("🔄 连接数据库...")
        conn = psycopg2.connect(conn_string)
        cursor = conn.cursor()

        # 第一步：清理损坏的迁移状态
        print("🧹 步骤1: 清理损坏的迁移状态...")
        cursor.execute("DELETE FROM public.schema_migrations WHERE version=1 AND dirty=true;")
        print(f"   删除了 {cursor.rowcount} 条损坏的迁移记录")

        # 第二步：删除可能存在的损坏schema
        print("🗑️  步骤2: 删除可能存在的损坏schema...")
        cursor.execute("DROP SCHEMA IF EXISTS \"user\" CASCADE;")
        print("   已删除旧的user schema")

        # 第三步：执行user迁移脚本
        print("📋 步骤3: 执行user迁移脚本...")

        # 读取迁移文件
        migration_file = "services/user/migrations/000001_create_user_domain_schema.up.sql"
        if os.path.exists(migration_file):
            with open(migration_file, 'r', encoding='utf-8') as f:
                migration_sql = f.read()

            print(f"   读取迁移文件: {migration_file}")

            # 执行迁移
            cursor.execute(migration_sql)
            print("   ✅ User schema迁移执行成功")

            # 更新迁移状态
            cursor.execute("INSERT INTO public.schema_migrations (version, dirty) VALUES (1, false) ON CONFLICT (version) DO UPDATE SET dirty = false;")
            print("   ✅ 迁移状态更新成功")

        else:
            print(f"   ❌ 迁移文件不存在: {migration_file}")
            return False

        # 第四步：验证结果
        print("🔍 步骤4: 验证迁移结果...")

        # 检查user schema是否存在
        cursor.execute("SELECT nspname FROM pg_namespace WHERE nspname = 'user';")
        schemas = cursor.fetchall()
        if schemas:
            print(f"   ✅ User schema已创建")
        else:
            print(f"   ❌ User schema创建失败")
            return False

        # 检查user表是否存在
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'user' AND tablename = 'users';")
        tables = cursor.fetchall()
        if tables:
            print(f"   ✅ user.users表已创建")
        else:
            print(f"   ❌ user.users表创建失败")
            return False

        # 检查迁移状态
        cursor.execute("SELECT version, dirty FROM public.schema_migrations WHERE version = 1;")
        migrations = cursor.fetchall()
        if migrations and migrations[0][1] == False:
            print(f"   ✅ 迁移状态正常: version={migrations[0][0]}, dirty={migrations[0][1]}")
        else:
            print(f"   ❌ 迁移状态异常: {migrations}")
            return False

        # 提交所有更改
        conn.commit()
        cursor.close()
        conn.close()

        print("🎉 数据库修复完成！")
        print("📊 修复内容:")
        print("   ✅ 清理了损坏的迁移状态")
        print("   ✅ 重新创建了user schema")
        print("   ✅ 执行了user迁移脚本")
        print("   ✅ 更新了迁移状态记录")

        return True

    except Exception as e:
        print(f"❌ 修复失败: {e}")
        return False

if __name__ == "__main__":
    success = fix_database()
    if success:
        print("\n🚀 现在可以运行其他服务的迁移了！")
    sys.exit(0 if success else 1)