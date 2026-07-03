#!/usr/bin/env node

/**
 * 生成测试用JWT Token
 * 为Demo Data测试创建临时的JWT token
 */

import crypto from 'crypto';
import fs from 'fs/promises';

function generateTestToken() {
  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // JWT Payload - 测试用户信息
  const payload = {
    sub: 'test-user-12345',
    email: 'test@urlchecker.dev',
    role: 'authenticated',
    app_metadata: {
      provider: 'email',
      roles: ['authenticated']
    },
    user_metadata: {
      name: 'Test User',
      demo_user: true
    },
    aud: 'authenticated',
    iss: 'https://api.supabase.com/auth/v1',
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时有效期
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomUUID()
  };

  // Base64URL编码
  function base64UrlEncode(obj) {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);

  // 创建一个简单的签名（仅用于测试）
  const signature = crypto
    .createHash('sha256')
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

async function main() {
  try {
    console.log('🔑 Generating test JWT token...');

    const token = generateTestToken();

    console.log('✅ Test token generated successfully');
    console.log(`🎯 Token (first 50 chars): ${token.substring(0, 50)}...`);

    // 保存token到多个位置
    await fs.writeFile('/tmp/demo-test-token.txt', token);
    console.log('💾 Token saved to /tmp/demo-test-token.txt');

    // 输出环境变量格式
    console.log('\n=== ENVIRONMENT VARIABLE ===');
    console.log(`export TEST_AUTH_TOKEN="${token}"`);
    console.log('=== END ENVIRONMENT VARIABLE ===\n');

    // 输出纯token供脚本使用
    console.log('=== RAW TOKEN ===');
    console.log(token);
    console.log('=== END RAW TOKEN ===\n');

    console.log('💡 To use this token in your shell:');
    console.log('   export TEST_AUTH_TOKEN="$(cat /tmp/demo-test-token.txt)"');
    console.log('');
    console.log('💡 To use in other scripts:');
    console.log('   const token = await fs.readFile("/tmp/demo-test-token.txt", "utf-8");');

  } catch (error) {
    console.error('❌ Failed to generate test token:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { generateTestToken };