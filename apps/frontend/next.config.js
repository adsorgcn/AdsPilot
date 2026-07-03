/** @type {import('next').NextConfig} */
const withAnalyzer = require('@next/bundle-analyzer');

function getRemotePatterns() {
  return [
    {
      protocol: 'https',
      hostname: 'images.unsplash.com',
    },
    {
      protocol: 'https',
      hostname: 'avatars.githubusercontent.com',
    },
    {
      protocol: 'https',
      hostname: '**.supabase.co',
    },
  ];
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // ✅ Next.js 15 实验性功能优化
  experimental: {
    // ✅ 启用Turbopack（开发模式）- Next.js 15新特性
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },

    // ✅ React Server Components优化
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 启用图片和字体优化
  images: {
    remotePatterns: getRemotePatterns(),
    // 启用现代图片格式 - Next.js 15自动处理
    formats: ['image/avif', 'image/webp'],
    // 优化图片尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // 缓存优化
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天
    // 启用危险允许SVG（如果需要）
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // 启用Gzip/Brotli压缩
  compress: true,

  // ✅ 简化的webpack配置 - 遵循KISS原则
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // ✅ 关闭大小警告，避免过度优化
      config.performance = {
        hints: false, // 关闭警告，专注于功能实现
      };

      // ✅ 简化的bundle分割
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // 基础分离
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'async',
              priority: 100,
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'async',
              priority: 10,
            },
          },
        },
      };
    }

    return config;
  },

  // 生产和开发环境差异化配置
  ...(IS_PRODUCTION && {
    // 生产环境专用优化
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },
  }),

  // 构建输出优化
  output: IS_PRODUCTION ? 'standalone' : undefined,
};

// 使用分析器时启用 bundle 分析
module.exports = withAnalyzer({
  enabled: IS_PRODUCTION && process.env.ANALYZE === 'true',
  openAnalyzer: process.env.ANALYZE === 'true',
})(nextConfig);