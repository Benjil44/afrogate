// AfroGate load-test smoke (k6). Starter for the Phase 6 load/scale drill.
//   BASE_URL=https://host SESSION_TOKEN=<admin bearer> k6 run scripts/loadtest/afrogate-smoke.js
//
// Ramps virtual users and exercises read-mostly guarded endpoints. Tune stages
// and thresholds toward the 10,000-user target before a paid rollout. This file
// is config/documentation; running it requires a deployed host and the k6 CLI.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:7000';
const SESSION_TOKEN = __ENV.SESSION_TOKEN || '';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.005'], // < 0.5% errors
    http_req_duration: ['p(95)<500'], // p95 under 500ms
  },
};

const authHeaders = SESSION_TOKEN ? { Authorization: `Bearer ${SESSION_TOKEN}` } : {};

export default function () {
  const health = http.get(`${BASE_URL}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  if (SESSION_TOKEN) {
    const reads = http.batch([
      ['GET', `${BASE_URL}/api/admin/servers`, null, { headers: authHeaders }],
      ['GET', `${BASE_URL}/api/admin/outbounds`, null, { headers: authHeaders }],
      ['GET', `${BASE_URL}/api/admin/alerts?status=open&limit=50`, null, { headers: authHeaders }],
    ]);
    reads.forEach((r) => check(r, { 'guarded read ok': (res) => res.status === 200 }));
  }

  sleep(1);
}
