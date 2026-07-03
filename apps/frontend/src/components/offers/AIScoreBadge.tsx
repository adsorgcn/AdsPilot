'use client';

import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import Badge from '~/core/ui/Badge';
import { cn } from '~/core/generic/shadcn-utils';

interface AIScoreBadgeProps {
  score?: number | null;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * FE-024: AIScoreBadge component
 * Displays AI recommendation score with grade (A/B/C/D/F)
 *
 * Score ranges:
 * - 85-100: Grade A (Excellent - High confidence)
 * - 70-84: Grade B (Good - Moderate confidence)
 * - 50-69: Grade C (Average - Consider with caution)
 * - 30-49: Grade D (Below Average - High risk)
 * - 0-29: Grade F (Poor - Not recommended)
 */
export function AIScoreBadge({ score, showIcon = true, size = 'default', className }: AIScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <Badge variant="outline" className={cn('gap-1', className)}>
        <span className="text-muted-foreground">N/A</span>
      </Badge>
    );
  }

  const getGrade = (score: number): { grade: string; label: string; variant: any; icon: any } => {
    if (score >= 85) {
      return {
        grade: 'A',
        label: 'Excellent',
        variant: 'default' as const,
        icon: <TrendingUp className="h-3 w-3" />,
      };
    } else if (score >= 70) {
      return {
        grade: 'B',
        label: 'Good',
        variant: 'secondary' as const,
        icon: <Sparkles className="h-3 w-3" />,
      };
    } else if (score >= 50) {
      return {
        grade: 'C',
        label: 'Average',
        variant: 'outline' as const,
        icon: <Sparkles className="h-3 w-3" />,
      };
    } else if (score >= 30) {
      return {
        grade: 'D',
        label: 'Below Average',
        variant: 'outline' as const,
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    } else {
      return {
        grade: 'F',
        label: 'Poor',
        variant: 'destructive' as const,
        icon: <AlertTriangle className="h-3 w-3" />,
      };
    }
  };

  const { grade, label, variant, icon } = getGrade(score);

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <Badge variant={variant} className={cn('gap-1 font-semibold', sizeClasses[size], className)}>
      {showIcon && icon}
      <span>
        {grade} ({score})
      </span>
    </Badge>
  );
}

/**
 * AIScoreLabel - Shows full label with description
 */
export function AIScoreLabel({ score, className }: { score?: number | null; className?: string }) {
  if (score === null || score === undefined) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-sm text-muted-foreground">Not evaluated</span>
      </div>
    );
  }

  const getDetails = (score: number) => {
    if (score >= 85) {
      return {
        label: 'Excellent Opportunity',
        description: 'High confidence recommendation',
        color: 'text-green-600 dark:text-green-400',
      };
    } else if (score >= 70) {
      return {
        label: 'Good Opportunity',
        description: 'Moderate confidence',
        color: 'text-blue-600 dark:text-blue-400',
      };
    } else if (score >= 50) {
      return {
        label: 'Average Opportunity',
        description: 'Consider with caution',
        color: 'text-yellow-600 dark:text-yellow-400',
      };
    } else if (score >= 30) {
      return {
        label: 'Below Average',
        description: 'High risk',
        color: 'text-orange-600 dark:text-orange-400',
      };
    } else {
      return {
        label: 'Not Recommended',
        description: 'Very high risk',
        color: 'text-red-600 dark:text-red-400',
      };
    }
  };

  const details = getDetails(score);

  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-center gap-2">
        <AIScoreBadge score={score} size="sm" showIcon={false} />
        <span className={cn('text-sm font-medium', details.color)}>{details.label}</span>
      </div>
      <span className="text-xs text-muted-foreground">{details.description}</span>
    </div>
  );
}
