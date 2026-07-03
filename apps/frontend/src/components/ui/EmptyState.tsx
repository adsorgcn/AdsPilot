'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  FileQuestion, 
  Search, 
  Inbox, 
  AlertCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { GradientButton } from './GradientButton';
import { cn } from '~/core/generic/shadcn-utils';

export interface EmptyStateProps {
  /**
   * Icon to display
   */
  icon?: LucideIcon;
  /**
   * Title text
   */
  title: string;
  /**
   * Description text
   */
  description?: string;
  /**
   * Primary action button
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'outline';
  };
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /**
   * Preset type for common empty states
   */
  type?: 'default' | 'search' | 'error' | 'no-data' | 'coming-soon';
  /**
   * Additional CSS classes
   */
  className?: string;
}

const typeConfig = {
  default: {
    icon: Inbox,
    iconColor: 'text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  search: {
    icon: Search,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900',
  },
  'no-data': {
    icon: FileQuestion,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900',
  },
  'coming-soon': {
    icon: Sparkles,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900',
  },
};

/**
 * EmptyState - Beautiful empty state component
 * 
 * Displays when there's no data to show, with optional actions.
 * Supports different types for common scenarios.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  type = 'default',
  className,
}: EmptyStateProps) {
  const config = typeConfig[type];
  const Icon = icon || config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <GlassCard variant="default" className="p-12">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-2xl',
              config.bgColor
            )}
          >
            <Icon className={cn('h-10 w-10', config.iconColor)} />
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground max-w-md">
                {description}
              </p>
            )}
          </div>

          {/* Actions */}
          {(action || secondaryAction) && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {action && (
                <GradientButton
                  variant={action.variant || 'primary'}
                  onClick={action.onClick}
                >
                  {action.label}
                </GradientButton>
              )}
              {secondaryAction && (
                <GradientButton
                  variant="outline"
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </GradientButton>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

/**
 * EmptySearchState - Preset for search results
 */
export function EmptySearchState({
  searchQuery,
  onClear,
  className,
}: {
  searchQuery: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="search"
      title="No results found"
      description={`We couldn't find anything matching "${searchQuery}". Try adjusting your search.`}
      action={
        onClear
          ? {
              label: 'Clear search',
              onClick: onClear,
              variant: 'outline',
            }
          : undefined
      }
      className={className}
    />
  );
}

/**
 * EmptyDataState - Preset for no data
 */
export function EmptyDataState({
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-data"
      title={title}
      description={description}
      action={
        actionLabel && onAction
          ? {
              label: actionLabel,
              onClick: onAction,
            }
          : undefined
      }
      className={className}
    />
  );
}

/**
 * ErrorState - Preset for errors
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this content. Please try again.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="error"
      title={title}
      description={description}
      action={
        onRetry
          ? {
              label: 'Try again',
              onClick: onRetry,
            }
          : undefined
      }
      className={className}
    />
  );
}

/**
 * ComingSoonState - Preset for coming soon features
 */
export function ComingSoonState({
  title = 'Coming Soon',
  description = 'This feature is currently under development. Stay tuned!',
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <EmptyState
      type="coming-soon"
      title={title}
      description={description}
      className={className}
    />
  );
}