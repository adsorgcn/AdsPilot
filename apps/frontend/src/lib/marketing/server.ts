import type { MarketingSummary } from './types';

const MARKETING_SUMMARY_ENDPOINT = '/public/marketing/summary';

export async function getMarketingSummary() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? '';
  const url = `${base}${MARKETING_SUMMARY_ENDPOINT}`;

  const response = await fetch(url, {
    next: {
      revalidate: 300,
      tags: ['marketing-summary'],
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load marketing summary: ${response.status}`);
  }

  return (await response.json()) as MarketingSummary;
}
