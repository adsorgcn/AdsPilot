/**
 * PageLayout 组件库
 *
 * 提供统一的页面布局组件，确保整个应用的UI一致性
 *
 * ## 组件列表
 *
 * - `PageContainer` - 基础容器组件（其他组件的基础）
 * - `DashboardPageLayout` - Dashboard页面布局 (max-w-7xl)
 * - `SettingsPageLayout` - Settings页面布局 (max-w-4xl)
 * - `MarketingPageLayout` - 营销页面布局 (max-w-6xl)
 * - `AdminPageLayout` - 管理员页面布局 (max-w-7xl)
 * - `FullWidthPageLayout` - 全宽页面布局 (无限制)
 *
 * ## 使用指南
 *
 * ### 快速选择
 *
 * | 页面类型 | 使用组件 | Max Width | 说明 |
 * |---------|---------|-----------|------|
 * | /dashboard/* | DashboardPageLayout | 7xl (1280px) | Dashboard相关页面 |
 * | /settings/* | SettingsPageLayout | 4xl (896px) | 设置页面，窄一些更适合表单 |
 * | (site)/* | MarketingPageLayout | 6xl (1152px) | 营销页面 |
 * | /manage/* | AdminPageLayout | 7xl (1280px) | 管理员页面 |
 * | /auth/* | FullWidthPageLayout | - | 认证页面，全屏居中 |
 *
 * ### 基本用法
 *
 * ```tsx
 * import { DashboardPageLayout } from '~/core/ui/PageLayout';
 *
 * export default function MyDashboardPage() {
 *   return (
 *     <DashboardPageLayout>
 *       <div className="flex flex-col gap-6">
 *         {your content here}
 *       </div>
 *     </DashboardPageLayout>
 *   );
 * }
 * ```
 *
 * ### 自定义用法
 *
 * 如果标准布局不满足需求，可以使用 `PageContainer`:
 *
 * ```tsx
 * import { PageContainer } from '~/core/ui/PageLayout';
 *
 * export default function CustomPage() {
 *   return (
 *     <PageContainer maxWidth="5xl" padding="lg">
 *       {content}
 *     </PageContainer>
 *   );
 * }
 * ```
 *
 * ## 设计原则
 *
 * 1. **一致性优先**: 同类型页面使用相同布局
 * 2. **响应式设计**: 所有组件支持移动端
 * 3. **易于维护**: 修改布局只需改一个组件
 * 4. **类型安全**: 完整的 TypeScript 类型定义
 *
 * ## 迁移指南
 *
 * 从旧的布局方式迁移到新组件:
 *
 * ### Before (多种方式，不一致)
 *
 * ```tsx
 * // 方式1
 * <PageBody>
 *   <div className="mx-auto w-full max-w-7xl">...</div>
 * </PageBody>
 *
 * // 方式2
 * <Container>...</Container>
 *
 * // 方式3
 * <SettingsContentContainer>...</SettingsContentContainer>
 * ```
 *
 * ### After (统一方式)
 *
 * ```tsx
 * // Dashboard
 * <DashboardPageLayout>...</DashboardPageLayout>
 *
 * // Settings
 * <SettingsPageLayout>...</SettingsPageLayout>
 *
 * // Marketing
 * <MarketingPageLayout>...</MarketingPageLayout>
 * ```
 *
 * ## 注意事项
 *
 * 1. **不要嵌套使用**: PageLayout组件已经包含padding和max-width，不要再包一层Container
 * 2. **保持简洁**: 页面内容直接放在PageLayout内，不要添加多余的div
 * 3. **遵循规范**: 使用推荐的gap值 (gap-4, gap-6, gap-8)
 *
 * ## 相关文档
 *
 * - [完整分析文档](../../../docs/TestAll/PAGE_LAYOUT_ANALYSIS.md)
 * - [UI一致性检查](../../../scripts/review/check-ui-consistency.mjs)
 */

export { PageContainer } from './PageContainer';
export type { PageContainerProps } from './PageContainer';

export { DashboardPageLayout } from './DashboardPageLayout';
export type { DashboardPageLayoutProps } from './DashboardPageLayout';

export { SettingsPageLayout } from './SettingsPageLayout';
export type { SettingsPageLayoutProps } from './SettingsPageLayout';

export { MarketingPageLayout } from './MarketingPageLayout';
export type { MarketingPageLayoutProps } from './MarketingPageLayout';

export { AdminPageLayout } from './AdminPageLayout';
export type { AdminPageLayoutProps } from './AdminPageLayout';

export { FullWidthPageLayout } from './FullWidthPageLayout';
export type { FullWidthPageLayoutProps } from './FullWidthPageLayout';
