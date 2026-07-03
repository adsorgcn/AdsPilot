/**
 * 订阅套餐配置类型定义
 */

export interface SubscriptionPlanUpdate {
  tier: string;
  name: string;
  price: number;
  features: string[];
  limits: {
    offers?: number;
    tasks?: number;
    tokens?: number;
    [key: string]: number | undefined;
  };
  metadata?: Record<string, unknown>;
}

export interface SubscriptionPlanResponse {
  success: boolean;
  data: {
    id: string;
    tier: string;
    name: string;
    price: number;
    features: string[];
    limits: Record<string, number>;
    createdAt: string;
    updatedAt: string;
  };
}