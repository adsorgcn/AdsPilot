"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';

import Button from '~/core/ui/Button';
import Tile from '~/core/ui/Tile';
import Badge from '~/core/ui/Badge';

export type MetricTrend = 'up' | 'down' | 'steady';
export type MetricTone = 'default' | 'warn' | 'error' | 'success';

export interface MetricAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export interface MetricCardProps {
  title: string;
  value: string;
  description?: string;
  unit?: string;
  trendLabel?: string;
  trend?: MetricTrend;
  tone?: MetricTone;
  badge?: string;
  updatedAt?: string;
  actions?: MetricAction[];
}

const trendIconMap: Record<MetricTrend, React.ReactNode> = {
  up: <ArrowUpIcon className="h-3 w-3" />,
  down: <ArrowDownIcon className="h-3 w-3" />,
  steady: <MinusIcon className="h-3 w-3" />,
};

const toneColorMap: Record<MetricTone, string> = {
  default: 'text-foreground',
  warn: 'text-amber-600',
  error: 'text-red-600',
  success: 'text-emerald-600',
};

export default function MetricCard({
  title,
  value,
  description,
  unit,
  trendLabel,
  trend = 'steady',
  tone = 'default',
  badge,
  updatedAt,
  actions,
}: MetricCardProps) {
  return (
    <Tile className="flex h-full flex-col justify-between">
      <Tile.Heading>
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          {title}
          {badge ? (
            <Badge size="small" color="info">
              {badge}
            </Badge>
          ) : null}
        </div>
      </Tile.Heading>

      <Tile.Body>
        <div className="flex items-baseline gap-2">
          <div className={classNames('text-3xl font-bold', toneColorMap[tone])}>{value}</div>
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        </div>

        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}

        {trendLabel ? (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
            {trendIconMap[trend]}
            <span>{trendLabel}</span>
          </div>
        ) : null}

        {updatedAt ? (
          <p className="mt-3 text-[10px] text-muted-foreground">最近更新：{updatedAt}</p>
        ) : null}
      </Tile.Body>

      {actions?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              href={action.href}
              onClick={action.onClick}
              size="sm"
              variant={action.variant === 'primary' ? 'default' : 'outline'}
              className="flex items-center gap-1"
            >
              {action.icon ?? null}
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </Tile>
  );
}
