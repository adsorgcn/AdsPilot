import type { NextWebVitalsMetric } from 'next/app';

export function reportWebVitals(metric: NextWebVitalsMetric) {
  if (typeof window === 'undefined') {
    return;
  }

  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    label: metric.label,
    page: window.location.pathname,
    timestamp: Date.now(),
  });

  if ('sendBeacon' in navigator) {
    navigator.sendBeacon('/api/monitoring/web-vitals', body);
  } else {
    fetch('/api/monitoring/web-vitals', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).catch(() => undefined);
  }
}
