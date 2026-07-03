import { useCallback, useEffect, useRef, useState } from 'react';

import { API_ENDPOINTS } from '~/lib/api/endpoints';
import mainApi from '~/lib/api/clients/MainApiClient';

import type { AdsAccount, AdsAccountsListParams } from '../types';
import { buildAccountsEndpoint, fetchAccountsSnapshot, mapAccountsResponse, readAccountsStream } from '../utils/accounts-helpers';

/**
 * 获取广告账号列表（支持实时流 + 快照回退）
 * 自动重连机制，断线后15秒重连
 */
export function useAdsAccounts(params: AdsAccountsListParams = {}) {
  const streamEndpoint = buildAccountsEndpoint(
    params,
    API_ENDPOINTS.ADSCENTER.ACCOUNTS_STREAM,
  );
  const snapshotEndpoint = buildAccountsEndpoint(params);

  const [accounts, setAccounts] = useState<AdsAccount[]>([]);
  const accountsRef = useRef<AdsAccount[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionId, setConnectionId] = useState<number>(0);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const snapshot = await fetchAccountsSnapshot(snapshotEndpoint);
      accountsRef.current = snapshot;
      setAccounts(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('刷新广告账号数据失败'));
    } finally {
      setIsLoading(false);
    }
  }, [snapshotEndpoint]);

  useEffect(() => {
    let cancelled = false;
    const abortController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      setIsLoading(accountsRef.current.length === 0);
      setError(null);

      try {
        const response = await mainApi.requestRaw(streamEndpoint, {
          signal: abortController.signal,
          headers: {
            Accept: 'text/event-stream',
          },
        });

        if (!response.body) {
          throw new Error('广告账号实时流不可用');
        }

        setIsConnected(true);
        setIsLoading(false);

        await readAccountsStream(response, (payload) => {
          if (cancelled) {
            return;
          }

          const mapped = mapAccountsResponse(payload);
          accountsRef.current = mapped;
          setAccounts(mapped);
          setIsLoading(false);
        });

        if (!cancelled) {
          setIsConnected(false);
          reconnectTimer = setTimeout(() => {
            setConnectionId((prev) => prev + 1);
          }, 15000);
        }
      } catch (err) {
        if (abortController.signal.aborted || cancelled) {
          return;
        }

        const parsedError = err instanceof Error ? err : new Error('广告账号实时连接失败');
        setError(parsedError);
        setIsConnected(false);
        setIsLoading(false);

        try {
          const snapshot = await fetchAccountsSnapshot(snapshotEndpoint);
          if (!cancelled) {
            accountsRef.current = snapshot;
            setAccounts(snapshot);
          }
        } catch (snapshotError) {
          if (!cancelled && snapshotError instanceof Error) {
            setError(snapshotError);
          }
        }

        if (!cancelled) {
          reconnectTimer = setTimeout(() => {
            setConnectionId((prev) => prev + 1);
          }, 15000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      abortController.abort();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [connectionId, snapshotEndpoint, streamEndpoint]);

  const reconnect = useCallback(() => {
    setConnectionId((prev) => prev + 1);
  }, []);

  return {
    accounts,
    isLoading,
    isConnected,
    error,
    refresh,
    reconnect,
  };
}
