'use client';

import type { ComponentType } from 'react';
import classNames from 'clsx';

import Button from '~/core/ui/Button';

type IconType = ComponentType<{ className?: string }>;

export interface ActionCardProps {
  title: string;
  description: string;
  icon: IconType;
  actionLabel: string;
  onAction: () => void;
  priority?: 'high' | 'medium' | 'low';
  className?: string;
}

const priorityStyles: Record<
  NonNullable<ActionCardProps['priority']>,
  string
> = {
  high: 'border-destructive/20 bg-destructive/10',
  medium: 'border-primary/20 bg-primary/10',
  low: 'border-border bg-card/50',
};

export default function ActionCard({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  priority = 'medium',
  className,
}: ActionCardProps) {
  return (
    <div
      className={classNames(
        'flex flex-col gap-4 rounded-2xl border p-5 shadow-sm',
        'transition-all duration-200',
        'hover:shadow-md hover:-translate-y-0.5',
        'active:scale-[0.98]',
        priorityStyles[priority],
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div>
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
