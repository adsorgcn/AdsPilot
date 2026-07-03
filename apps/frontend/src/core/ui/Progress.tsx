'use client';

import classNames from 'clsx';

type ProgressProps = {
  value?: number;
  min?: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
};

const Progress: React.FC<ProgressProps> = ({
  value = 0,
  min = 0,
  max = 100,
  className,
  indicatorClassName,
}) => {
  const clamped = clamp(value, min, max);
  const percentage = max === min ? 0 : ((clamped - min) / (max - min)) * 100;

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={min}
      aria-valuemax={max}
      className={classNames(
        'relative h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
    >
      <div
        className={classNames(
          'h-full w-full origin-left scale-x-0 transform rounded-full bg-primary transition-transform duration-200',
          indicatorClassName,
        )}
        style={{ transform: `scaleX(${percentage / 100})` }}
      />
    </div>
  );
};

export default Progress;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
