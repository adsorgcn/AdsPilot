import { useEffect, useState, useCallback } from 'react';
import useSupabase from '~/core/hooks/use-supabase';

interface EvaluationStatus {
  id: string;
  offerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  evaluationType: 'basic' | 'ai';
  tokensConsumed?: number;
  similarWebScore?: number;
  aiRecommendationScore?: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface UseEvaluationProgressOptions {
  evaluationId: string | null;
  enabled?: boolean;
  pollingInterval?: number; // milliseconds
  onCompleted?: (evaluation: EvaluationStatus) => void;
  onFailed?: (evaluation: EvaluationStatus) => void;
}

/**
 * FE-028: useEvaluationProgress hook - Polls evaluation status
 *
 * Implements polling-based progress monitoring as a fallback for SSE.
 * Polls every 3 seconds while evaluation is in progress.
 *
 * @param options - Configuration options
 * @returns Evaluation status and control functions
 */
export function useEvaluationProgress({
  evaluationId,
  enabled = true,
  pollingInterval = 3000,
  onCompleted,
  onFailed,
}: UseEvaluationProgressOptions) {
  const client = useSupabase();
  const [evaluation, setEvaluation] = useState<EvaluationStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!evaluationId || !enabled) return;

    try {
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiBaseURL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseURL) {
        throw new Error('API Gateway URL not configured');
      }

      const response = await fetch(`${apiBaseURL}/api/v1/siterank/evaluations/${evaluationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch evaluation status: ${response.statusText}`);
      }

      const status: EvaluationStatus = await response.json();
      setEvaluation(status);
      setError(null);

      // Check if evaluation is complete
      if (status.status === 'completed') {
        setIsPolling(false);
        onCompleted?.(status);
      } else if (status.status === 'failed') {
        setIsPolling(false);
        onFailed?.(status);
      }

      return status;
    } catch (err) {
      console.error('Failed to fetch evaluation status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
      return null;
    }
  }, [evaluationId, enabled, client, onCompleted, onFailed]);

  // Start polling when evaluation ID is provided
  useEffect(() => {
    if (!evaluationId || !enabled) {
      setIsPolling(false);
      return;
    }

    // Fetch immediately
    fetchStatus();
    setIsPolling(true);

    // Set up polling interval
    const intervalId = setInterval(() => {
      fetchStatus();
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
      setIsPolling(false);
    };
  }, [evaluationId, enabled, pollingInterval, fetchStatus]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (evaluationId) {
      setIsPolling(true);
      fetchStatus();
    }
  }, [evaluationId, fetchStatus]);

  return {
    evaluation,
    isPolling,
    error,
    stopPolling,
    startPolling,
    refresh: fetchStatus,
  };
}
