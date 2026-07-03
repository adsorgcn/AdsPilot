/**
 * 广告账号数据格式化工具
 */

export const formatCurrencyValue = (value: unknown) => {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);

  if (!Number.isFinite(amount)) {
    return '$0.00';
  }

  return `$${amount.toFixed(2)}`;
};

export const formatRoasValue = (value: unknown) => {
  const roas = typeof value === 'number' ? value : Number(value ?? 0);

  if (!Number.isFinite(roas)) {
    return '0.00';
  }

  return roas.toFixed(2);
};

export const formatDateValue = (value: unknown) => {
  if (!value) {
    return '-';
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  return '-';
};
