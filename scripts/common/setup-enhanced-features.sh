#!/bin/bash

# Redis 和增强功能设置脚本
# 这个脚本会帮助设置 Redis 连接和相关的增强功能

set -e

echo "🚀 Setting up enhanced API features..."

# 检查 Redis 是否已安装
if ! command -v redis-server &> /dev/null; then
    echo "⚠️  Redis is not installed. Please install Redis first:"
    echo "   macOS: brew install redis"
    echo "   Ubuntu: sudo apt-get install redis-server"
    echo "   Docker: docker run -d -p 6379:6379 redis:alpine"
    exit 1
fi

# 检查 Redis 是否运行
if ! redis-cli ping &> /dev/null; then
    echo "🔄 Starting Redis server..."
    
    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start redis
    else
        # Linux
        sudo systemctl start redis-server
    fi
    
    # 等待 Redis 启动
    sleep 2
    
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis server started successfully"
    else
        echo "❌ Failed to start Redis server. Please start it manually."
        exit 1
    fi
else
    echo "✅ Redis server is already running"
fi

# 创建 Redis 配置文件
echo "📝 Creating Redis configuration..."
cat > redis.conf << EOF
# Redis configuration for development
port 6379
bind 127.0.0.1
timeout 0
tcp-keepalive 300
databases 16

# 持久化配置
save 900 1
save 300 10
save 60 10000

# 内存配置
maxmemory 256mb
maxmemory-policy allkeys-lru

# 安全配置
# requirepass your-redis-password

# 日志配置
loglevel notice
logfile ""

# 慢查询日志
slowlog-log-slower-than 10000
slowlog-max-len 128

# 客户端配置
timeout 0
tcp-keepalive 300

EOF

echo "✅ Redis configuration created: redis.conf"

# 安装依赖
echo "📦 Installing required dependencies..."
npm install ioredis

# 创建数据库迁移脚本
echo "🔄 Creating database migration helper..."
cat > migrate-db.js << 'EOF'
const { PrismaClient } = require('@prisma/client');

async function checkConnection() {
    const prisma = new PrismaClient();
    
    try {
        await prisma.$connect();
        console.log('✅ Database connection successful');
        
        // 测试查询
        const result = await prisma.$queryRaw`SELECT 1 as test`;
        console.log('✅ Database query test passed');
        
        await prisma.$disconnect();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        process.exit(1);
    }
}

checkConnection();
EOF

echo "✅ Created database migration helper: migrate-db.js"

# 运行数据库连接测试
echo "🔍 Testing database connection..."
node migrate-db.js

# 清理临时文件
rm migrate-db.js

# 创建示例 API 路由
echo "📝 Creating example API route with enhanced features..."
mkdir -p src/app/api/example-enhanced

cat > src/app/api/example-enhanced/route.ts << 'EOF'
import { NextRequest, NextResponse } from 'next/server';
import { createAuthHandler } from '@/lib/utils/api-route-protection';
import { withConnection, withTransaction } from '@/lib/utils/db-migration-helper';
import { redisService } from '@/lib/redis-config';

// 示例：使用所有增强功能的 API 路由

async function handleGET(request: NextRequest, context: any) {
  const { user } = context;
  
  // 使用缓存
  const cacheKey = `user_data:${user.id}`;
  const cached = await redisService.get(cacheKey);
  
  if (cached) {
    return NextResponse.json({
      success: true,
      cached: true,
      data: JSON.parse(cached)
    });
  }
  
  // 使用连接池查询数据库
  const userData = await withConnection('get_user_profile', async (prisma) => {
    return prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        tokenBalance: true,
        createdAt: true
      }
    });
  });
  
  if (!userData) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }
  
  // 缓存结果
  await redisService.set(cacheKey, JSON.stringify(userData), { EX: 300 });
  
  return NextResponse.json({
    success: true,
    cached: false,
    data: userData
  });
}

async function handlePOST(request: NextRequest, context: any) {
  const { user } = context;
  const body = await request.json();
  
  // 使用事务确保数据一致性
  const result = await withTransaction(async (prisma) => {
    // 更新用户数据
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name || user.name,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        updatedAt: true
      }
    });
    
    // 记录操作日志
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: 'profile_update',
        metadata: {
          oldName: user.name,
          newName: body.name
        }
      }
    });
    
    return updatedUser;
  });
  
  // 清除相关缓存
  await redisService.del(`user_data:${user.id}`);
  
  return NextResponse.json({
    success: true,
    data: result
  });
}

export const GET = createAuthHandler(handleGET, {
  rateLimit: true,
  requiredPermissions: ['read:profile']
});

export const POST = createAuthHandler(handlePOST, {
  rateLimit: true,
  requiredPermissions: ['update:profile']
});
EOF

echo "✅ Created example API route: src/app/api/example-enhanced/route.ts"

# 创建性能监控配置
echo "📊 Creating performance monitoring configuration..."
cat > src/lib/performance-monitor.ts << 'EOF'
import { createLogger } from './utils/security/secure-logger';

const logger = createLogger('PerformanceMonitor');

// 性能指标收集
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  // 记录响应时间
  recordResponseTime(endpoint: string, duration: number) {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }
    
    const endpointMetrics = this.metrics.get(endpoint)!;
    endpointMetrics.push(duration);
    
    // 保持最近1000个记录
    if (endpointMetrics.length > 1000) {
      endpointMetrics.shift();
    }
    
    // 记录慢请求
    if (duration > 1000) {
      logger.warn('Slow endpoint detected', { endpoint, duration });
    }
  }
  
  // 获取端点统计
  getEndpointStats(endpoint: string) {
    const metrics = this.metrics.get(endpoint) || [];
    
    if (metrics.length === 0) {
      return null;
    }
    
    const sorted = [...metrics].sort((a, b) => a - b);
    
    return {
      count: metrics.length,
      avg: metrics.reduce((a, b) => a + b, 0) / metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  // 获取所有端点统计
  getAllStats() {
    const stats: Record<string, any> = {};
    
    for (const [endpoint] of this.metrics) {
      stats[endpoint] = this.getEndpointStats(endpoint);
    }
    
    return stats;
  }
}

export const performanceMonitor = new PerformanceMonitor();
EOF

echo "✅ Created performance monitor: src/lib/performance-monitor.ts"

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Review the .env.example file and update your .env.local"
echo "2. Check the example API route at src/app/api/example-enhanced/route.ts"
echo "3. Use the migration script to update existing routes:"
echo "   node scripts/migrate-api-routes.js"
echo ""
echo "Key features enabled:"
echo "- ✅ Redis caching and session storage"
echo "- ✅ Database connection pooling"
echo "- ✅ Enhanced API route protection"
echo "- ✅ Rate limiting"
echo "- ✅ Performance monitoring"
echo "- ✅ Request/response logging"