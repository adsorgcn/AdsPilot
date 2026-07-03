'use client';

import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';
import { GlobalStateProvider } from '~/core/state/GlobalStateProvider';
import { SEO } from '~/core/seo/SEOManager';
import { useGoogle-MonetizeStructuredData } from '~/core/seo/StructuredData';
import { PerformanceManagerProvider } from '~/core/optimization/PerformanceManager';

interface ProvidersProps {
  children: ReactNode;
}

// SEO组件包装器
function SEOProvider({ children }: { children: ReactNode }) {
  const { generateOrganizationData, generateSoftwareApplicationData } = useGoogle-MonetizeStructuredData();

  useEffect(() => {
    // 应用全局结构化数据
    const structuredData = [
      generateOrganizationData(),
      generateSoftwareApplicationData(),
    ];

    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    scripts.forEach(script => script.remove());

    structuredData.forEach(data => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data, null, 2);
      document.head.appendChild(script);
    });
  }, [generateOrganizationData, generateSoftwareApplicationData]);

  return <>{children}</>;
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <GlobalStateProvider>
      <PerformanceManagerProvider>
        <QueryClientProvider client={queryClient}>
          <SEOProvider>
            <SEO>
              {children}
            </SEO>
          </SEOProvider>
          {process.env.NODE_ENV === 'development' && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
        </QueryClientProvider>
      </PerformanceManagerProvider>
    </GlobalStateProvider>
  );
}