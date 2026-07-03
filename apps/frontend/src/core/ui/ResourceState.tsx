'use client';

import { ArrowPathIcon, ExclamationTriangleIcon, InboxStackIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '~/core/ui/Button';
import EmptyState from '~/core/ui/EmptyState';
import { Skeleton } from '~/core/ui/Skeleton';
import { TableCell, TableRow } from '~/core/ui/Table';

type ButtonVariant = React.ComponentProps<typeof Button>['variant'];
type ButtonSize = React.ComponentProps<typeof Button>['size'];

type Action =
  | {
      label: string;
      onClick: () => void;
      icon?: ReactNode;
      variant?: ButtonVariant;
      size?: ButtonSize;
    }
  | ReactNode;

type ResourceStateBaseProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  className?: string;
};

type ResourceEmptyStateProps = ResourceStateBaseProps & {
  helperText?: ReactNode;
};

function renderAction(action?: Action) {
  if (!action) {
    return null;
  }

  if (typeof action === 'object' && 'label' in action && 'onClick' in action) {
    const { icon, label, onClick, variant = 'default', size = 'sm' } = action;

    return (
      <Button
        size={size}
        variant={variant}
        onClick={onClick}
      >
        <span className={'flex items-center gap-2'}>
          {icon ? <span className={'text-base'}>{icon}</span> : null}
          <span>{label}</span>
        </span>
      </Button>
    );
  }

  return action;
}

export function ResourceEmptyState({
  title,
  description,
  icon = <InboxStackIcon className={'h-9 w-9 text-muted-foreground'} />,
  primaryAction,
  secondaryAction,
  helperText,
  className,
}: ResourceEmptyStateProps) {
  return (
    <EmptyState
      className={classNames('border-dashed bg-muted/20', className)}
      title={title}
      description={description}
      icon={icon}
      actions={
        primaryAction || secondaryAction ? (
          <div className={'flex flex-wrap items-center justify-center gap-2'}>
            {renderAction(primaryAction)}
            {renderAction(secondaryAction)}
          </div>
        ) : null
      }
    >
      {helperText ? (
        <p className={'text-xs text-muted-foreground/80'}>{helperText}</p>
      ) : null}
    </EmptyState>
  );
}

type ResourceErrorStateProps = ResourceStateBaseProps & {
  error?: unknown;
  retryLabel?: string;
  onRetry?: () => void;
};

export function ResourceErrorState({
  title,
  description,
  error,
  retryLabel,
  onRetry,
  icon = <ExclamationTriangleIcon className={'h-9 w-9 text-destructive'} />,
  primaryAction,
  secondaryAction,
  className,
}: ResourceErrorStateProps) {
  const { t } = useTranslation('common');

  const defaultTitle = title ?? t('common.errorStateTitle');
  const defaultDescription = description ?? t('common.errorStateDescription');
  const defaultRetryLabel = retryLabel ?? t('common.retryLabel');

  const actions: ReactNode[] = [];

  if (onRetry) {
    actions.push(
      <Button
        key={'retry'}
        size={'sm'}
        variant={'outline'}
        onClick={onRetry}
      >
        <span className={'flex items-center gap-2'}>
          <ArrowPathIcon className={'h-4 w-4'} />
          <span>{defaultRetryLabel}</span>
        </span>
      </Button>,
    );
  }

  const primary = renderAction(primaryAction);
  const secondary = renderAction(secondaryAction);

  if (primary) actions.unshift(primary);
  if (secondary) actions.push(secondary);

  const details =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : null;

  return (
    <EmptyState
      className={classNames(
        'border-destructive/30 bg-destructive/5 text-destructive',
        className,
      )}
      title={defaultTitle}
      description={details ?? defaultDescription}
      icon={icon}
      actions={
        actions.length ? (
          <div className={'flex flex-wrap items-center justify-center gap-2'}>
            {actions.map((action, index) => (
              <span key={index}>{action}</span>
            ))}
          </div>
        ) : null
      }
    />
  );
}

type ResourceListSkeletonProps = {
  rows?: number;
  showIcon?: boolean;
  className?: string;
};

export function ResourceListSkeleton({
  rows = 3,
  showIcon = false,
  className,
}: ResourceListSkeletonProps) {
  return (
    <div className={classNames('space-y-4 rounded-lg border border-border/60 bg-muted/10 p-4', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={'flex items-center gap-3'}
        >
          {showIcon ? <Skeleton className={'h-10 w-10 rounded-full'} /> : null}
          <div className={'flex flex-1 flex-col gap-2'}>
            <Skeleton className={'h-4 w-1/2'} />
            <Skeleton className={'h-4 w-1/3'} />
            <Skeleton className={'h-3 w-1/4'} />
          </div>
          <Skeleton className={'h-8 w-20'} />
        </div>
      ))}
    </div>
  );
}

type ResourceTableSkeletonProps = {
  rows?: number;
  columns?: number;
  showActionsColumn?: boolean;
};

export function ResourceTableSkeleton({
  rows = 3,
  columns = 5,
  showActionsColumn = true,
}: ResourceTableSkeletonProps) {
  const totalColumns = showActionsColumn ? columns + 1 : columns;

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex} className={'animate-pulse'}>
          {Array.from({ length: totalColumns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className={'h-4 w-full'} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default ResourceEmptyState;
