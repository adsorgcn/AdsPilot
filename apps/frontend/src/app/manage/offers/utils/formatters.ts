/**
 * CSV导出格式化工具
 */

export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export function formatDomainValue(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  try {
    return new URL(value).hostname;
  } catch (error) {
    console.warn('Invalid URL while exporting offer CSV:', error);
    return value;
  }
}

export function formatNumericValue(
  value: unknown,
  fractionDigits: number,
  fallback: string,
) {
  const numeric = typeof value === 'number' ? value : Number(value ?? NaN);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return numeric.toFixed(fractionDigits);
}

export function formatDateValue(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  return '-';
}
