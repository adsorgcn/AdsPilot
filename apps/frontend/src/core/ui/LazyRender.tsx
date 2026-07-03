'use client';

import { createRef, useLayoutEffect, useMemo, useState } from 'react';

/**
 * @description Render a component lazily based on the IntersectionObserver
 * configuration provided.
 * Full documentation at: https://makerkit.dev/docs/components-utilities#lazyrender
 * @param children
 * @param threshold
 * @param rootMargin
 * @param onVisible
 * @constructor
 */
const LazyRender: React.FCC<{
  threshold?: number;
  rootMargin?: string;
  onVisible?: () => void;
}> = ({ children, threshold, rootMargin, onVisible }) => {
  const ref = useMemo(() => createRef<HTMLDivElement>(), []);
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    const options = {
      rootMargin: rootMargin ?? '0px',
      threshold: threshold ?? 1,
    };

    const isIntersecting = (entry: IntersectionObserverEntry) =>
      entry.isIntersecting || entry.intersectionRatio > 0;

    const observer = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (isIntersecting(entry)) {
          setIsVisible(true);
          observer.disconnect();

          if (onVisible) {
            onVisible();
          }
        }
      });
    }, options);

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, ref, onVisible]);

  return <div ref={ref}>{isVisible ? children : null}</div>;
};

export default LazyRender;
