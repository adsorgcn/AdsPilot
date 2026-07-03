'use client';

import classNames from 'clsx';

type ScoreDisplayProps = {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
};

const sizeClass: Record<NonNullable<ScoreDisplayProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
};

export default function ScoreDisplay({
  score,
  size = 'md',
  showBadge = false,
}: ScoreDisplayProps) {
  const color = getColor(score);

  return (
    <div className="flex items-center gap-2">
      <span
        className={classNames(
          'font-semibold',
          sizeClass[size],
          color.text,
        )}
      >
        {score}
      </span>

      {showBadge ? (
        <span
          className={classNames(
            'rounded-full px-2 py-1 text-xs font-medium',
            color.badge,
          )}
        >
          {getBadgeLabel(score)}
        </span>
      ) : null}
    </div>
  );
}

function getColor(score: number) {
  if (score >= 80) {
    return { text: 'text-success-600', badge: 'bg-success-100 text-success-700' };
  }

  if (score >= 60) {
    return { text: 'text-brand-600', badge: 'bg-brand-100 text-brand-700' };
  }

  if (score >= 40) {
    return { text: 'text-warning-600', badge: 'bg-warning-100 text-warning-700' };
  }

  return { text: 'text-error-600', badge: 'bg-error-100 text-error-700' };
}

function getBadgeLabel(score: number) {
  if (score >= 80) {
    return '优秀';
  }

  if (score >= 60) {
    return '良好';
  }

  if (score >= 40) {
    return '一般';
  }

  return '较差';
}
