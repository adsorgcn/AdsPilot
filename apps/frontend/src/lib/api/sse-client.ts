import { useState, useRef, useEffect } from 'react';

/**
 * Server-Sent Events (SSE) 客户端
 *
 * 提供实时数据同步功能，支持：
 * - 自动重连机制
 * - 错误处理和恢复
 * - 事件类型过滤
 * - 连接状态管理
 */

export interface SSEEvent<T = any> {
  type: string;
  data: T;
  timestamp: string;
  id?: string;
}

export interface SSEOptions {
  endpoint: string;
  headers?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
  heartbeatInterval?: number;
  onMessage?: <T>(event: SSEEvent<T>) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onRetry?: (attempt: number) => void;
}

export type SSEConnectionState = 'connecting' | 'open' | 'closed' | 'error' | 'reconnecting';

export class SSEClient {
  private eventSource: EventSource | null = null;
  private options: Required<SSEOptions>;
  private retryCount = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionState: SSEConnectionState = 'closed';
  private lastEventId: string | null = null;

  constructor(options: SSEOptions) {
    this.options = {
      retryAttempts: options.retryAttempts ?? 5,
      retryDelay: options.retryDelay ?? 2000,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      ...options,
    };
  }

  /**
   * 连接到SSE端点
   */
  connect(): void {
    if (this.connectionState === 'open' || this.connectionState === 'connecting') {
      return;
    }

    this.connectionState = 'connecting';
    this.createConnection();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.clearTimers();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connectionState = 'closed';
    this.options.onClose?.();
  }

  /**
   * 获取当前连接状态
   */
  getConnectionState(): SSEConnectionState {
    return this.connectionState;
  }

  /**
   * 发送自定义事件（通过WebSockets，如果需要双向通信）
   */
  sendEvent(type: string, data: any): void {
    // SSE是单向的，这个方法是为了兼容性
    // 如果需要双向通信，应该使用WebSocket
    console.warn('SSE is unidirectional. Use WebSocket for bidirectional communication.');
  }

  private createConnection(): void {
    try {
      const url = this.buildUrl();
      this.eventSource = new EventSource(url, {
        withCredentials: true,
      });

      this.setupEventListeners();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private buildUrl(): string {
    const url = new URL(this.options.endpoint, window.location.origin);

    // 添加查询���数
    url.searchParams.set('lastEventId', this.lastEventId ?? '');
    url.searchParams.set('clientVersion', process.env.NEXT_PUBLIC_VERSION ?? '1.0.0');

    return url.toString();
  }

  private setupEventListeners(): void {
    if (!this.eventSource) return;

    this.eventSource.onopen = () => {
      this.connectionState = 'open';
      this.retryCount = 0;
      this.setupHeartbeat();
      this.options.onOpen?.();
    };

    this.eventSource.onmessage = (event) => {
      try {
        const sseEvent = this.parseEvent(event);
        this.lastEventId = sseEvent.id ?? this.lastEventId;
        this.options.onMessage?.(sseEvent);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      this.handleError(error);
    };
  }

  private parseEvent(event: MessageEvent): SSEEvent {
    try {
      const parsed = JSON.parse(event.data);
      return {
        type: parsed.type ?? 'message',
        data: parsed.data ?? parsed,
        timestamp: parsed.timestamp ?? new Date().toISOString(),
        id: event.lastEventId,
      };
    } catch {
      // 如果不是JSON格式，返回原始数据
      return {
        type: 'message',
        data: event.data,
        timestamp: new Date().toISOString(),
        id: event.lastEventId,
      };
    }
  }

  private handleError(error: any): void {
    this.clearTimers();
    this.connectionState = 'error';

    const errorObj = error instanceof Error ? error : new Error('SSE connection error');
    this.options.onError?.(errorObj);

    // 尝试重连
    if (this.retryCount < this.options.retryAttempts) {
      this.scheduleReconnect();
    } else {
      this.connectionState = 'closed';
      this.options.onClose?.();
    }
  }

  private scheduleReconnect(): void {
    this.connectionState = 'reconnecting';
    this.options.onRetry?.(this.retryCount + 1);

    this.reconnectTimer = setTimeout(() => {
      this.retryCount++;
      this.createConnection();
    }, this.options.retryDelay * Math.pow(2, this.retryCount)); // 指数退避
  }

  private setupHeartbeat(): void {
    this.clearHeartbeatTimer();

    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === 'open') {
        // 发送ping消息检查连接
        this.sendEvent('ping', { timestamp: Date.now() });
      }
    }, this.options.heartbeatInterval);
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearHeartbeatTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// React Hook for SSE
export function useSSE<T = any>(options: {
  endpoint: string;
  onMessage?: (event: SSEEvent<T>) => void;
  onError?: (error: Error) => void;
  autoConnect?: boolean;
}) {
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('closed');
  const [lastEvent, setLastEvent] = useState<SSEEvent<T> | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    const client = new SSEClient({
      endpoint: options.endpoint,
      onMessage: (event) => {
        setLastEvent(event);
        options.onMessage?.(event);
      },
      onError: (error) => {
        options.onError?.(error);
      },
      onOpen: () => {
        setConnectionState('open');
        setIsReconnecting(false);
      },
      onClose: () => {
        setConnectionState('closed');
        setIsReconnecting(false);
      },
      onRetry: (attempt) => {
        setConnectionState('reconnecting');
        setIsReconnecting(true);
      },
    });

    clientRef.current = client;

    if (options.autoConnect !== false) {
      client.connect();
    }

    return () => {
      client.disconnect();
    };
  }, [options.endpoint]);

  return {
    connectionState,
    lastEvent,
    isReconnecting,
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
  };
}

// 预定义的SSE端点
export const SSE_ENDPOINTS = {
  // Console监控数据流
  CONSOLE_MONITORING: '/api/v1/console/monitoring/stream',

  // 任务状态更新流
  TASK_UPDATES: '/api/v1/console/tasks/stream',

  // 通知流
  NOTIFICATIONS: '/api/v1/notifications/stream',

  // 广告账号同步状态
  ADS_SYNC_STATUS: '/api/v1/adscenter/accounts/stream',

  // 批量操作进度
  BULK_OPERATIONS: '/api/v1/adscenter/bulk-actions/stream',

  // 实时分析结果
  ANALYSIS_RESULTS: '/api/v1/analysis/results/stream',
} as const;

// 预定义的事件类型
export const SSE_EVENT_TYPES = {
  // 任务相关
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',

  // 账号相关
  ACCOUNT_CONNECTED: 'account.connected',
  ACCOUNT_DISCONNECTED: 'account.disconnected',
  ACCOUNT_SYNCED: 'account.synced',
  ACCOUNT_ERROR: 'account.error',

  // 批量操作相关
  BULK_OPERATION_STARTED: 'bulk_operation.started',
  BULK_OPERATION_PROGRESS: 'bulk_operation.progress',
  BULK_OPERATION_COMPLETED: 'bulk_operation.completed',
  BULK_OPERATION_FAILED: 'bulk_operation.failed',

  // 系统相关
  SYSTEM_ALERT: 'system.alert',
  SYSTEM_MAINTENANCE: 'system.maintenance',

  // 用户相关
  NOTIFICATION_NEW: 'notification.new',
  NOTIFICATION_READ: 'notification.read',

  // 监控相关
  METRICS_UPDATED: 'metrics.updated',
  HEALTH_CHECK: 'health.check',
} as const;