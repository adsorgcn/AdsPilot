'use client';

import { useState } from 'react';

import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShieldExclamationIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

import { cva, VariantProps } from 'class-variance-authority';
import classNames from 'clsx';

import IconButton from '~/core/ui/IconButton';
import If from '~/core/ui/If';

type Type = VariantProps<typeof alertClassNameBuilder>['type'];
type Variant = 'default' | 'destructive';

const icons = {
  success: (className: string) => <CheckCircleIcon className={className} />,
  error: (className: string) => <ExclamationCircleIcon className={className} />,
  warn: (className: string) => <ShieldExclamationIcon className={className} />,
  info: (className: string) => <InformationCircleIcon className={className} />,
};

const alertClassNameBuilder = getClassNameBuilder();
const alertIconClassNameBuilder = getIconClassNameBuilder();

function variantToType(variant: Variant): Type {
  switch (variant) {
    case 'destructive':
      return 'error';
    case 'default':
    default:
      return 'info';
  }
}

const Alert: React.FCC<{
  type?: Type;
  variant?: Variant; // shadcn/ui compatibility
  useCloseButton?: boolean;
  className?: string;
}> & {
  Heading: typeof AlertHeading;
} = ({ children, type, variant, useCloseButton, className }) => {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  // Map shadcn/ui variant to type
  const mappedType = variant ? variantToType(variant) : type || 'info';

  const alertClassName = alertClassNameBuilder({ type: mappedType });
  const alertIconClassName = alertIconClassNameBuilder({ type: mappedType });

  const Icon = icons[mappedType ?? 'info'](alertIconClassName);

  return (
    <div role="alert" className={classNames(alertClassName, className)}>
      <div className={'flex justify-between w-full'}>
        <div className={'flex space-x-2'}>
          <div className={'py-0.5'}>{Icon}</div>

          <div className={'flex flex-col space-y-1'}>{children}</div>
        </div>

        <If condition={useCloseButton ?? false}>
          <div>
            <IconButton
              className={'dark:hover:bg-transparent h-6 w-6'}
              onClick={() => setVisible(false)}
            >
              <XMarkIcon className={'h-5'} />
            </IconButton>
          </div>
        </If>
      </div>
    </div>
  );
};

function AlertHeading({ children }: React.PropsWithChildren) {
  return (
    <h6>
      <span className={'text-base font-medium'}>{children}</span>
    </h6>
  );
}

// Shadcn/ui compatible aliases
function AlertTitle({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <h5 className={classNames("mb-1 font-medium leading-none tracking-tight", className)}>
      {children}
    </h5>
  );
}

function AlertDescription({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={classNames("text-sm [&_p]:leading-relaxed", className)}>
      {children}
    </div>
  );
}

Alert.Heading = AlertHeading;

function getClassNameBuilder() {
  return cva(
    [
      `p-4 animate-in dark:bg-transparent fade-in relative flex items-center justify-between text-gray-700 rounded-lg text-sm border`,
    ],
    {
      variants: {
        type: {
          success: `bg-green-500/5 dark:text-green-500 text-green-800 border-green-500/80`,
          info: `bg-sky-500/5 dark:text-sky-500 text-sky-800 border-sky-800/50 dark:border-sky-500/50`,
          error: `bg-red-500/5 dark:text-red-500 text-red-500 border-red-500/80`,
          warn: `bg-yellow-500/5 dark:text-yellow-500 text-yellow-800 border-yellow-500/80`,
        },
      },
      defaultVariants: {
        type: `info`,
      },
    },
  );
}

function getIconClassNameBuilder() {
  return cva([`rounded-full h-5 w-5`], {
    variants: {
      type: {
        success: `text-green-800 dark:text-green-500`,
        info: `text-sky-800 dark:text-sky-500`,
        error: `text-red-500`,
        warn: `text-yellow-800 dark:text-yellow-500`,
      },
    },
    defaultVariants: {
      type: `info`,
    },
  });
}

export default Alert;

export { Alert, AlertHeading, AlertTitle, AlertDescription };
