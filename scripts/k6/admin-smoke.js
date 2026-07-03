import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'], // <5% errors
    http_req_duration: ['p(95)<800'], // 95% under 800ms
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.ADMIN_BEARER || '';
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export default function () {
  const paths = [
    '/api/health',
    '/ops/api/v1/console/system/config',
    '/ops/api/v1/console/users?page=1&pageSize=5',
    '/ops/api/v1/console/plans',
    '/ops/api/v1/console/tokens/transactions?page=1&pageSize=5',
    '/ops/api/v1/console/api-management/endpoints',
    '/ops/api/v1/console/invitations/stats',
    '/ops/api/v1/console/checkins/stats',
  ];

  for (const p of paths) {
    const res = http.get(`${BASE}${p}`, { headers });
    check(res, {
      [`${p} status 200`]: (r) => r.status === 200,
      [`${p} not empty`]: (r) => (r.body || '').length > 0,
    });
    sleep(0.2);
  }
}

