# 简化版Redis连接服务

## 目标
创建一个简单、稳定的Redis连接服务，专注于代理IP的存储和读取功能。

## 简化设计

### 核心功能
1. **稳定的Redis连接**
2. **代理IP存储**
3. **代理IP读取**
4. **基本错误处理**

### 架构
```
SimpleRedisService
├── Redis连接管理
├── 代理存储操作
├── 基本重连机制
└── 简单错误处理
```

## 实现代码

```typescript
// src/lib/services/simple-redis-service.ts
import { createClient, RedisClientType } from 'redis';
import { ProxyConfig } from '@/lib/utils/proxy-utils';

class SimpleRedisService {
  private redis: RedisClientType | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor() {
    this.initializeConnection();
  }

  /**
   * 初始化Redis连接
   */
  private async initializeConnection(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      console.warn('REDIS_URL未设置，Redis功能将不可用');
      return;
    }

    try {
      this.redis = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxReconnectAttempts) {
              return new Error('超过最大重连次数');
            }
            return Math.min(this.reconnectDelay * Math.pow(2, retries), 30000);
          },
          connectTimeout: 15000,
          socketTimeout: 10000,
        }
      });

      this.redis.on('connect', () => {
        console.log('Redis连接已建立');
      });

      this.redis.on('ready', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('Redis连接已就绪');
      });

      this.redis.on('error', (err) => {
        console.error('Redis连接错误:', err.message);
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        console.log('Redis正在重连...');
      });

      await this.redis.connect();
    } catch (error) {
      console.error('Redis连接失败:', error);
      this.isConnected = false;
    }
  }

  /**
   * 确保Redis连接可用
   */
  private async ensureConnection(): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    if (this.isConnected) {
      try {
        await this.redis.ping();
        return true;
      } catch {
        this.isConnected = false;
      }
    }

    // 尝试重连
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      try {
        await this.initializeConnection();
        return this.isConnected;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * 存储代理IP
   */
  async storeProxies(proxies: ProxyConfig[], sourceUrl: string): Promise<boolean> {
    if (!(await this.ensureConnection())) {
      console.warn('Redis连接不可用，无法存储代理');
      return false;
    }

    try {
      const pipeline = this.redis!.multi();
      
      for (const proxy of proxies) {
        const key = `proxy:${proxy.host}:${proxy.port}`;
        const data = {
          config: proxy,
          source: sourceUrl,
          timestamp: Date.now(),
          healthy: true
        };
        
        pipeline.hSet(key, 'data', JSON.stringify(data));
        pipeline.expire(key, 24 * 60 * 60); // 24小时过期
      }
      
      await pipeline.exec();
      console.log(`成功存储 ${proxies.length} 个代理到Redis`);
      return true;
    } catch (error) {
      console.error('存储代理失败:', error);
      return false;
    }
  }

  /**
   * 获取代理IP
   */
  async getProxies(count: number): Promise<ProxyConfig[]> {
    if (!(await this.ensureConnection())) {
      console.warn('Redis连接不可用，无法获取代理');
      return [];
    }

    try {
      const keys = await this.redis!.keys('proxy:*');
      const proxies: ProxyConfig[] = [];
      
      for (const key of keys.slice(0, count)) {
        const result = await this.redis!.hGet(key, 'data');
        if (result) {
          const data = JSON.parse(result);
          if (data.healthy) {
            proxies.push(data.config);
          }
        }
      }
      
      console.log(`从Redis获取 ${proxies.length} 个代理`);
      return proxies;
    } catch (error) {
      console.error('获取代理失败:', error);
      return [];
    }
  }

  /**
   * 标记代理为不健康
   */
  async markProxyUnhealthy(proxy: ProxyConfig): Promise<void> {
    if (!(await this.ensureConnection())) {
      return;
    }

    try {
      const key = `proxy:${proxy.host}:${proxy.port}`;
      const result = await this.redis!.hGet(key, 'data');
      
      if (result) {
        const data = JSON.parse(result);
        data.healthy = false;
        data.lastFailure = Date.now();
        
        await this.redis!.hSet(key, 'data', JSON.stringify(data));
      }
    } catch (error) {
      console.error('标记代理失败:', error);
    }
  }

  /**
   * 获取连接状态
   */
  getStatus(): { connected: boolean; redisUrl?: string } {
    return {
      connected: this.isConnected,
      redisUrl: process.env.REDIS_URL?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.isConnected = false;
    }
  }
}

// 创建单例实例
const simpleRedisService = new SimpleRedisService();

export default simpleRedisService;
export { SimpleRedisService };
```

## 使用示例

```typescript
// 在其他服务中使用
import simpleRedisService from '@/lib/services/simple-redis-service';

// 存储代理
const proxies = [
  {
    host: 'proxy1.example.com',
    port: 8080,
    protocol: 'http',
    username: 'user1',
    password: 'pass1'
  }
];

await simpleRedisService.storeProxies(proxies, 'https://api.example.com/proxies');

// 获取代理
const availableProxies = await simpleRedisService.getProxies(10);

// 标记代理为不健康
await simpleRedisService.markProxyUnhealthy(availableProxies[0]);

// 检查状态
const status = simpleRedisService.getStatus();
console.log('Redis状态:', status);
```

## 配置要求

```bash
# 环境变量
REDIS_URL=redis://username:password@host:port
```

## 特点

1. **简单直接**: 专注于核心功能，去掉复杂特性
2. **自动重连**: 基础的重连机制
3. **错误处理**: 简单的错误处理和日志
4. **单例模式**: 全局单例，避免重复连接
5. **易维护**: 代码量少，逻辑清晰

这个简化版本去掉了：
- 复杂的健康检查机制
- 性能监控
- 连接池管理
- FIFO队列
- 智能补充
- 批量操作优化
- 复杂的索引结构

专注于最核心的需求：稳定连接和代理IP的存储读取。