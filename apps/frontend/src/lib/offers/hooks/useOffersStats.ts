import { useMemo } from 'react';
import { useOffersList } from './useOffersList';
import type { OfferStatus } from '../types';

/**
 * Dashboard统计数据
 * 直接调用Offers微服务API，客户端聚合统计
 */
interface OffersStats {
  total: number;
  pending: number;
  ready: number;
  deployed: number;
}

/**
 * 获取Offers统计数据（用于Dashboard）
 *
 * 架构说明：
 * - 用户Dashboard直接调用微服务API（Offers、Billing等）
 * - Console服务仅用于后台管理系统（/manage）
 * - 避免用户Dashboard耦合到Console服务
 *
 * @returns Offers统计数据和加载状态
 */
export function useOffersStats() {
  // 获取所有offers（不分页，用于统计）
  const { items, isLoading, error, refetch } = useOffersList({
    limit: 1000, // 足够大的limit，确保获取所有offers
  });

  // 客户端聚合统计
  const stats = useMemo<OffersStats>(() => {
    const total = items.length;

    // Pending状态包含：pending_evaluation, evaluating, evaluation_failed, evaluated
    const pending = items.filter((offer) => {
      const status = offer.status as OfferStatus;
      return (
        status === 'pending_evaluation' ||
        status === 'evaluating' ||
        status === 'evaluation_failed' ||
        status === 'evaluated' ||
        status === 'click_task_running'
      );
    }).length;

    // Ready状态：ready_to_deploy
    const ready = items.filter(
      (offer) => offer.status === 'ready_to_deploy' || offer.status === 'deploying',
    ).length;

    // Deployed状态：deployed
    const deployed = items.filter((offer) => offer.status === 'deployed').length;

    return {
      total,
      pending,
      ready,
      deployed,
    };
  }, [items]);

  return {
    stats,
    isLoading,
    error,
    refetch,
  };
}
