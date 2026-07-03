import type { ReactNode } from 'react';
import SeoStructuredData from '~/components/SeoStructuredData';
import { buildWebSiteStructuredData, buildOrganizationStructuredData } from '~/lib/structured-data';
import configuration from '~/configuration';

type StructuredDataProviderProps = {
  title: string;
  description: string;
  locale: string;
  children: ReactNode;
};

/**
 * StructuredDataProvider - SEO 结构化数据提供器
 *
 * 为页面添加组织和网站的结构化数据
 */
export default function StructuredDataProvider({
  title,
  description,
  locale,
  children,
}: StructuredDataProviderProps) {
  // 构建组织结构化数据
  const organizationData = buildOrganizationStructuredData({
    name: configuration.site.siteName,
    description,
    locale,
  });

  // 构建网站结构化数据
  const webSiteData = buildWebSiteStructuredData({
    title,
    description,
    locale,
  });

  return (
    <>
      <SeoStructuredData data={organizationData} />
      <SeoStructuredData data={webSiteData} />
      {children}
    </>
  );
}
