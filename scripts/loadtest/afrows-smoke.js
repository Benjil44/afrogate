// Afrows load test (k6). Phase 6 load/scale drill.
//
// Models the THREE real control-plane traffic classes (the data-plane VPN traffic
// does NOT flow through this backend, so 10k users != 10k requests here):
//   1. client      - GET /api/client/me + /api/client/subscription   (the 10k-user driver; highest weight)
//   2. agent        - POST /api/agents/heartbeat                       (one agent per managed server)
//   3. admin        - guarded /api/admin/* reads                       (a few operators)
//
// Each class is enabled only when its token is provided, so you can run a subset.
//   BASE_URL=https://host \
//   CLIENT_TOKEN=<client bearer> AGENT_TOKEN=<agent bearer> SESSION_TOKEN=<admin bearer> \
//   PEAK_CLIENTS=500 PEAK_AGENTS=50 PEAK_ADMINS=10 \
//     k6 run scripts/loadtest/afrows-smoke.js
//
// Scale PEAK_* toward the target and watch p95/error rate + the server's DB pool,
// CPU, and RAM. Requires a deployed host and the k6 CLI.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:7000';
const CLIENT_TOKEN = __ENV.CLIENT_TOKEN || '';
const AGENT_TOKEN = __ENV.AGENT_TOKEN || '';
const SESSION_TOKEN = __ENV.SESSION_TOKEN || '';

const PEAK_CLIENTS = Number(__ENV.PEAK_CLIENTS || 500);
const PEAK_AGENTS = Number(__ENV.PEAK_AGENTS || 50);
const PEAK_ADMINS = Number(__ENV.PEAK_ADMINS || 10);

// Staged ramp shared by each enabled scenario: warm up -> climb -> hold -> drain.
const ramp = (peak) => [
  { duration: '30s', target: Math.ceil(peak * 0.1) },
  { duration: '1m', target: Math.ceil(peak * 0.4) },
  { duration: '2m', target: peak },
  { duration: '1m', target: peak },
  { duration: '30s', target: 0 },
];

const scenarios = {};
if (CLIENT_TOKEN) {
  scenarios.client = { executor: 'ramping-vus', exec: 'clientFlow', stages: ramp(PEAK_CLIENTS), tags: { class: 'client' } };
}
if (AGENT_TOKEN) {
  scenarios.agent = { executor: 'ramping-vus', exec: 'agentFlow', stages: ramp(PEAK_AGENTS), tags: { class: 'agent' } };
}
if (SESSION_TOKEN) {
  scenarios.admin = { executor: 'ramping-vus', exec: 'adminFlow', stages: ramp(PEAK_ADMINS), tags: { class: 'admin' } };
}
// Always at least exercise the unauthenticated health endpoint.
scenarios.health = { executor: 'constant-vus', exec: 'healthFlow', vus: 5, duration: '5m', tags: { class: 'health' } };

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.005'], // < 0.5% errors overall
    http_req_duration: ['p(95)<500'], // p95 < 500ms overall
    'http_req_duration{class:client}': ['p(95)<400'], // client reads should be snappy
    'http_req_duration{class:agent}': ['p(95)<600'],
  },
};

const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export function clientFlow() {
  const reads = http.batch([
    ['GET', `${BASE_URL}/api/client/me`, null, bearer(CLIENT_TOKEN)],
    ['GET', `${BASE_URL}/api/client/subscription`, null, bearer(CLIENT_TOKEN)],
  ]);
  reads.forEach((r) => check(r, { 'client read ok': (res) => res.status === 200 }));
  sleep(Math.random() * 4 + 1); // clients poll, they don't hammer
}

export function agentFlow() {
  const res = http.post(`${BASE_URL}/api/agents/heartbeat`, '{}', {
    headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'Content-Type': 'application/json' },
  });
  check(res, { 'agent heartbeat accepted': (r) => r.status < 400 });
  sleep(Math.random() * 10 + 5); // heartbeats are periodic
}

export function adminFlow() {
  const reads = http.batch([
    ['GET', `${BASE_URL}/api/admin/servers`, null, bearer(SESSION_TOKEN)],
    ['GET', `${BASE_URL}/api/admin/outbounds`, null, bearer(SESSION_TOKEN)],
    ['GET', `${BASE_URL}/api/admin/alerts?status=open&limit=50`, null, bearer(SESSION_TOKEN)],
  ]);
  reads.forEach((r) => check(r, { 'guarded read ok': (res) => res.status === 200 }));
  sleep(Math.random() * 3 + 2);
}

export function healthFlow() {
  check(http.get(`${BASE_URL}/api/health`), { 'health 200': (r) => r.status === 200 });
  sleep(1);
}
