'use client';

export type LiveAnnounceDetail = {
  message: string;
  politeness?: 'polite' | 'assertive';
};

export const ANNOUNCE_EVENT = 'gm:announce';

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LiveAnnounceDetail>(ANNOUNCE_EVENT, {
      detail: {
        message,
        politeness,
      },
    }),
  );
}
