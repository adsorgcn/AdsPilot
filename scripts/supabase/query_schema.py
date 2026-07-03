#!/usr/bin/env python3
"""
Query Supabase database schema
查询Supabase数据库的实际表结构
"""

import json
import sys
import psycopg2
from psycopg2 import sql

# Load credentials
with open('secrets/supabase-credentials.json', 'r') as f:
    creds = json.load(f)

# Connection parameters
# Supabase uses connection pooler on port 6543 with pgbouncer
conn_params = {
    'host': creds['db_host'],
    'port': 6543,  # Supabase connection pooler port
    'database': creds['db_name'],
    'user': creds['db_user'],
    'password': creds['db_password']
}

print(f"🔌 Connecting to Supabase database...")
print(f"   Host: {conn_params['host']}")
print(f"   Port: {conn_params['port']}")
print(f"   Database: {conn_params['database']}")
print()

try:
    # Connect to database
    conn = psycopg2.connect(**conn_params)
    cursor = conn.cursor()

    print("✅ Connected successfully!\n")

    # Query 1: List all schemas
    print("=" * 80)
    print("📂 SCHEMAS")
    print("=" * 80)
    cursor.execute("""
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY schema_name
    """)
    schemas = cursor.fetchall()
    for schema in schemas:
        print(f"  - {schema[0]}")
    print()

    # Query 2: List tables in each schema
    print("=" * 80)
    print("📊 TABLES BY SCHEMA")
    print("=" * 80)
    cursor.execute("""
        SELECT table_schema, table_name, table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        ORDER BY table_schema, table_name
    """)
    tables = cursor.fetchall()

    current_schema = None
    for table_schema, table_name, table_type in tables:
        if current_schema != table_schema:
            current_schema = table_schema
            print(f"\n{table_schema} schema:")
        print(f"  - {table_name} ({table_type})")
    print()

    # Query 3: Count rows in public tables
    print("=" * 80)
    print("📈 ROW COUNTS (public schema only)")
    print("=" * 80)
    cursor.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    public_tables = cursor.fetchall()

    for (table_name,) in public_tables:
        try:
            cursor.execute(sql.SQL("SELECT COUNT(*) FROM public.{}").format(
                sql.Identifier(table_name)
            ))
            count = cursor.fetchone()[0]
            print(f"  public.{table_name}: {count:,} rows")
        except Exception as e:
            print(f"  public.{table_name}: Error - {e}")
    print()

    # Query 4: Database size
    print("=" * 80)
    print("💾 DATABASE SIZE")
    print("=" * 80)
    cursor.execute("""
        SELECT pg_size_pretty(pg_database_size(current_database()))
    """)
    db_size = cursor.fetchone()[0]
    print(f"  Total database size: {db_size}")
    print()

    # Query 5: Schema sizes
    print("=" * 80)
    print("📦 SCHEMA SIZES")
    print("=" * 80)
    cursor.execute("""
        SELECT
            schemaname,
            pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as size
        FROM pg_tables
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
        GROUP BY schemaname
        ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC
    """)
    schema_sizes = cursor.fetchall()
    for schema_name, size in schema_sizes:
        print(f"  {schema_name}: {size}")
    print()

    # Close connection
    cursor.close()
    conn.close()

    print("✅ Query completed successfully!")

except psycopg2.OperationalError as e:
    print(f"❌ Connection failed: {e}")
    print()
    print("💡 Troubleshooting:")
    print("  1. Check if firewall allows connection to port 6543")
    print("  2. Verify Supabase project is active")
    print("  3. Confirm database password is correct")
    sys.exit(1)

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
