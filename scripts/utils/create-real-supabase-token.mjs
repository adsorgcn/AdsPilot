#!/usr/bin/env node

/**
 * 使用真实Supabase配置创建有效的JWT token
 * 基于项目的实际Supabase设置生成测试token
 */

import crypto from 'crypto';
import fs from 'fs/promises';

// 从项目配置中提取的真实Supabase信息
const SUPABASE_CONFIG = {
  url: process.env.SUPABASE_URL,
  projectId: process.env.SUPABASE_PROJECT_ID,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_KEY,
  jwtSecret: process.env.INTERNAL_JWT_SECRET || 'your-jwt-secret-key-here'
};

class RealSupabaseTokenGenerator {
  constructor(config = {}) {
    this.config = { ...SUPABASE_CONFIG, ...config };
  }

  // 方法1: 使用服务密钥创建模拟的Supabase token
  createServiceToken() {
    console.log('🔑 Creating token with service role key...');

    const header = Buffer.from(JSON.stringify({
      alg: 'HS256',
      typ: 'JWT'
    })).toString('base64url');

    const payload = Buffer.from(JSON.stringify({
      sub: 'test-user-service-12345',
      email: 'test-service@urlchecker.dev',
      role: 'service_role',
      aud: 'authenticated',
      iss: `https://${this.config.projectId}.supabase.co/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      app_metadata: {
        provider: 'email',
        roles: ['service_role', 'authenticated']
      },
      user_metadata: {
        name: 'Test Service User',
        test_user: true,
        created_for: 'demo_data_testing'
      }
    })).toString('base64url');

    // 使用服务密钥作为签名密钥
    const signature = crypto
      .createHmac('sha256', this.config.serviceKey)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const token = `${header}.${payload}.${signature}`;

    console.log('✅ Service role token created');
    return token;
  }

  // 方法2: 创建基于内部JWT密钥的token (如果后端使用自定义验证)
  createInternalToken() {
    console.log('🔧 Creating internal JWT token...');

    const header = Buffer.from(JSON.stringify({
      alg: 'HS256',
      typ: 'JWT'
    })).toString('base64url');

    const payload = Buffer.from(JSON.stringify({
      sub: 'test-user-internal-12345',
      email: 'test-internal@urlchecker.dev',
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'gm-internal',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      app_metadata: {
        provider: 'internal',
        roles: ['authenticated']
      },
      user_metadata: {
        name: 'Test Internal User',
        test_user: true
      }
    })).toString('base64url');

    // 使用内部JWT密钥签名
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const token = `${header}.${payload}.${signature}`;

    console.log('✅ Internal JWT token created');
    return token;
  }

  // 方法3: 尝试从Supabase获取真实token (需要网络访问)
  async getRealSupabaseToken() {
    console.log('🌐 Attempting to get real Supabase token...');

    try {
      // 尝试使用Supabase REST API创建token
      const response = await fetch(`${this.config.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': this.config.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@urlchecker.dev',
          password: 'TestPassword123!'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          console.log('✅ Real Supabase token obtained');
          return data.access_token;
        }
      } else {
        const error = await response.text();
        console.log('⚠️ Real token request failed:', error);
      }
    } catch (error) {
      console.log('⚠️ Network request failed:', error.message);
    }

    return null;
  }

  async generateToken() {
    console.log('🎯 Starting token generation process...');
    console.log(`📋 Using Supabase project: ${this.config.projectId}`);

    // 尝试1: 获取真实Supabase token
    const realToken = await this.getRealSupabaseToken();
    if (realToken) {
      await this.saveToken(realToken, 'real-supabase');
      return { token: realToken, type: 'real-supabase' };
    }

    // 尝试2: 使用服务密钥创建token
    const serviceToken = this.createServiceToken();
    await this.saveToken(serviceToken, 'service-role');
    return { token: serviceToken, type: 'service-role' };

    // 备选: 内部token (注释掉，除非需要)
    // const internalToken = this.createInternalToken();
    // await this.saveToken(internalToken, 'internal');
    // return { token: internalToken, type: 'internal' };
  }

  async saveToken(token, type) {
    const tokenData = {
      token,
      type,
      supabaseProject: this.config.projectId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
    };

    // 保存到多个位置
    await fs.writeFile('/tmp/demo-supabase-token.json', JSON.stringify(tokenData, null, 2));
    await fs.writeFile('/tmp/demo-test-token.txt', token);

    console.log('💾 Token saved successfully');
    console.log(`📄 Type: ${type}`);
    console.log(`📋 Project: ${this.config.projectId}`);
  }

  async validateToken(token) {
    console.log('🔍 Validating token...');

    try {
      // 尝试访问Demo API端点
      const response = await fetch('https://gateway-middleware-preview-yt54xvsg5q-an.a.run.app/api/v1/demo/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log(`📊 Validation response: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Token validation successful!');
        console.log('📄 API Response:', JSON.stringify(data, null, 2));
        return true;
      } else {
        const error = await response.text();
        console.log('❌ Token validation failed:', error);
        return false;
      }
    } catch (error) {
      console.log('❌ Validation error:', error.message);
      return false;
    }
  }
}

// 主执行函数
async function main() {
  const generator = new RealSupabaseTokenGenerator();

  try {
    console.log('🚀 Real Supabase Token Generator');
    console.log('================================');

    // 生成token
    const { token, type } = await generator.generateToken();

    console.log(`\n✅ Token generated successfully!`);
    console.log(`🎯 Type: ${type}`);
    console.log(`🔑 Token (first 50 chars): ${token.substring(0, 50)}...`);

    // 验证token
    console.log('\n🔍 Validating token...');
    const isValid = await generator.validateToken(token);

    if (isValid) {
      console.log('\n🎉 SUCCESS: Token is valid and ready for Demo Data testing!');

      // 输出使用说明
      console.log('\n=== USAGE INSTRUCTIONS ===');
      console.log('Set environment variable:');
      console.log(`export TEST_AUTH_TOKEN="${token}"`);
      console.log('');
      console.log('Or use directly in tests:');
      console.log('const token = await fs.readFile("/tmp/demo-test-token.txt", "utf-8");');
      console.log('===========================');

      process.exit(0);
    } else {
      console.log('\n❌ Token validation failed');
      console.log('💡 The token was generated but may not work with the current authentication setup');
      console.log('🔧 Check the Supabase configuration and gateway middleware settings');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RealSupabaseTokenGenerator };