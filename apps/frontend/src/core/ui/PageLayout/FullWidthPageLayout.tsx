import { cn } from '~/core/generic/shadcn-utils';

export interface FullWidthPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}

/**
 * FullWidthPageLayout - 全宽页面布局
 *
 * 特点:
 * - 无最大宽度限制
 * - 可选垂直居中
 * - 最小padding
 * - 适用于: 认证页面、落地页等需要全屏的场景
 *
 * @example
 * ```tsx
 * export default function SignInPage() {
 *   return (
 *     <FullWidthPageLayout centered>
 *       <SignInForm />
 *     </FullWidthPageLayout>
 *   );
 * }
 * ```
 */
export function FullWidthPageLayout({
  children,
  className,
  centered = false,
}: FullWidthPageLayoutProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-8',
        centered && 'flex min-h-screen items-center justify-center',
        className
      )}
    >
      {children}
    </div>
  );
}
