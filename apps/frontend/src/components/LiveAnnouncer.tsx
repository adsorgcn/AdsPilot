'use client';

import { useEffect, useState } from 'react';
import { ANNOUNCE_EVENT, type LiveAnnounceDetail } from '~/core/utils/announce';

export default function LiveAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<LiveAnnounceDetail>;
      const detail = custom.detail;

      if (!detail?.message) {
        return;
      }

      if (detail.politeness === 'assertive') {
        setAssertiveMessage(detail.message);
        return;
      }

      setPoliteMessage(detail.message);
    };

    window.addEventListener(ANNOUNCE_EVENT, handler);

    return () => {
      window.removeEventListener(ANNOUNCE_EVENT, handler);
    };
  }, []);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </>
  );
}
