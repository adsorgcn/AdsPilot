// Billing service types
// These types are defined locally because they're not part of the OpenAPI spec yet

export interface PlanConfig {
  id: string;
  tier: string;
  display_name_en: string;
  display_name_zh: string;
  permissions: Record<string, any>;
  token_costs: Record<string, any>;
  monthly_tokens: number;
  pricing: Record<string, any>;
  marketing_features: any;
  display_order: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface UpdatePlanRequest {
  display_name_en?: string;
  display_name_zh?: string;
  permissions?: Record<string, any>;
  token_costs?: Record<string, any>;
  monthly_tokens?: number;
  pricing?: Record<string, any>;
  marketing_features?: any;
  display_order?: number;
  is_active?: boolean;
  change_summary: string;
}
