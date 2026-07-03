'use client';

import classNames from 'clsx';
import { useTranslation } from 'react-i18next';

const STATUS_VARIANTS = {
  success: 'bg-success-100 text-success-700 border-success-200',
  warning: 'bg-warning-100 text-warning-700 border-warning-200',
  error: 'bg-error-100 text-error-700 border-error-200',
  default: 'bg-muted text-muted-foreground border-border',
  info: 'bg-brand-100 text-brand-700 border-brand-200',
} as const;

type StatusVariant = keyof typeof STATUS_VARIANTS;

const STATUS_VARIANT_MAPPING: Record<string, StatusVariant> = {
  deployed: 'success',
  deployable: 'info',
  pending_evaluation: 'warning',
  evaluating: 'warning',
  evaluation_failed: 'error',
  archived: 'default',
};

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

export default function StatusBadge({
  status,
  variant,
  label,
  className,
}: StatusBadgeProps) {
  const { t } = useTranslation('common');
  const normalized = status?.toLowerCase() ?? '';

  // Get variant
  const badgeVariant = variant ?? STATUS_VARIANT_MAPPING[normalized] ?? 'default';

  // Get label with i18n support
  let badgeLabel = label;
  if (!badgeLabel) {
    // Try to get translation, fallback to status
    const translationKey = `offers.status.${normalized}`;
    badgeLabel = t(translationKey, { defaultValue: status });
  }

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
        STATUS_VARIANTS[badgeVariant],
        className,
      )}
    >
      {badgeLabel}
    </span>
  );
}
