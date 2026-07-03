#!/usr/bin/env python3
"""
使用Supabase REST API查询真实数据库结构
Query real Supabase database schema using REST API
"""

import json
import requests

# 加载凭证
with open('secrets/supabase-credentials.json', 'r') as f:
    creds = json.load(f)

PROJECT_URL = creds['project_url']
SERVICE_ROLE_KEY = creds['service_role_key']

headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
    'Content-Type': 'application/json'
}

print("=" * 80)
print("🔍 查询Supabase数据库真实结构")
print("=" * 80)
print(f"Project URL: {PROJECT_URL}\n")

# 查询1: 使用PostgREST的introspection
print("=" * 80)
print("📊 查询可用的表（通过PostgREST introspection）")
print("=" * 80)

# PostgREST会为每个表生成一个REST endpoint
# 我们可以通过OpenAPI规范来发现所有表
try:
    response = requests.get(
        f"{PROJECT_URL}/rest/v1/",
        headers=headers
    )

    if response.status_code == 200:
        # PostgREST根endpoint返回OpenAPI规范
        print("✅ 成功连接到Supabase REST API")

        # 尝试获取OpenAPI schema
        openapi_response = requests.get(
            f"{PROJECT_URL}/rest/v1/?apikey={SERVICE_ROLE_KEY}",
            headers={'Accept': 'application/openapi+json'}
        )

        if openapi_response.status_code == 200:
            schema = openapi_response.json()

            if 'paths' in schema:
                print("\n可用的表 (从OpenAPI paths推断):")
                tables = []
                for path in schema['paths'].keys():
                    if path.startswith('/'):
                        table_name = path.strip('/')
                        if table_name and '?' not in table_name:
                            tables.append(table_name)

                for table in sorted(set(tables)):
                    print(f"  - {table}")
                print(f"\n总计: {len(set(tables))} 个表")

            if 'definitions' in schema or 'components' in schema:
                print("\n表结构定义:")
                definitions = schema.get('definitions', schema.get('components', {}).get('schemas', {}))
                for table_name, table_def in definitions.items():
                    if 'properties' in table_def:
                        print(f"\n  📋 {table_name}:")
                        for col_name, col_def in table_def['properties'].items():
                            col_type = col_def.get('type', 'unknown')
                            col_format = col_def.get('format', '')
                            print(f"      - {col_name}: {col_type} {col_format}".strip())
        else:
            print(f"⚠️  无法获取OpenAPI schema: {openapi_response.status_code}")
    else:
        print(f"❌ REST API连接失败: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"❌ 错误: {e}")

# 查询2: 尝试查询已知的表
print("\n" + "=" * 80)
print("🔍 探测常见表是否存在")
print("=" * 80)

common_tables = [
    'users', 'user_profiles', 'supabase_config',
    'offers', 'subscriptions', 'token_balances',
    'tasks', 'activities', 'notifications',
    'feature_flags', 'admin_recovery_codes'
]

existing_tables = []

for table in common_tables:
    try:
        # 尝试查询表（限制0行，只检查是否存在）
        response = requests.get(
            f"{PROJECT_URL}/rest/v1/{table}?select=*&limit=0",
            headers=headers,
            timeout=5
        )

        if response.status_code == 200:
            existing_tables.append(table)
            print(f"  ✅ {table} - 存在")

            # 获取表的列信息（通过查询一行）
            count_response = requests.get(
                f"{PROJECT_URL}/rest/v1/{table}?select=*&limit=1",
                headers={**headers, 'Prefer': 'count=exact'},
                timeout=5
            )

            if count_response.status_code == 200:
                data = count_response.json()
                content_range = count_response.headers.get('Content-Range', '')

                if data and len(data) > 0:
                    columns = list(data[0].keys())
                    print(f"      列: {', '.join(columns)}")

                # 解析行数
                if content_range:
                    try:
                        total = content_range.split('/')[-1]
                        if total != '*':
                            print(f"      行数: {total}")
                    except:
                        pass
        elif response.status_code == 404:
            print(f"  ❌ {table} - 不存在")
        elif response.status_code == 401 or response.status_code == 403:
            print(f"  🔒 {table} - 权限不足")
        else:
            print(f"  ⚠️  {table} - 状态码 {response.status_code}")
    except Exception as e:
        print(f"  ⚠️  {table} - 错误: {str(e)[:50]}")

print(f"\n发现的表: {', '.join(existing_tables) if existing_tables else '无'}")

# 查询3: 使用SQL Function查询（如果有权限）
print("\n" + "=" * 80)
print("📊 尝试使用RPC查询系统信息")
print("=" * 80)

# 尝试调用postgres系统函数（如果Supabase暴露了）
try:
    # 检查是否有自定义的schema查询函数
    response = requests.post(
        f"{PROJECT_URL}/rest/v1/rpc/version",
        headers=headers,
        json={}
    )

    if response.status_code == 200:
        print(f"✅ 数据库版本: {response.json()}")
    else:
        print(f"⚠️  无法查询版本信息 (状态码: {response.status_code})")
except Exception as e:
    print(f"⚠️  RPC调用失败: {e}")

print("\n" + "=" * 80)
print("✅ 查询完成")
print("=" * 80)
