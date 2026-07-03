/**
 * Tremor Chart 配置和工具函数
 * 用于统一管理图表的颜色、格式化器等
 */

// Tremor 颜色主题
export const chartColors = {
  primary: ['blue', 'cyan', 'indigo', 'violet', 'purple'] as const,
  success: ['emerald', 'green', 'teal'] as const,
  warning: ['amber', 'orange', 'yellow'] as const,
  error: ['rose', 'red', 'pink'] as const,
  neutral: ['slate', 'gray', 'zinc'] as const,
};

// 货币格式化器
export const currencyFormatter = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// 百分比格式化器
export const percentageFormatter = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// 数字格式化器（带千位分隔符）
export const numberFormatter = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

// 紧凑数字格式化器（1.2K, 1.5M等）
export const compactNumberFormatter = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(value);
};

// 日期格式化器
export const dateFormatter = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

// 完整日期格式化器
export const fullDateFormatter = (date: string | Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};