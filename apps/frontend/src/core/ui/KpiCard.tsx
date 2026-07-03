'use client';

import type { ComponentType } from 'react';
import classNames from 'clsx';

type IconType = ComponentType<{ className?: string }>;

type Trend = {
  value: number;
  direction: 'up' | 'down';
};

export interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: IconType;
  color?: 'blue' | 'green' | 'orange' | 'purple';
  trend?: Trend;
  footer?: React.ReactNode;
  className?: string;
}

const colorMap: Record<
  NonNullable<KpiCardProps['color']>,
  { bg: string; text: string }
> = {
  blue: { bg: 'bg-brand-100', text: 'text-brand-700' },
  green: { bg: 'bg-success-100', text: 'text-success-700' },
  orange: { bg: 'bg-warning-100', text: 'text-warning-700' },
  purple: { bg: 'bg-brand-200', text: 'text-brand-800' },
};

export default function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  color = 'blue',
  trend,
  footer,
  className,
}: KpiCardProps) {
  const palette = colorMap[color];
  const trendColor =
    trend?.direction === 'down' ? 'text-error-500' : 'text-success-600';

  return (
    <div
      className={classNames(
        'flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {value}
          </p>
          {trend ? (
            <p className={classNames('mt-1 text-xs font-medium', trendColor)}>
              {trend.direction === 'down' ? '↓' : '↑'} {trend.value}%
            </p>
          ) : null}
        </div>

        <div
          className={classNames(
            'flex h-12 w-12 items-center justify-center rounded-full',
            palette.bg,
          )}
        >
          <Icon className={classNames('h-6 w-6', palette.text)} />
        </div>
      </div>

      {description ? (
        <p className="mt-3 text-xs text-muted-foreground">{description}</p>
      ) : null}

      {footer ? <div className="mt-4 text-xs text-muted-foreground">{footer}</div> : null}
    </div>
  );
}
