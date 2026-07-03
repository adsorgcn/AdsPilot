/**
 * 统一的日志工具
 * 在生产环境中自动禁用 debug 日志
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = {
      enabled: process.env.NODE_ENV !== 'production',
      minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled && level !== 'error') {
      return false;
    }
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      if (process.env.NODE_ENV !== 'production') console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      if (process.env.NODE_ENV !== 'production') console.log(`ℹ️ [INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      if (process.env.NODE_ENV !== 'production') console.warn(`⚠️ [WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      if (process.env.NODE_ENV !== 'production') console.error(`❌ [ERROR] ${message}`, ...args);
    }
  }

  /**
   * 创建带上下文的 logger
   */
  context(contextName: string) {
    return {
      debug: (message: string, ...args: any[]) =>
        this.debug(`[${contextName}] ${message}`, ...args),
      info: (message: string, ...args: any[]) =>
        this.info(`[${contextName}] ${message}`, ...args),
      warn: (message: string, ...args: any[]) =>
        this.warn(`[${contextName}] ${message}`, ...args),
      error: (message: string, ...args: any[]) =>
        this.error(`[${contextName}] ${message}`, ...args),
    };
  }
}

export const logger = new Logger();

// 便捷的上下文 logger 创建函数
export function createLogger(context: string) {
  return logger.context(context);
}