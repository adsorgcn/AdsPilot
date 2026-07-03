'use client';

import classNames from 'clsx';

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export default function EmptyState({
  title,
  description,
  icon,
  actions,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={classNames(
        'flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 px-8 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-3xl">{icon}</div> : null}

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
      ) : null}

      {children ?? null}
    </div>
  );
}
