'use client';

// 结构化数据类型定义
interface StructuredDataType {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

// 组织信息结构化数据
export function createOrganizationStructuredData(data: {
  name: string;
  description: string;
  url: string;
  logo?: string;
  contactPoint?: {
    telephone?: string;
    email?: string;
    contactType?: string;
  };
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  socialMedia?: Array<{
    platform: string;
    url: string;
  }>;
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    description: data.description,
    url: data.url,
    logo: data.logo,
    contactPoint: data.contactPoint ? {
      '@type': 'ContactPoint',
      telephone: data.contactPoint.telephone,
      email: data.contactPoint.email,
      contactType: data.contactPoint.contactType || 'customer service',
    } : undefined,
    address: data.address ? {
      '@type': 'PostalAddress',
      streetAddress: data.address.streetAddress,
      addressLocality: data.address.addressLocality,
      addressRegion: data.address.addressRegion,
      postalCode: data.address.postalCode,
      addressCountry: data.address.addressCountry,
    } : undefined,
    sameAs: data.socialMedia?.map(sm => sm.url),
  };
}

// 软件应用结构化数据
export function createSoftwareApplicationStructuredData(data: {
  name: string;
  description: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  offers?: {
    price?: string;
    priceCurrency?: string;
    availability?: string;
  };
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
    bestRating?: number;
    worstRating?: number;
  };
  screenshot?: string;
  author?: {
    name: string;
    url: string;
  };
  publisher?: {
    name: string;
    url: string;
  };
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: data.name,
    description: data.description,
    url: data.url,
    applicationCategory: data.applicationCategory,
    operatingSystem: data.operatingSystem,
    offers: data.offers ? {
      '@type': 'Offer',
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency || 'USD',
      availability: data.offers.availability || 'https://schema.org/InStock',
    } : undefined,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
      bestRating: data.aggregateRating.bestRating || 5,
      worstRating: data.aggregateRating.worstRating || 1,
    } : undefined,
    screenshot: data.screenshot,
    author: data.author ? {
      '@type': 'Organization',
      name: data.author.name,
      url: data.author.url,
    } : undefined,
    publisher: data.publisher ? {
      '@type': 'Organization',
      name: data.publisher.name,
      url: data.publisher.url,
    } : undefined,
  };
}

// 服务结构化数据
export function createServiceStructuredData(data: {
  name: string;
  description: string;
  provider: {
    name: string;
    url: string;
  };
  serviceType: string;
  areaServed?: string;
  hasOfferCatalog?: {
    name: string;
    itemListElement: Array<{
      name: string;
      description?: string;
      offers?: {
        price?: string;
        priceCurrency?: string;
      };
    }>;
  };
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: data.name,
    description: data.description,
    provider: {
      '@type': 'Organization',
      name: data.provider.name,
      url: data.provider.url,
    },
    serviceType: data.serviceType,
    areaServed: data.areaServed,
    hasOfferCatalog: data.hasOfferCatalog ? {
      '@type': 'OfferCatalog',
      name: data.hasOfferCatalog.name,
      itemListElement: data.hasOfferCatalog.itemListElement.map(item => ({
        '@type': 'Offer',
        name: item.name,
        description: item.description,
        offers: item.offers ? {
          '@type': 'Offer',
          price: item.offers.price,
          priceCurrency: item.offers.priceCurrency || 'USD',
        } : undefined,
      })),
    } : undefined,
  };
}

// 文章结构化数据
export function createArticleStructuredData(data: {
  headline: string;
  description: string;
  author: {
    name: string;
    url?: string;
  };
  publisher: {
    name: string;
    logo?: string;
    url?: string;
  };
  datePublished: string;
  dateModified?: string;
  image?: string;
  articleSection?: string;
  wordCount?: number;
  keywords?: string[];
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    author: {
      '@type': 'Person',
      name: data.author.name,
      url: data.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: data.publisher.name,
      logo: data.publisher.logo ? {
        '@type': 'ImageObject',
        url: data.publisher.logo,
      } : undefined,
      url: data.publisher.url,
    },
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    image: data.image,
    articleSection: data.articleSection,
    wordCount: data.wordCount,
    keywords: data.keywords?.join(', '),
  };
}

// 产品结构化数据
export function createProductStructuredData(data: {
  name: string;
  description: string;
  brand?: {
    name: string;
    url?: string;
  };
  offers?: Array<{
    price: string;
    priceCurrency: string;
    availability?: string;
    seller?: string;
    validFrom?: string;
  }>;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
  reviews?: Array<{
    author: string;
    datePublished: string;
    reviewRating: {
      ratingValue: number;
      bestRating?: number;
    };
    reviewBody?: string;
  }>;
  images?: string[];
  sku?: string;
  gtin?: string;
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.name,
    description: data.description,
    brand: data.brand ? {
      '@type': 'Brand',
      name: data.brand.name,
      url: data.brand.url,
    } : undefined,
    offers: data.offers?.map(offer => ({
      '@type': 'Offer',
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      availability: offer.availability || 'https://schema.org/InStock',
      seller: offer.seller ? {
        '@type': 'Organization',
        name: offer.seller,
      } : undefined,
      validFrom: offer.validFrom,
    })),
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
    review: data.reviews?.map(review => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.author,
      },
      datePublished: review.datePublished,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.reviewRating.ratingValue,
        bestRating: review.reviewRating.bestRating || 5,
      },
      reviewBody: review.reviewBody,
    })),
    image: data.images,
    sku: data.sku,
    gtin: data.gtin,
  };
}

// FAQ结构化数据
export function createFAQStructuredData(faqs: Array<{
  question: string;
  answer: string;
}>): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// 面包屑导航结构化数据
export function createBreadcrumbStructuredData(items: Array<{
  name: string;
  url: string;
}>): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// 网站搜索框结构化数据
export function createWebsiteSearchStructuredData(data: {
  url: string;
  target: string;
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: data.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: data.target,
      'query-input': 'required name=search_term_string',
    },
  };
}

// 课程结构化数据
export function createCourseStructuredData(data: {
  name: string;
  description: string;
  provider: {
    name: string;
    url: string;
  };
  hasCourseInstance?: {
    courseMode: string;
    instructor: {
      name: string;
    };
  };
  offers?: {
    price: string;
    priceCurrency: string;
    availability?: string;
  };
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: data.name,
    description: data.description,
    provider: {
      '@type': 'Organization',
      name: data.provider.name,
      url: data.provider.url,
    },
    hasCourseInstance: data.hasCourseInstance ? {
      '@type': 'CourseInstance',
      courseMode: data.hasCourseInstance.courseMode,
      instructor: {
        '@type': 'Person',
        name: data.hasCourseInstance.instructor.name,
      },
    } : undefined,
    offers: data.offers ? {
      '@type': 'Offer',
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency,
      availability: data.offers.availability || 'https://schema.org/InStock',
    } : undefined,
    aggregateRating: data.aggregateRating ? {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
    } : undefined,
  };
}

// 事件结构化数据
export function createEventStructuredData(data: {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  location: {
    name: string;
    address?: string;
  };
  offers?: {
    price: string;
    priceCurrency: string;
    availability?: string;
    url?: string;
  };
  performer?: Array<{
    name: string;
  }>;
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: data.name,
    description: data.description,
    startDate: data.startDate,
    endDate: data.endDate,
    location: {
      '@type': 'Place',
      name: data.location.name,
      address: data.location.address ? {
        '@type': 'PostalAddress',
        streetAddress: data.location.address,
      } : undefined,
    },
    offers: data.offers ? {
      '@type': 'Offer',
      price: data.offers.price,
      priceCurrency: data.offers.priceCurrency,
      availability: data.offers.availability || 'https://schema.org/InStock',
      url: data.offers.url,
    } : undefined,
    performer: data.performer?.map(performer => ({
      '@type': 'PerformingGroup',
      name: performer.name,
    })),
  };
}

// 本地商户结构化数据
export function createLocalBusinessStructuredData(data: {
  name: string;
  description: string;
  url: string;
  telephone?: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  openingHours?: string[];
  geo?: {
    latitude: number;
    longitude: number;
  };
  priceRange?: string;
  servesCuisine?: string[];
}): StructuredDataType {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    url: data.url,
    telephone: data.telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: data.address.streetAddress,
      addressLocality: data.address.addressLocality,
      addressRegion: data.address.addressRegion,
      postalCode: data.address.postalCode,
      addressCountry: data.address.addressCountry,
    },
    openingHours: data.openingHours,
    geo: data.geo ? {
      '@type': 'GeoCoordinates',
      latitude: data.geo.latitude,
      longitude: data.geo.longitude,
    } : undefined,
    priceRange: data.priceRange,
    servesCuisine: data.servesCuisine,
  };
}

// 结构化数据生成器Hook
export function useStructuredData() {
  // 生成并应用结构化数据
  const applyStructuredData = (structuredData: StructuredDataType | StructuredDataType[]) => {
    const data = Array.isArray(structuredData) ? structuredData : [structuredData];

    // 移除现有的结构化数据
    const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
    existingScripts.forEach(script => script.remove());

    // 添加新的结构化数据
    data.forEach(item => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(item, null, 2);
      document.head.appendChild(script);
    });
  };

  return {
    applyStructuredData,
    // 导出所有结构化数据生成函数
    createOrganizationStructuredData,
    createSoftwareApplicationStructuredData,
    createServiceStructuredData,
    createArticleStructuredData,
    createProductStructuredData,
    createFAQStructuredData,
    createBreadcrumbStructuredData,
    createWebsiteSearchStructuredData,
    createCourseStructuredData,
    createEventStructuredData,
    createLocalBusinessStructuredData,
  };
}

// Google-Monetize特定的结构化数据生成器
export function useGoogle-MonetizeStructuredData() {
  const { applyStructuredData } = useStructuredData();

  // 生成Google-Monetize组织信息
  const generateOrganizationData = () => {
    return createOrganizationStructuredData({
      name: 'Google-Monetize',
      description: '专业的智能广告管理平台，提供AI驱动的广告优化、实时数据分析、A/B测试等功能。',
      url: 'https://gm.com',
      logo: '/images/logo.png',
      contactPoint: {
        email: 'support@gm.com',
        contactType: 'customer service',
      },
      socialMedia: [
        { platform: 'Twitter', url: 'https://twitter.com/gm' },
        { platform: 'LinkedIn', url: 'https://linkedin.com/company/gm' },
      ],
    });
  };

  // 生成Google-Monetize软件应用数据
  const generateSoftwareApplicationData = () => {
    return createSoftwareApplicationStructuredData({
      name: 'Google-Monetize',
      description: '智能广告管理平台，帮助广告主和开发者实现广告收益最大化',
      url: 'https://gm.com',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        ratingValue: 4.8,
        reviewCount: 1200,
      },
    });
  };

  // 生成定价页面的服务结构化数据
  const generatePricingServiceData = () => {
    return createServiceStructuredData({
      name: 'Google-Monetize定价方案',
      description: '灵活的定价策略，满足不同规模业务需求',
      provider: {
        name: 'Google-Monetize',
        url: 'https://gm.com',
      },
      serviceType: 'Advertising Management',
      hasOfferCatalog: {
        name: 'Google-Monetize订阅计划',
        itemListElement: [
          {
            name: '免费版',
            description: '适合个人用户和小型项目',
            offers: {
              price: '0',
              priceCurrency: 'USD',
            },
          },
          {
            name: '专业版',
            description: '适合中小企业和专业用户',
            offers: {
              price: '29',
              priceCurrency: 'USD',
            },
          },
          {
            name: '企业版',
            description: '适合大型企业和团队协作',
            offers: {
              price: '99',
              priceCurrency: 'USD',
            },
          },
        ],
      },
    });
  };

  // 生成FAQ结构化数据
  const generateFAQData = () => {
    return createFAQStructuredData([
      {
        question: '什么是Google-Monetize？',
        answer: 'Google-Monetize是一个智能广告管理平台，提供AI驱动的广告优化、实时数据分析、A/B测试等功能，帮助广告主和开发者实现广告收益最大化。',
      },
      {
        question: 'Google-Monetize支持哪些广告平台？',
        answer: 'Google-Monetize支持主流广告平台，包括Google AdSense、Facebook Ads、Amazon Advertising等，并提供统一的API接口进行管理。',
      },
      {
        question: '如何开始使用Google-Monetize？',
        answer: '注册Google-Monetize账户后，您可以连接您的广告平台账户，设置广告位，配置优化规则，即可开始使用我们的智能广告管理功能。',
      },
    ]);
  };

  return {
    applyStructuredData,
    generateOrganizationData,
    generateSoftwareApplicationData,
    generatePricingServiceData,
    generateFAQData,
  };
}