'use client';

import { useMemo } from 'react';

export default function useSaveShortcutHint() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return 'Ctrl + S';
    }

    const platform = window.navigator.platform?.toLowerCase() ?? '';
    const isMac = platform.includes('mac') || platform.includes('iphone') || platform.includes('ipad');

    return isMac ? '⌘ + S' : 'Ctrl + S';
  }, []);
}
