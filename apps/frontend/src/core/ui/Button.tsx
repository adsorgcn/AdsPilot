'use client';

import Link from 'next/link';
import { cn as classNames } from '~/core/generic/shadcn-utils';
import { cva, VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

import If from '~/core/ui/If';
import Spinner from '~/core/ui/Spinner';

type Size = 'default' | 'small' | 'large' | 'custom' | 'sm' | 'lg';

const large = `[&>*]:py-2.5 [&>*]:px-6 h-14 text-lg`;
const small = `[&>*]:py-2 [&>*]:px-3 text-xs`;

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg text-sm font-medium',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    'ring-offset-background',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          // 渐变背景
          'bg-gradient-to-r from-primary via-primary to-primary/90',
          'hover:from-primary/90 hover:via-primary/95 hover:to-primary/85',
          // 文字
          'text-primary-foreground',
          // 阴影
          'shadow-sm hover:shadow-md active:shadow-sm',
          'dark:shadow-primary/20 dark:hover:shadow-primary/40',
          // hover效果
          'hover:-translate-y-0.5 active:translate-y-0',
        ].join(' '),

        destructive: [
          'bg-gradient-to-r from-destructive to-destructive/90',
          'hover:from-destructive/90 hover:to-destructive/85',
          'text-destructive-foreground',
          'shadow-sm hover:shadow-md',
          'hover:-translate-y-0.5 active:translate-y-0',
        ].join(' '),

        outline: [
          'border border-input',
          'bg-transparent',
          'hover:bg-muted/50',
          'text-foreground',
        ].join(' '),

        outlinePrimary: [
          'border-2 border-primary',
          'bg-transparent',
          'hover:bg-primary/5',
          'text-primary',
        ].join(' '),

        secondary: [
          'bg-secondary',
          'hover:bg-secondary/80',
          'text-secondary-foreground',
        ].join(' '),

        ghost: [
          'bg-transparent',
          'hover:bg-muted/50',
          'text-foreground/70',
          'hover:text-foreground',
          'active:bg-muted/70',
        ].join(' '),

        link: [
          'underline-offset-4',
          'hover:underline',
          'text-primary',
        ].join(' '),

        transparent: [
          'bg-transparent',
          'hover:bg-accent',
          'hover:text-accent-foreground',
        ].join(' '),

        flat: [
          'bg-primary/5',
          'text-primary',
          'hover:bg-primary/10',
        ].join(' '),

        custom: '',
      },
      size: {
        default: 'h-10 py-2 px-4',
        small: 'h-9 px-3 text-xs',
        sm: 'h-9 px-3 text-xs',
        large: 'h-11 px-8 text-lg',
        lg: 'h-11 px-8 text-lg',
        icon: 'h-9 w-9',
        custom: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  block?: boolean;
  round?: boolean;
  loading?: boolean;
  href?: Maybe<string>;
}

const defaultSize: Size = `default`;
const defaultVariant = `default`;

const Button: React.FCC<ButtonProps> = forwardRef<
  React.ElementRef<'button'>,
  ButtonProps
>(function ButtonComponent(
  { children, color, size, variant, block, loading, href, round, ...props },
  ref,
) {
  const className = classNames(
    buttonVariants({
      variant: variant ?? defaultVariant,
      size: size ?? defaultSize,
    }),
    block ? `w-full` : ``,
    loading ? `opacity-80` : ``,
    round ? 'rounded-full' : '',
    props.className,
  );

  return (
    <button
      {...props}
      tabIndex={href ? -1 : 0}
      ref={ref}
      className={className}
      disabled={loading || props.disabled}
    >
      <InnerButtonContainerElement href={href} disabled={props.disabled}>
        <span
          className={classNames(
            `flex w-full flex-1 items-center justify-center`,
          )}
        >
          <If condition={loading}>
            <Animation />
          </If>

          {children}
        </span>
      </InnerButtonContainerElement>
    </button>
  );
});

function Animation() {
  return (
    <span className={'mx-2'}>
      <Spinner className={'mx-auto !h-4 !w-4 fill-white dark:fill-white'} />
    </span>
  );
}

function InnerButtonContainerElement({
  children,
  href,
  disabled,
}: React.PropsWithChildren<{
  href: Maybe<string>;
  disabled?: boolean;
}>) {
  const className = `flex w-full h-full items-center transition-transform duration-500 ease-out`;

  if (href && !disabled) {
    return (
      <Link className={className} href={href}>
        {children}
      </Link>
    );
  }

  return <span className={className}>{children}</span>;
}

export default Button;

export { Button, buttonVariants };
