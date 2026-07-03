import { PageContainer } from './PageContainer';

export interface AdminPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AdminPageLayout - 管理员页面专用布局
 *
 * 特点:
 * - 最大宽度: 7xl (1280px) - 适合数据表格
 * - 标准padding: px-4 py-8
 * - 适用于: /manage/* 所有管理页面
 *
 * @example
 * ```tsx
 * export default function UsersManagePage() {
 *   return (
 *     <AdminPageLayout>
 *       <DataTable data={users} />
 *     </AdminPageLayout>
 *   );
 * }
 * ```
 */
export function AdminPageLayout({
  children,
  className,
}: AdminPageLayoutProps) {
  return (
    <PageContainer maxWidth="7xl" padding="md" className={className}>
      {children}
    </PageContainer>
  );
}
