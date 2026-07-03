import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '1m',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

const GATEWAY = __ENV.GATEWAY || 'https://www.urlchecker.dev';
const AUTH = __ENV.AUTH || '';

export default function () {
  const headers = AUTH ? { Authorization: AUTH, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  // 1) Siterank analyze-url (best-effort)
  http.post(`${GATEWAY}/api/v1/siterank/analyze-url`, JSON.stringify({ url: 'https://example.com', offerId: 'k6', country: 'US' }), { headers });
  // 2) Adscenter diagnose chain
  const m = http.get(`${GATEWAY}/api/v1/adscenter/diagnose/metrics?accountId=stub`, { headers });
  if (m.status === 200) {
    const plan = http.post(`${GATEWAY}/api/v1/adscenter/diagnose/plan`, JSON.stringify({ metrics: m.json() }), { headers });
    if (plan.status === 200) {
      const p = plan.json() || {}; const body = p.plan ? JSON.stringify(p.plan) : JSON.stringify({ actions: [] });
      http.post(`${GATEWAY}/api/v1/adscenter/bulk-actions/validate`, body, { headers });
    }
  }
  sleep(1);
}

