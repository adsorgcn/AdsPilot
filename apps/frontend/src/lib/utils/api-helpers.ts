/**
 * API 辅助工具
 * 提供类型安全的 API 调用辅助函数
 */

import { createLogger } from './logger';

const logger = createLogger('API');

/**
 * API 响应类型
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * API 错误类型
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 请求配置
 */
export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * 创建带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  config: RequestConfig = {}
): Promise<Response> {
  const { timeout = 30000, ...fetchConfig } = config;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 带重试的 fetch
 */
async function fetchWithRetry(
  url: string,
  config: RequestConfig = {}
): Promise<Response> {
  const { retries = 3, retryDelay = 1000, ...fetchConfig } = config;

  let lastError: Error | unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, fetchConfig);
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        logger.warn(`Request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * 处理 API 响应
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails: unknown;

    if (isJson) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorDetails = errorData;
      } catch {
        // Ignore JSON parse errors
      }
    }

    throw new ApiError(
      errorMessage,
      response.status,
      response.status.toString(),
      errorDetails
    );
  }

  if (isJson) {
    return response.json();
  }

  return response.text() as Promise<T>;
}

/**
 * GET 请求
 */
export async function apiGet<T>(
  url: string,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`GET ${url}`);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'GET',
  });

  return handleResponse<T>(response);
}

/**
 * POST 请求
 */
export async function apiPost<T, D = unknown>(
  url: string,
  data?: D,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`POST ${url}`);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

/**
 * PUT 请求
 */
export async function apiPut<T, D = unknown>(
  url: string,
  data?: D,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`PUT ${url}`);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

/**
 * PATCH 请求
 */
export async function apiPatch<T, D = unknown>(
  url: string,
  data?: D,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`PATCH ${url}`);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  return handleResponse<T>(response);
}

/**
 * DELETE 请求
 */
export async function apiDelete<T>(
  url: string,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`DELETE ${url}`);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'DELETE',
  });

  return handleResponse<T>(response);
}

/**
 * 构建查询字符串
 */
export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * 构建完整 URL
 */
export function buildUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const url = `${baseUrl}${path}`;
  if (!params) {
    return url;
  }

  const queryString = buildQueryString(params);
  return `${url}${queryString}`;
}

/**
 * 验证 URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 下载文件
 */
export async function downloadFile(
  url: string,
  filename?: string
): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || url.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    logger.error('Failed to download file', error);
    throw error;
  }
}

/**
 * 上传文件
 */
export async function uploadFile<T>(
  url: string,
  file: File,
  config: RequestConfig = {}
): Promise<T> {
  logger.debug(`Uploading file to ${url}`);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchWithRetry(url, {
    ...config,
    method: 'POST',
    body: formData,
  });

  return handleResponse<T>(response);
}

/**
 * 批量请求
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const request of requests) {
    const promise = request().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}