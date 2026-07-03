export interface AdminUser {
  id: string;
  email?: string;
  role?: string;
  emailConfirmed?: boolean;
  lastSignInAt?: string;
  createdAt: string;
  isSuperAdmin?: boolean;
  isBanned?: boolean;
  bannedUntil?: string | null;
  appMetadata?: Record<string, unknown> | null;
  userMetadata?: Record<string, unknown> | null;
  tokenBalance?: number | null;
  planId?: string | null;
  planName?: string | null;
  subscription?: string | null;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  page: number;
  perPage: number;
  totalCount: number;
}

export interface AdminUserDetailResponse {
  user: AdminUser;
  activity?: Array<Record<string, unknown>>;
}

export interface AdminStatsResponse {
  counters: Record<string, number>;
  updatedAt: string;
}

export interface AdminAuditLogEntry {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method: string;
  path: string;
  statusCode: number;
  requestBody?: Record<string, unknown> | null;
  responseBody?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditLogListResponse {
  items: AdminAuditLogEntry[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AdminImpersonationEvent {
  id: string;
  adminId: string;
  adminEmail?: string;
  targetUserId: string;
  targetEmail?: string;
  redirectTo?: string;
  issuedAt: string;
  source?: string;
  metadata?: Record<string, unknown> | null;
}

export interface AdminImpersonationEventListResponse {
  items: AdminImpersonationEvent[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface AdminUserTokensResponse {
  balance: number;
  items: Array<{
    id: string;
    type: string;
    amount: number;
    balanceBefore?: number;
    balanceAfter?: number;
    source?: string;
    description?: string;
    createdAt: string;
  }>;
}
