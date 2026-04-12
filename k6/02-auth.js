/**
 * Load test: POST /auth/register  +  POST /auth/login
 *
 * NOTE: Register is throttled to 5 req/min per IP by the server.
 * This test intentionally stays below that ceiling per VU.
 * The login sub-test uses a pre-seeded admin account to exercise
 * the login path without triggering the register throttle.
 *
 * Stages:
 *   0→30s : ramp to 5 VUs   (register — low because of per-IP throttle)
 *   30s→2m: hold 5 VUs
 *   2m→3m : ramp down
 *
 * Login is run in a separate scenario with higher VU count.
 *
 * Set env vars:
 *   ADMIN_EMAIL    (default: admin@gmail.com)
 *   ADMIN_PASSWORD (default: Admin123!)
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from './lib/helpers.js';

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin123!';

export const options = {
  scenarios: {
    register_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m30s', target: 5 },
        { duration: '30s', target: 0 },
      ],
      exec: 'registerFlow',
      gracefulRampDown: '10s',
    },
    login_flow: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 30 },
        { duration: '2m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'loginFlow',
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:register_flow}': ['p(95)<1000'],
    'http_req_duration{scenario:login_flow}': ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

// One unique user per VU — registered once, then done
const registered = {};

export function registerFlow() {
  const vuId = __VU;
  if (registered[vuId]) {
    sleep(2);
    return;
  }

  const email = `reg_vu${vuId}_${Date.now()}@loadtest.com`;
  const password = 'LoadTest123!';

  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );

  const ok = check(res, {
    'register: status 201': (r) => r.status === 201,
    'register: has token': (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  if (ok) registered[vuId] = true;

  // also confirm 409 on duplicate attempt
  const dup = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );
  check(dup, {
    'register duplicate: status 409': (r) => r.status === 409,
  });

  sleep(12); // respect 5 req/min throttle
}

export function loginFlow() {
  // valid login
  const ok = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: JSON_HEADERS },
  );
  check(ok, {
    'login: status 200': (r) => r.status === 200,
    'login: token present': (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  // wrong password
  const bad = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: 'wrongpassword' }),
    { headers: JSON_HEADERS },
  );
  check(bad, {
    'login bad creds: status 401': (r) => r.status === 401,
  });

  // malformed body
  const malformed = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'not-an-email', password: 'x' }),
    { headers: JSON_HEADERS },
  );
  check(malformed, {
    'login malformed: status 400': (r) => r.status === 400,
  });

  sleep(1);
}
