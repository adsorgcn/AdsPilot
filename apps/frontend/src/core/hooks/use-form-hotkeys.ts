'use client';

import { useEffect } from 'react';

const SAVE_EVENT = 'app:save-form';

type Callback = () => void | Promise<void>;

export default function useFormHotkeys(callback: Callback) {
  useEffect(() => {
    const handler = () => {
      callback();
    };

    window.addEventListener(SAVE_EVENT, handler);

    return () => {
      window.removeEventListener(SAVE_EVENT, handler);
    };
  }, [callback]);
}
