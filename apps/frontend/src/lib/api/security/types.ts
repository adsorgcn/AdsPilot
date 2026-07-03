export type SecurityStatus = 'success' | 'failure' | 'info';

export interface LoginHistoryEntry {
  id: string;
  occurredAt: string;
  event: string;
  status: SecurityStatus;
  ip?: string | null;
  userAgent?: string | null;
  location?: {
    city?: string | null;
    country?: string | null;
    region?: string | null;
  } | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface LoginHistoryResponse {
  items: LoginHistoryEntry[];
}

export interface ActiveSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  ip?: string | null;
  userAgent?: string | null;
  factorId?: string | null;
  expiresAt?: string | null;
}

export interface ActiveSessionsResponse {
  items: ActiveSession[];
}
