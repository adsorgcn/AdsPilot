import { useCallback } from 'react';

import { apiDelete, apiPatch, apiPost, apiPut } from '~/lib/api';
import { API_ENDPOINTS } from '~/lib/api/endpoints';

import type {
  CreateOfferPayload,
  OfferStatus,
} from '../types';

/**
 * 创建Offer
 */
export function useCreateOffer() {
  return useCallback(async (payload: CreateOfferPayload) => {
    const { url, country } = payload;

    const body = {
      name: deriveOfferName(url, country),
      originalUrl: url,
      country,
    };

    await apiPost(API_ENDPOINTS.OFFERS.LIST, body);
  }, []);
}

/**
 * 删除Offer
 */
export function useDeleteOffer() {
  return useCallback(async (id: string) => {
    await apiDelete(API_ENDPOINTS.OFFERS._BY_ID(id));
  }, []);
}

/**
 * 切换Offer收藏状态
 */
export function useToggleOfferFavorite() {
  return useCallback(async (id: string, favorite: boolean) => {
    await apiPut(`/api/v1/offers/${id}/preferences`, {
      favorite,
    });
  }, []);
}

/**
 * 更新Offer状态
 */
export function useUpdateOfferStatus() {
  return useCallback(async (id: string, status: OfferStatus) => {
    await apiPatch(`/api/v1/offers/${id}/status`, { status });
  }, []);
}

function deriveOfferName(url: string, country?: string): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    return country ? `${domain} (${country})` : domain;
  } catch {
    return url;
  }
}
