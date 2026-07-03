import { PageContainer } from './PageContainer';

export interface MarketingPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: '5xl' | '6xl' | '7xl';
}

/**
 * MarketingPageLayout - 营销页面专用布局
 *
 * 特点:
 * - 默认最大宽度: 6xl (1152px)
 * - 较大padding: px-6 py-12
 * - 适用于: (site)/* 所有营销页面
 *
 * @example
 * ```tsx
 * export default function AboutPage() {
 *   return (
 *     <MarketingPageLayout>
 *       <h1>About Us</h1>
 *       {content}
 *     </MarketingPageLayout>
 *   );
 * }
 * ```
 */
export function MarketingPageLayout({
  children,
  className,
  maxWidth = '6xl',
}: MarketingPageLayoutProps) {
  return (
    <PageContainer maxWidth={maxWidth} padding="lg" className={className}>
      {children}
    </PageContainer>
  );
}
