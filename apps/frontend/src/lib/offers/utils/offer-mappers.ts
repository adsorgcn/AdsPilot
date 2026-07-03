import type { OfferListParams, OfferEvaluationApiRecord } from '../types';

/**
 * Offer 记录类型
 */
export interface OfferRecord {
  id: string;
  name: string;
  status: string;
  url?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * 评估记录类型
 */
export interface EvaluationRecord {
  id: string;
  offerId: string;
  status: string;
  score?: number;
  createdAt: string;
  completedAt?: string;
  evaluatedAt: string;
  tokenCost: number;
  usedAI: boolean;
  [key: string]: unknown;
}

/**
 * 构建Offer列表查询URL
 */
export function buildListEndpoint(params: OfferListParams): string {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set('status', params.status);
  }

  if (params.search) {
    searchParams.set('search', params.search);
  }

  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }

  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }

  if (typeof params.page === 'number') {
    searchParams.set('page', String(params.page));
  }

  if (typeof params.limit === 'number') {
    searchParams.set('limit', String(params.limit));
  }

  const queryString = searchParams.toString();

  return `/api/v1/offers${queryString ? `?${queryString}` : ''}`;
}

/**
 * 映射API返回的Offer记录
 * 标准化字段名称和数据格式
 */
export function mapOfferRecord(record: Record<string, unknown>): OfferRecord {
  return {
    id: String(record.id || ''),
    name: String(record.name || ''),
    status: String(record.status || 'unknown'),
    url: record.url ? String(record.url) : undefined,
    description: record.description ? String(record.description) : undefined,
    createdAt: String(record.createdAt || record.created_at || new Date().toISOString()),
    updatedAt: String(record.updatedAt || record.updated_at || new Date().toISOString()),
    ...record,
  };
}

/**
 * 映射API返回的Offer记录到完整的Offer接口
 * 包含所有必需的字段映射
 */
export function mapOfferToFullType(record: Record<string, unknown>): Offer {
  return {
    id: String(record.id || ''),
    url: String(record.url || ''),
    brandName: String(record.brandName || record.brand_name || record.name || ''),
    country: String(record.country || 'US'),
    status: String(record.status || 'pending_evaluation'),
    healthScore: typeof record.healthScore === 'number' ? record.healthScore : undefined,
    roas: typeof record.roas === 'number' ? record.roas : undefined,
    revenue: typeof record.revenue === 'number' ? record.revenue : undefined,
    cost: typeof record.cost === 'number' ? record.cost : undefined,
    conversions: typeof record.conversions === 'number' ? record.conversions : undefined,
    statusReason: record.statusReason ? String(record.statusReason) : undefined,
    name: record.name ? String(record.name) : undefined,
    offerName: record.offerName ? String(record.offerName) : undefined,
    accountId: record.accountId ? String(record.accountId) : undefined,
    adsAccountId: record.adsAccountId ? String(record.adsAccountId) : undefined,
    createdAt: String(record.createdAt || record.created_at || new Date().toISOString()),
    updatedAt: String(record.updatedAt || record.updated_at || new Date().toISOString()),
    isFavorite: Boolean(record.isFavorite || record.is_favorite || false),
    lastEvaluatedAt: record.lastEvaluatedAt ? String(record.lastEvaluatedAt) : undefined,
    lastEvaluationType: record.lastEvaluationType ? String(record.lastEvaluationType) : undefined,
    lastEvaluationStatus: record.lastEvaluationStatus ? String(record.lastEvaluationStatus) : undefined,
    lastEvaluationScore: typeof record.lastEvaluationScore === 'number' ? record.lastEvaluationScore : undefined,
    lastEvaluationTokens: typeof record.lastEvaluationTokens === 'number' ? record.lastEvaluationTokens : undefined,
  };
}

/**
 * 映射评估记录
 * 标准化字段名称和数据格式
 */
export function mapEvaluationRecord(record: OfferEvaluationApiRecord): EvaluationRecord {
  return {
    id: String(record.ID || ''),
    offerId: String(record.OfferID || ''),
    status: String(record.Status || 'unknown'),
    score: typeof record.AIRecommendationScore === 'number' ? record.AIRecommendationScore : undefined,
    createdAt: String(record.StartedAt || new Date().toISOString()),
    completedAt: record.CompletedAt
      ? String(record.CompletedAt)
      : undefined,
    evaluatedAt: String(record.StartedAt || new Date().toISOString()),
    tokenCost: typeof record.TokensConsumed === 'number' ? record.TokensConsumed : 0,
    usedAI: String(record.EvaluationType || 'basic').toLowerCase() === 'ai',
    ...record,
  };
}
