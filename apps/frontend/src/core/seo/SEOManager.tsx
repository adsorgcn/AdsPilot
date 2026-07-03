'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// SEO元数据接口
interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  openGraph?: {
    title?: string;
    description?: string;
    type?: string;
    image?: string;
    url?: string;
    siteName?: string;
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
    title?: string;
    description?: string;
    image?: string;
    site?: string;
    creator?: string;
  };
  jsonLd?: Record<string, any>[];
  robots?: {
    index?: boolean;
    follow?: boolean;
    noimageindex?: boolean;
    notranslate?: boolean;
    noarchive?: boolean;
  };
  alternateLanguages?: Record<string, string>;
  viewport?: string;
  themeColor?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  category?: string;
  tags?: string[];
}

// 页面SEO配置
interface PageSEOConfig {
  path: string;
  static: SEOMetadata;
  dynamic?: (params: Record<string, string>) => Partial<SEOMetadata>;
}

// 默认SEO配置
const DEFAULT_SEO_CONFIG: Partial<SEOMetadata> = {
  title: 'Google-Monetize - 智能广告管理平台',
  description: '专业的广告管理平台，提供智能广告优化、数据分析、ROI提升等功能。帮助广告主和开发者实现广告收益最大化。',
  keywords: ['广告管理', '广告优化', '数据分析', 'ROI提升', '智能广告'],
  viewport: 'width=device-width, initial-scale=1.0',
  themeColor: '#3b82f6',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    siteName: 'Google-Monetize',
    image: '/images/og-default.jpg',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@gm',
  },
};

// 页面SEO配置映射
const PAGE_SEO_CONFIGS: PageSEOConfig[] = [
  {
    path: '/',
    static: {
      title: 'Google-Monetize - 智能广告管理平台 | 最大化广告收益',
      description: 'Google-Monetize是专业的智能广告管理平台，提供AI驱动的广告优化、实��数据分析、A/B测试等功能。帮助您的业务实现广告收益最大化，降低运营成本。',
      keywords: ['智能广告', '广告管理', 'AI优化', '收益最大化', '数据分析'],
      openGraph: {
        type: 'website',
        title: 'Google-Monetize - 智能广告管理平台',
        description: '专业的智能广告管理平台，AI驱动，收益最大化',
        image: '/images/og-home.jpg',
      },
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Google-Monetize',
          description: '智能广告管理平台',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
        },
      ],
    },
  },
  {
    path: '/pricing',
    static: {
      title: '定价方案 - Google-Monetize | 灵活的定价策略',
      description: 'Google-Monetize提供灵活的定价方案，从免费版到企业版，满足不同规模业务需求。透明定价，无隐藏费用，随时升级或降级。',
      keywords: ['定价', '价格', '订阅', '计划', '费用'],
      openGraph: {
        type: 'website',
        title: 'Google-Monetize定价方案',
        description: '灵活的定价策略，满足各种业务需求',
        image: '/images/og-pricing.jpg',
      },
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'OfferCatalog',
          name: 'Google-Monetize定价方案',
          description: 'Google-Monetize平台的定价计划',
        },
      ],
    },
  },
  {
    path: '/features',
    static: {
      title: '功能特性 - Google-Monetize | 强大的广告管理工具',
      description: 'Google-Monetize提供全面的广告管理功能：智能优化、实时监控、A/B测试、多平台支持、数据分析等。一站式解决您的广告管理需求。',
      keywords: ['功能', '特性', '工具', '智能优化', '实时监控'],
      openGraph: {
        type: 'website',
        title: 'Google-Monetize功能特性',
        description: '强大的广告管理工具集',
        image: '/images/og-features.jpg',
      },
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Google-Monetize功能特性',
          description: '全面的广告管理服务',
          provider: {
            '@type': 'Organization',
            name: 'Google-Monetize',
          },
        },
      ],
    },
  },
  {
    path: '/about',
    static: {
      title: '关于我们 - Google-Monetize | 团队与使命',
      description: '了解Google-Monetize团队、我们的使命和价值观。我们致力于为广告主和开发者提供最优秀的广告管理解决方案，让广告投放更简单、更智能。',
      keywords: ['关于', '��队', '使命', '公司介绍', '发展历程'],
      openGraph: {
        type: 'website',
        title: '关于Google-Monetize',
        description: '了解我们的团队和使命',
        image: '/images/og-about.jpg',
      },
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Google-Monetize',
          description: '智能广告管理平台',
          url: 'https://gm.com',
          logo: '/images/logo.png',
        },
      ],
    },
  },
  {
    path: '/app/offers',
    static: {
      title: '广告优惠管理 - Google-Monetize',
      description: '管理和优化您的广告优惠，提高转化率和ROI。智能推荐、数据分析、A/B测试等功能助力广告成功。',
      robots: {
        index: false, // 应用内页面不索引
        follow: false,
      },
    },
  },
  {
    path: '/app/tasks',
    static: {
      title: '任务管理 - Google-Monetize',
      description: '高效管理广告任务，跟踪进度，优化流程。提升团队协作效率。',
      robots: {
        index: false,
        follow: false,
      },
    },
  },
  {
    path: '/dashboard',
    static: {
      title: '仪表板 - Google-Monetize',
      description: '查看您的广告数据概览，关键指标一目了然。实时监控、智能分析、决策支持。',
      robots: {
        index: false,
        follow: false,
      },
    },
  },
];

// SEO管理器Hook
export function useSEOManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 更新页面元数据
  const updateMetadata = (metadata: SEOMetadata) => {
    // 更新标题
    document.title = metadata.title;

    // 更新或创建meta标签
    const updateMetaTag = (name: string, content: string, property?: boolean) => {
      let element: HTMLMetaElement | null = document.querySelector(
        property ? `meta[property="${name}"]` : `meta[name="${name}"]`
      );

      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    };

    // 更新基本meta标签
    updateMetaTag('description', metadata.description);
    updateMetaTag('viewport', metadata.viewport || 'width=device-width, initial-scale=1.0');
    updateMetaTag('theme-color', metadata.themeColor || '#3b82f6');

    if (metadata.keywords && metadata.keywords.length > 0) {
      updateMetaTag('keywords', metadata.keywords.join(', '));
    }

    if (metadata.author) {
      updateMetaTag('author', metadata.author);
    }

    if (metadata.canonical) {
      updateMetaTag('canonical', metadata.canonical);
    }

    // 更新Open Graph标签
    if (metadata.openGraph) {
      updateMetaTag('og:title', metadata.openGraph.title || metadata.title, true);
      updateMetaTag('og:description', metadata.openGraph.description || metadata.description, true);
      updateMetaTag('og:type', metadata.openGraph.type || 'website', true);
      updateMetaTag('og:image', metadata.openGraph.image || '/images/og-default.jpg', true);
      updateMetaTag('og:url', metadata.openGraph.url || window.location.href, true);
      updateMetaTag('og:site_name', metadata.openGraph.siteName || 'Google-Monetize', true);
    }

    // 更新Twitter卡片标签
    if (metadata.twitter) {
      updateMetaTag('twitter:card', metadata.twitter.card || 'summary_large_image');
      updateMetaTag('twitter:title', metadata.twitter.title || metadata.title);
      updateMetaTag('twitter:description', metadata.twitter.description || metadata.description);
      updateMetaTag('twitter:image', metadata.twitter.image || '/images/og-default.jpg');
      if (metadata.twitter.site) {
        updateMetaTag('twitter:site', metadata.twitter.site);
      }
      if (metadata.twitter.creator) {
        updateMetaTag('twitter:creator', metadata.twitter.creator);
      }
    }

    // 更新robots标签
    if (metadata.robots) {
      const robotsDirectives = [
        metadata.robots.index !== false ? 'index' : 'noindex',
        metadata.robots.follow !== false ? 'follow' : 'nofollow',
        metadata.robots.noimageindex ? 'noimageindex' : '',
        metadata.robots.notranslate ? 'notranslate' : '',
        metadata.robots.noarchive ? 'noarchive' : '',
      ].filter(Boolean).join(', ');

      updateMetaTag('robots', robotsDirectives);
    }

    // 更新时间相关的meta标签
    if (metadata.publishedTime) {
      updateMetaTag('article:published_time', metadata.publishedTime, true);
    }
    if (metadata.modifiedTime) {
      updateMetaTag('article:modified_time', metadata.modifiedTime, true);
    }

    // 更新分类和标签
    if (metadata.category) {
      updateMetaTag('article:section', metadata.category, true);
    }
    if (metadata.tags && metadata.tags.length > 0) {
      updateMetaTag('article:tag', metadata.tags.join(', '), true);
    }

    // 更新语言alternate链接
    if (metadata.alternateLanguages) {
      Object.entries(metadata.alternateLanguages).forEach(([lang, url]) => {
        updateMetaTag('alternate', url);
        const lastElement = document.querySelector('meta[name="alternate"]:last-of-type') as HTMLMetaElement;
        if (lastElement) {
          lastElement.setAttribute('hreflang', lang);
        }
      });
    }

    // 更新JSON-LD结构化数据
    updateJsonLd(metadata.jsonLd || []);
  };

  // 更新JSON-LD结构化数据
  const updateJsonLd = (jsonData: Record<string, any>[]) => {
    // 移除现有的JSON-LD脚本
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());

    // 添加新的JSON-LD脚本
    jsonData.forEach(data => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    });
  };

  // 获取页面SEO配置
  const getPageSEOConfig = (path: string, params: Record<string, string> = {}): SEOMetadata => {
    const pageConfig = PAGE_SEO_CONFIGS.find(config => {
      if (config.path === path) return true;
      if (config.path.endsWith('*') && path.startsWith(config.path.slice(0, -1))) return true;
      return false;
    });

    if (!pageConfig) {
      return DEFAULT_SEO_CONFIG as SEOMetadata;
    }

    let metadata = { ...DEFAULT_SEO_CONFIG, ...pageConfig.static };

    // 应用动态配置
    if (pageConfig.dynamic) {
      const dynamicConfig = pageConfig.dynamic(params);
      metadata = { ...metadata, ...dynamicConfig };
    }

    // 设置canonical URL
    metadata.canonical = `https://gm.com${path}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;

    return metadata as SEOMetadata;
  };

  // 应用SEO配置
  const applySEO = (customMetadata?: Partial<SEOMetadata>) => {
    const config = getPageSEOConfig(pathname, Object.fromEntries(searchParams.entries()));
    const finalMetadata = customMetadata ? { ...config, ...customMetadata } : config;
    updateMetadata(finalMetadata);
  };

  // 自动应用SEO配置
  useEffect(() => {
    applySEO();
  }, [pathname, searchParams]);

  return {
    applySEO,
    updateMetadata,
    getPageSEOConfig,
    DEFAULT_SEO_CONFIG,
    PAGE_SEO_CONFIGS,
  };
}

// SEO组件
interface SEOProps {
  metadata?: Partial<SEOMetadata>;
  children?: React.ReactNode;
}

export function SEO({ metadata, children }: SEOProps) {
  const { applySEO } = useSEOManager();

  useEffect(() => {
    if (metadata) {
      applySEO(metadata);
    }
  }, [metadata, applySEO]);

  return <>{children}</>;
}

// 页面SEO组件
interface PageSEOProps {
  path: string;
  params?: Record<string, string>;
  customMetadata?: Partial<SEOMetadata>;
}

export function PageSEO({ path, params = {}, customMetadata }: PageSEOProps) {
  const { getPageSEOConfig, updateMetadata } = useSEOManager();

  useEffect(() => {
    const config = getPageSEOConfig(path, params);
    const finalMetadata = customMetadata ? { ...config, ...customMetadata } : config;
    updateMetadata(finalMetadata);
  }, [path, params, customMetadata, getPageSEOConfig, updateMetadata]);

  return null;
}

// 动态SEO Hook（用于动态页面）
export function useDynamicSEO(basePath: string) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { applySEO } = useSEOManager();

  const updateDynamicSEO = (dynamicData: {
    title?: string;
    description?: string;
    image?: string;
    customMetadata?: Partial<SEOMetadata>;
  }) => {
    const customMetadata: Partial<SEOMetadata> = {
      ...dynamicData.customMetadata,
    };

    if (dynamicData.title) {
      customMetadata.title = dynamicData.title;
    }
    if (dynamicData.description) {
      customMetadata.description = dynamicData.description;
    }
    if (dynamicData.image) {
      customMetadata.openGraph = {
        ...customMetadata.openGraph,
        image: dynamicData.image,
      };
      customMetadata.twitter = {
        ...customMetadata.twitter,
        image: dynamicData.image,
      };
    }

    applySEO(customMetadata);
  };

  useEffect(() => {
    // 如果当前路径匹配基础路径，应用动态SEO
    if (pathname.startsWith(basePath)) {
      // 这里可以根据路径参数动态生成SEO数据
      const pathSegments = pathname.replace(basePath, '').split('/').filter(Boolean);

      if (pathSegments.length > 0) {
        // 动态页面的SEO逻辑
        const dynamicId = pathSegments[0];
        updateDynamicSEO({
          title: `${dynamicId} - Google-Monetize`,
          description: `查看${dynamicId}的详细信息和数据`,
        });
      }
    }
  }, [pathname, basePath]);

  return {
    updateDynamicSEO,
  };
}