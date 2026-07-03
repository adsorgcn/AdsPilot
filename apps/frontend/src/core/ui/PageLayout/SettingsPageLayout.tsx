import { PageContainer } from './PageContainer';

export interface SettingsPageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * SettingsPageLayout - Settings页面专用布局
 *
 * 特点:
 * - 最大宽度: 4xl (896px) - 适合表单和设置项
 * - 标准padding: px-4 py-8
 * - 适用于: /settings/* 所有页面
 *
 * @example
 * ```tsx
 * export default function ProfileSettings() {
 *   return (
 *     <SettingsPageLayout>
 *       <Section>
 *         {settingsContent}
 *       </Section>
 *     </SettingsPageLayout>
 *   );
 * }
 * ```
 */
export function SettingsPageLayout({
  children,
  className,
}: SettingsPageLayoutProps) {
  return (
    <PageContainer maxWidth="4xl" padding="md" className={className}>
      {children}
    </PageContainer>
  );
}
