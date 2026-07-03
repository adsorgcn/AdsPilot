'use client';

import { useEffect, useState } from 'react';
import useUser from './use-user';
import useApi from './use-api';

interface DemoStatus {
  modules: {
    [key: string]: {
      has_real_data: boolean;
      demo_count: number;
      real_count: number;
    };
  };
}

interface DemoInitializeResponse {
  success: boolean;
  initialized_modules: string[];
  skipped_modules: string[];
  demo_counts: { [key: string]: number };
}

/**
 * Hook to automatically initialize demo data for new users
 * Checks if user has real data, and if not, initializes demo data
 */
export function useDemoDataInitialization() {
  const { data: user } = useUser();
  const api = useApi();
  const [isInitializing, setIsInitializing] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!user || hasChecked || isInitializing) return;

    const checkAndInitialize = async () => {
      try {
        setIsInitializing(true);

        // Check demo data status
        const statusResponse = await api({
          path: '/api/v1/demo/status',
          method: 'GET',
        }) as DemoStatus;

        const offersStatus = statusResponse?.modules?.offers;

        // If user has no real data and no demo data, initialize
        if (offersStatus && !offersStatus.has_real_data && offersStatus.demo_count === 0) {
          console.log('[DemoData] Initializing demo data for new user');

          await api({
            path: '/api/v1/demo/initialize',
            method: 'POST',
            body: {
              modules: ['offers'],
            } as any,
          }) as Promise<DemoInitializeResponse>;

          console.log('[DemoData] Demo data initialization complete');
        }
      } catch (error) {
        console.error('[DemoData] Error initializing demo data:', error);
      } finally {
        setIsInitializing(false);
        setHasChecked(true);
      }
    };

    checkAndInitialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, hasChecked, isInitializing]);

  return { isInitializing, hasChecked };
}

/**
 * Hook to get demo data status
 */
export function useDemoStatus() {
  const api = useApi();
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await api({
        path: '/api/v1/demo/status',
        method: 'GET',
      }) as DemoStatus;
      setStatus(response);
    } catch (error) {
      console.error('[DemoData] Error fetching status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, isLoading, refetch: fetchStatus };
}
