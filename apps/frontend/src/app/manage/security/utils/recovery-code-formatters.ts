import type { RecoveryCode } from '~/lib/api/types/console';

export const maskRecoveryCode = (code: unknown) => {
  if (typeof code !== 'string' || code.length < 4) {
    return '****-****-****-****';
  }

  const prefix = code.slice(0, 4);
  const suffix = code.slice(-4);

  return `${prefix}****${suffix}`;
};

export const parseDate = (value: unknown) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
};

export const formatDateValue = (
  value: unknown,
  options: Intl.DateTimeFormatOptions = {},
) => {
  const date = parseDate(value);

  if (!date) {
    return '-';
  }

  return date.toLocaleDateString(undefined, options);
};

export const formatDateTimeValue = (value: unknown) => {
  const date = parseDate(value);

  if (!date) {
    return '-';
  }

  return date.toLocaleString();
};

export const formatRecoveryStatus = (used: unknown, row: RecoveryCode) => {
  if (used === true) {
    return 'Used';
  }

  const expiryDate = parseDate(row.expiresAt);

  if (expiryDate && expiryDate < new Date()) {
    return 'Expired';
  }

  return 'Available';
};
