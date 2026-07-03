import type { Provider } from '@supabase/supabase-js';
import { StripeCheckoutDisplayMode } from '~/lib/stripe/types';

const production = process.env.NODE_ENV === 'production';

enum Themes {
  Light = 'light',
  Dark = 'dark',
}

const configuration = {
  site: {
    name: 'Google-Monetize - AI 多渠道广告平台',
    description:
      'Google-Monetize 提供面向成长型团队的跨渠道广告自动化、风控与投放协作能力。',
    themeColor: '#0a0a0a',
    themeColorDark: '#0a0a0a',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.autoads.dev',
    siteName: 'Google-Monetize',
    twitterHandle: '@Google-Monetize',
    githubHandle: 'gm-dev',
    convertKitFormId: '',
    locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'zh-CN',
  },
  auth: {
    // ensure this is the same as your Supabase project. By default - it's true
    requireEmailConfirmation:
      process.env.NEXT_PUBLIC_REQUIRE_EMAIL_CONFIRMATION === 'true',
    // NB: Enable the providers below in the Supabase Console
    // in your production project
    providers: {
      emailPassword: false,
      phoneNumber: false,
      emailLink: false,
      emailOtp: false,
      oAuth: ['google'] as Provider[],
    },
  },
  production,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  theme: Themes.Dark,
  features: {
    enableThemeSwitcher: true,
    enableAccountDeletion: getBoolean(
      process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_DELETION,
      false,
    ),
  },
  paths: {
    signIn: '/auth',
    signUp: '/auth',
    signInMfa: '/auth/verify',
    appPrefix: '/dashboard',
    appHome: '/dashboard',
    authCallback: '/auth/callback',
    settings: {
      profile: '/settings/profile',
      subscription: '/settings/subscription',
      tokens: '/settings/tokens',
      authentication: '/settings/profile/authentication',
      email: '/settings/profile/email',
      password: '/settings/profile/password',
    },
  },
  sentry: {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  stripe: {
    embedded: true,
    displayMode: StripeCheckoutDisplayMode.Popup,
    products: [
      {
        name: 'Starter',
        description: '适合个人联盟营销人员，小规模测试阶段',
        badge: '',
        features: [
          '100 tokens/月',
          '基础评估（1 token/次）',
          '真实补点击',
          '1个并发评估',
          '最多3个广告账号',
          '仅美国(US)代理IP',
          '邮件支持',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '¥298',
            stripePriceId: 'starter-plan-mth',
          },
          {
            name: 'Yearly',
            price: '¥1788',
            stripePriceId: 'starter-plan-yr',
            label: 'common:plans.annualDiscount',
          },
        ],
      },
      {
        name: 'Professional',
        badge: '推荐',
        recommended: true,
        description: '适合专业营销人员和小型工作室',
        features: [
          '1000 tokens/月',
          'AI智能评估（12维度）',
          '真实补点击',
          '5个并发评估',
          '最多10个广告账号',
          '全球10+地区代理IP',
          '优先邮件支持',
          '高级报表与数据导出',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '¥998',
            stripePriceId: 'pro-plan-mth',
          },
          {
            name: 'Yearly',
            price: '¥5988',
            stripePriceId: 'pro-plan-yr',
            label: 'common:plans.annualDiscount',
          },
        ],
      },
      {
        name: 'Elite',
        description: '适合独立站主和代理商',
        badge: '',
        features: [
          '10000 tokens/月',
          '无限AI评估',
          '真实补点击',
          '无限并发评估',
          '无限广告账号',
          '全球50+地区代理IP',
          '专属客户成功经理',
          '自定义集成支持',
        ],
        plans: [
          {
            name: 'Monthly',
            price: '¥2998',
            stripePriceId: 'elite-plan-mth',
          },
          {
            name: 'Yearly',
            price: '¥17988',
            stripePriceId: 'elite-plan-yr',
            label: 'common:plans.annualDiscount',
          },
        ],
      },
    ],
  },
};

export default configuration;

// Validate Stripe configuration
// as this is a new requirement, we throw an error if the key is not defined
// in the environment
if (
  configuration.stripe.embedded &&
  production &&
  !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
) {
  throw new Error(
    'The key NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined. Please add it to your environment variables.',
  );
}

function getBoolean(value: unknown, defaultValue: boolean) {
  if (typeof value === 'string') {
    return value === 'true';
  }

  return defaultValue;
}
