export type OfferStatus =
  | 'pending_evaluation'
  | 'evaluating'
  | 'evaluation_failed'
  | 'evaluated'
  | 'click_task_running'
  | 'ready_to_deploy'
  | 'deploying'
  | 'deployed'
  | 'archived';

export interface Offer {
  id: string;
  url: string;
  brandName: string;
  country: string;
  status: OfferStatus;
  healthScore?: number;
  roas?: number;
  revenue?: number;
  cost?: number;
  conversions?: number;
  statusReason?: string;
  name?: string;
  offerName?: string;
  accountId?: string;
  adsAccountId?: string;
  createdAt: string;
  updatedAt: string;
  latestEvaluation?: OfferEvaluation;
  isFavorite: boolean;
  lastEvaluatedAt?: string;
  lastEvaluationType?: string;
  lastEvaluationStatus?: string;
  lastEvaluationScore?: number;
  lastEvaluationTokens?: number;
}

/**
 * Offer Evaluation Result
 * Ref: frontend-package-offer-evaluation.md - Task A2-3
 */
export interface OfferEvaluation {
  id: string;
  offerId: string;
  evaluatedAt: string;
  tokenCost: number;
  usedAI: boolean;
  status?: string;
  evaluationType?: 'basic' | 'ai';
  tokensConsumed?: number;
  urlHash?: string;
  durationMs?: number;
  errorMessage?: string;

  // SimilarWeb Data
  similarWebData?: {
    globalRank?: number;
    countryRank?: number;
    categoryRank?: number;
    monthlyVisits?: number;
    bounceRate?: number;
    pagesPerVisit?: number;
    avgVisitDuration?: number;
    trafficSources?: {
      direct?: number;
      search?: number;
      social?: number;
      mail?: number;
      referrals?: number;
      paid?: number;
    };
  };

  // AI Analysis (Elite only)
  aiAnalysis?: {
    recommendationScore: number; // 0-100
    category?: string;
    strengths?: string[];
    weaknesses?: string[];
    suggestion?: string;
  };

  // Final Score
  finalScore?: number;
  aiRecommendationScore?: number;
  aiReasons?: string[];
}

export interface OfferEvaluationHistoryItem extends OfferEvaluation {
  statusLabel?: string;
}

export interface OfferEvaluationHistoryResponse {
  items: OfferEvaluationApiRecord[];
  evaluations?: OfferEvaluationApiRecord[]; // Deprecated, use items
  total: number;
}

export interface OfferEvaluationApiRecord {
  ID: string;
  OfferID: string;
  UserID: string;
  EvaluationType: 'basic' | 'ai' | string;
  Status: string;
  TokensConsumed: number;
  LandingPageURL?: string;
  Domain?: string;
  BrandName?: string;
  SimilarWebData?: unknown;
  AIRecommendationScore?: number;
  AIReasons?: string[];
  AIIndustry?: string;
  ErrorMessage?: string;
  StartedAt: string;
  CompletedAt?: string;
}

export interface OfferListParams {
  page?: number;
  limit?: number;
  status?: OfferStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'healthScore';
  sortOrder?: 'asc' | 'desc';
}

export interface OfferListResult {
  items: Offer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOfferPayload {
  url: string;
  country?: string;
}

/**
 * Evaluate Offer Request Payload
 * Ref: frontend-package-offer-evaluation.md - Task A3-1
 */
export interface EvaluateOfferRequest {
  /** Enable AI evaluation (Elite tier only) */
  enableAI?: boolean;
  /** Force refresh cached data */
  forceRefresh?: boolean;
}

/**
 * Evaluate Offer Response
 * Ref: frontend-package-offer-evaluation.md - Task A3-1
 */
export interface EvaluateOfferResponse {
  /** Evaluation task status */
  status: 'evaluating' | 'queued';
  /** Evaluation ID for tracking */
  evaluationId: string;
  /** Offer ID being evaluated */
  offerId: string;
  /** Token cost for this evaluation */
  tokenCost: number;
  /** Estimated completion time in seconds */
  estimatedDuration?: number;
  /** Message for user */
  message?: string;
}

export interface OfferApiRecord {
  id: string;
  userId: string;
  name: string;
  brandName?: string;
  originalUrl: string;
  status: string;
  siterankScore?: number | null;
  createdAt: string;
  updatedAt?: string;
  country?: string;
  derivedStatus?: string;
  statusReason?: string;
  favorite?: boolean;
  lastEvaluatedAt?: string;
  lastEvaluationType?: string;
  lastEvaluationStatus?: string;
  lastEvaluationScore?: number;
  lastEvaluationTokens?: number;
}

export interface OfferAccountsResponse {
  accounts: Array<{
    accountId: string;
    status?: string;
  }>;
  items?: Array<{
    accountId: string;
    status?: string;
  }>; // Deprecated, use accounts
}

export interface LinkedAccount {
  accountId: string;
  status?: string;
}
