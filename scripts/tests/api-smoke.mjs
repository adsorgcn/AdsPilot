#!/usr/bin/env node

import process from 'node:process';
import fs from 'node:fs/promises';

const DEFAULT_TESTS = [
  {
    name: 'Offers 列表',
    path: '/api/v1/offers',
    method: 'GET',
    expectStatus: 200,
  },
  {
    name: 'Tasks 列表',
    path: '/api/v1/tasks',
    method: 'GET',
    expectStatus: 200,
  },
  {
    name: 'Tokens 概览',
    path: '/api/v1/billing/tokens/balance',
    method: 'GET',
    expectStatus: 200,
  },
  {
    name: 'AdsCenter 账户列表',
    path: '/api/v1/adscenter/accounts',
    method: 'GET',
    expectStatus: 200,
  },
];

async function main() {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    console.error('[api-smoke] 错误：缺少 API_BASE_URL 环境变量');
    process.exit(1);
  }

  const bearerToken = process.env.SUPABASE_ACCESS_TOKEN ?? process.env.API_BEARER_TOKEN;

  if (!bearerToken) {
    console.error('[api-smoke] 错误：缺少访问令牌 (SUPABASE_ACCESS_TOKEN 或 API_BEARER_TOKEN)');
    process.exit(1);
  }

  let tests = [...DEFAULT_TESTS];

  const configPath = process.env.API_SMOKE_CONFIG;
  if (configPath) {
    try {
      const fileContent = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(fileContent);

      if (Array.isArray(parsed)) {
        tests = parsed;
      } else {
        console.warn(`[api-smoke] 警告：${configPath} 内容不是数组，沿用默认测试`);
      }
    } catch (error) {
      console.warn(`[api-smoke] 警告：读取 ${configPath} 失败，沿用默认测试`, error.message);
    }
  }

  const inlineConfig = process.env.API_SMOKE_ENDPOINTS;
  if (inlineConfig) {
    tests = inlineConfig.split(',').map((entry, index) => parseInlineEndpoint(entry.trim(), index));
  }

  const expectedUserId = process.env.EXPECTED_USER_ID;

  let hasFailure = false;

  for (const test of tests) {
    const url = new URL(test.path, baseUrl);

    const method = (test.method ?? 'GET').toUpperCase();
    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${bearerToken}`,
      ...(test.headers ?? {}),
    };

    const init = {
      method,
      headers,
    };

    if (test.body) {
      init.body = typeof test.body === 'string' ? test.body : JSON.stringify(test.body);
      headers['content-type'] = headers['content-type'] ?? 'application/json';
    }

    try {
      const response = await fetch(url, init);

      const expectStatus = test.expectStatus ?? 200;

      if (response.status !== expectStatus) {
        throw new Error(`期望状态码 ${expectStatus}，实际 ${response.status}`);
      }

      let payload = null;
      if (response.status !== 204) {
        payload = await response.json().catch(() => null);
      }

      if (expectedUserId && payload) {
        const valid = validateUserId(payload, expectedUserId);
        if (!valid) {
          throw new Error(`响应体未通过 user_id=${expectedUserId} 校验`);
        }
      }

      console.log(`[api-smoke] ✅ ${test.name} (${method} ${test.path})`);
    } catch (error) {
      hasFailure = true;
      console.error(`[api-smoke] ❌ ${test.name} (${method} ${test.path}) -> ${error.message}`);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }

  console.log('\n[api-smoke] 全部接口冒烟测试通过');
}

function validateUserId(payload, expected) {
  if (Array.isArray(payload)) {
    return payload.every((item) => validateUserId(item, expected));
  }

  if (payload && typeof payload === 'object') {
    if ('data' in payload) {
      return validateUserId(payload.data, expected);
    }

    if ('user_id' in payload) {
      return payload.user_id === expected;
    }

    // 如果数据嵌套了 records 字段，也尝试展开
    if ('records' in payload) {
      return validateUserId(payload.records, expected);
    }
  }

  // 未检测到 user_id 字段时默认通过，避免对不同结构造成误判
  return true;
}

function parseInlineEndpoint(entry, index) {
  if (!entry) {
    throw new Error(`API_SMOKE_ENDPOINTS 第 ${index + 1} 项为空`);
  }

  const segments = entry.split(':');

  if (segments.length < 2) {
    throw new Error(`API_SMOKE_ENDPOINTS 第 ${index + 1} 项格式错误，应为 METHOD:/path[:status]`);
  }

  const [method, path, status] = segments;

  return {
    name: `自定义接口 ${index + 1}`,
    method: method.toUpperCase(),
    path,
    expectStatus: status ? Number(status) : 200,
  };
}

try {
  await main();
} catch (error) {
  console.error('[api-smoke] 未捕获异常', error);
  process.exit(1);
}
