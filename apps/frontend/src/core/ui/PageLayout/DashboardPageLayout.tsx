import { PageContainer } from './PageContainer';

export interface DashboardPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: {
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    actions?: React.ReactNode;
  };
}

/**
 * DashboardPageLayout - Dashboard页面专用布局
 *
 * 特点:
 * - 最大宽度: 7xl (1280px)
 * - 标准padding: px-4 py-8
 * - 适用于: /dashboard/* 所有页面
 *
 * @example
 * ```tsx
 * export default function DashboardPage() {
 *   return (
 *     <DashboardPageLayout
 *       header={{
 *         title: "Dashboard",
 *         description: "Overview of your activities"
 *       }}
 *     >
 *       <div className="flex flex-col gap-6">
 *         {content}
 *       </div>
 *     </DashboardPageLayout>
 *   );
 * }
 * ```
 */
export function DashboardPageLayout({
  children,
  className,
  header,
}: DashboardPageLayoutProps) {
  return (
    <PageContainer maxWidth="7xl" padding="md" className={className}>
      {header && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">{header.title}</h1>
            {header.actions && <div>{header.actions}</div>}
          </div>
          {header.description && (
            <p className="text-muted-foreground">{header.description}</p>
          )}
        </div>
      )}
      {children}
    </PageContainer>
  );
}
