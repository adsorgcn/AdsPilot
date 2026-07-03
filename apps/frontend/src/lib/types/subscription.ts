/**
 * Subscription Types
 *
 * Defines the subscription tier and related information for users.
 * Ref: FrontendDesignComplete_20251009.md - Section 21.2
 */

export type SubscriptionTier = 'trial' | 'pro' | 'max' | 'elite';

export interface SubscriptionInfo {
  /** Current subscription tier */
  tier: SubscriptionTier;

  /** Whether the subscription is currently active (not expired) */
  isActive: boolean;

  /** Convenience flag: tier === 'elite' */
  isElite: boolean;

  /** Whether the user can use AI evaluation features (Elite tier only) */
  canUseAI: boolean;

  /** Monthly token allocation based on tier */
  monthlyTokenAllocation: number;

  /** Current available token balance */
  currentTokenBalance: number;

  /** Subscription end date (null if on trial) */
  subscriptionEndDate: string | null;

  /** Trial end date (null if subscribed) */
  trialEndDate: string | null;

  /** Whether the user is on trial */
  isOnTrial: boolean;

  /** Days remaining (trial or subscription) */
  daysRemaining: number | null;

  /** Subscription ID (if active) */
  subscriptionId?: string;

  /** Whether user can upgrade subscription */
  canUpgrade?: boolean;

  /** Available upgrade options */
  availableUpgrades?: SubscriptionTier[];
}

/**
 * Subscription configuration from billing service
 */
export interface SubscriptionConfig {
  id: string;
  name: string;
  description: string;
  monthlyTokens: number;
  features: string[];
  sortOrder: number;
  isActive: boolean;
  trialDays?: number;
  maxOffers?: number;
  maxAdAccounts?: number;
}

/**
 * Token cost configuration from billing service
 */
export interface TokenCostConfig {
  [action: string]: number | undefined;
  basicEvaluation?: number;
  aiEvaluation?: number;
  offerCreation?: number;
  advancedAnalysis?: number;
}

/**
 * Pricing configuration
 */
export interface PricingConfig {
  planId: string;
  amount: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  trialDays?: number;
}

/**
 * Legacy subscription tier configuration (kept for backward compatibility)
 */
export const SUBSCRIPTION_TIERS = {
  trial: {
    name: 'Trial',
    monthlyTokens: 100,
    price: 0,
    features: ['Basic evaluation', 'Limited features'],
  },
  pro: {
    name: 'Pro',
    monthlyTokens: 500,
    price: 49,
    features: ['Basic evaluation', '3 ad accounts', 'Email support'],
  },
  max: {
    name: 'Max',
    monthlyTokens: 2000,
    price: 79,
    features: ['Basic evaluation', '10 ad accounts', 'Priority support'],
  },
  elite: {
    name: 'Elite',
    monthlyTokens: 10000,
    price: 99,
    features: ['AI evaluation', 'Unlimited ad accounts', 'Dedicated support'],
  },
} as const;

/**
 * Default token costs (fallback if API unavailable)
 */
export const DEFAULT_TOKEN_COSTS = {
  basicEvaluation: 1,
  aiEvaluation: 3, // 1 basic + 2 AI
  offerCreation: 2,
  advancedAnalysis: 5,
} as const;
