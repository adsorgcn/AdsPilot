'use client';

import { forwardRef, useCallback, useEffect, useState } from 'react';
import classNames from 'clsx';

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onCheckedChange,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const [internalChecked, setInternalChecked] = useState<boolean>(
      defaultChecked ?? false,
    );

    useEffect(() => {
      if (typeof checked === 'boolean') {
        setInternalChecked(checked);
      }
    }, [checked]);

    const isChecked = typeof checked === 'boolean' ? checked : internalChecked;

    const toggle = useCallback(() => {
      if (disabled) {
        return;
      }

      const next = !isChecked;

      if (typeof checked !== 'boolean') {
        setInternalChecked(next);
      }

      onCheckedChange?.(next);
    }, [checked, disabled, isChecked, onCheckedChange]);

    return (
      <button
        {...props}
        ref={ref}
        role="switch"
        type="button"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={toggle}
        className={classNames(
          'relative inline-flex h-6 w-11 items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          isChecked ? 'bg-primary' : 'bg-muted',
          className,
        )}
      >
        <span
          className={classNames(
            'inline-block h-5 w-5 translate-x-0 rounded-full bg-background shadow transition-transform',
            {
              'translate-x-5': isChecked,
            },
          )}
        />
      </button>
    );
  },
);

Switch.displayName = 'Switch';

export default Switch;
