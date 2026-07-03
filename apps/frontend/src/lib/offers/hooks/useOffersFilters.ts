import { useMemo, useState } from 'react';
import { useDebounce } from '~/hooks/useDebounce';
import type { Offer, OfferStatus } from '../types';

export type StatusFilter = OfferStatus | 'all';
export type EvaluationFilter = 'all' | 'ai' | 'basic';
export type TimeRangeFilter = 'all' | '7d' | '30d';
export type SortField = 'updatedAt' | 'healthScore';
export type SortOrder = 'asc' | 'desc';

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

/**
 * Offers页面过滤逻辑Hook
 * 集中管理所有过滤状态和逻辑
 */
export function useOffersFilters() {
  // 过滤状态
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [evaluationFilter, setEvaluationFilter] = useState<EvaluationFilter>('all');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // 防抖搜索
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // 客户端过滤函数（后端不支持的过滤器）
  const applyFilters = useMemo(() => {
    return (offers: Offer[]) => {
      const rangeDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : null;
      const now = Date.now();

      return offers.filter((offer) => {
        // 收藏过滤
        if (showFavoritesOnly && !offer.isFavorite) return false;

        // 评估类型过滤
        if (evaluationFilter === 'ai' && typeof offer.healthScore !== 'number') {
          return false;
        }
        if (evaluationFilter === 'basic' && typeof offer.healthScore === 'number') {
          return false;
        }

        // 时间范围过滤
        if (rangeDays !== null) {
          const latest = toTimestamp(offer.updatedAt ?? offer.createdAt);
          if (latest === 0 || now - latest > rangeDays * ONE_DAY_IN_MS) {
            return false;
          }
        }

        return true;
      });
    };
  }, [showFavoritesOnly, evaluationFilter, timeRange]);

  // 重置所有过滤器
  const resetFilters = () => {
    setStatus('all');
    setSearchTerm('');
    setEvaluationFilter('all');
    setTimeRange('all');
    setSortField('updatedAt');
    setSortOrder('desc');
    setShowFavoritesOnly(false);
  };

  // 切换排序顺序
  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // 切换收藏过滤
  const toggleShowFavoritesOnly = () => {
    setShowFavoritesOnly((prev) => !prev);
  };

  return {
    // 状态
    status,
    searchTerm,
    evaluationFilter,
    timeRange,
    sortField,
    sortOrder,
    showFavoritesOnly,
    debouncedSearchTerm,

    // 过滤函数
    applyFilters,

    // 操作
    setStatus,
    setSearchTerm,
    setEvaluationFilter,
    setTimeRange,
    setSortField,
    setSortOrder,
    setShowFavoritesOnly,
    toggleShowFavoritesOnly,
    resetFilters,
    toggleSortOrder,
  };
}
