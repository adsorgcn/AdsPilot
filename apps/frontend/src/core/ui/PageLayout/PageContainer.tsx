import { cn } from '~/core/generic/shadcn-utils';

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  padding?: boolean | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * PageContainer - 基础页面容器组件
 *
 * 提供统一的页面容器，包括:
 * - 响应式最大宽度限制
 * - 可配置的padding
 * - 自动居中
 *
 * @example
 * ```tsx
 * <PageContainer maxWidth="7xl" padding="lg">
 *   <YourContent />
 * </PageContainer>
 * ```
 */
export function PageContainer({
  children,
  maxWidth = '7xl',
  padding = true,
  className,
}: PageContainerProps) {
  const paddingClasses = {
    false: '',
    true: 'px-4 py-8 sm:px-6 lg:px-8',
    sm: 'px-3 py-4 sm:px-4 lg:px-6',
    md: 'px-4 py-8 sm:px-6 lg:px-8',
    lg: 'px-6 py-12 sm:px-8 lg:px-12',
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',      // 384px
    md: 'max-w-md',      // 448px
    lg: 'max-w-lg',      // 512px
    xl: 'max-w-xl',      // 576px
    '2xl': 'max-w-2xl',  // 672px
    '3xl': 'max-w-3xl',  // 768px
    '4xl': 'max-w-4xl',  // 896px
    '5xl': 'max-w-5xl',  // 1024px
    '6xl': 'max-w-6xl',  // 1152px
    '7xl': 'max-w-7xl',  // 1280px
    full: 'max-w-full',
  };

  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidth !== 'full' && maxWidthClasses[maxWidth],
        paddingClasses[padding === true ? 'md' : padding === false ? 'false' : padding],
        className
      )}
    >
      {children}
    </div>
  );
}
