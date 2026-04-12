/**
 * Stress test: ramps all endpoint types simultaneously until the system
 * breaks or thresholds are breached.
 *
 * Pattern: spike → hold → spike higher → hold → teardown
 *
 *   0→2m   : ramp to 100 VUs  (warm-up)
 *   2m→5m  : hold 100 VUs     (baseline load)
 *   5m→7m  : ramp to 300 VUs  (medium stress)
 *   7m→10m : hold 300 VUs     (sustain stress)
 *  10m→12m : ramp to 600 VUs  (heavy stress — likely starts degrading)
 *  12m→14m : hold 600 VUs     (observe breaking point)
 *  14m→15m : ramp down
 *
 * Thresholds (intentionally lenient for stress test — goal is to observe,
 * not to pass):
 *   - p(99) < 5000ms
 *   - error rate < 10%
 *
 * Set env vars:
 *   ADMIN_EMAIL / ADMIN_PASSWORD
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, JSON_HEADERS, authHeaders } from './lib/helpers.js';

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin123!';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 300 },
    { duration: '3m', target: 300 },
    { duration: '2m', target: 600 },
    { duration: '2m', target: 600 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],
    http_req_failed: ['rate<0.10'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200) {
    throw new Error(`setup: login failed — ${res.status} ${res.body}`);
  }
  const token = JSON.parse(res.body).token;

  const list = http.get(`${BASE_URL}/groceries?page=1&limit=5`, {
    headers: authHeaders(token),
  });
  const body = JSON.parse(list.body);
  const items = body.data ?? body.items ?? [];
  const itemIds = items.map((i) => i.id).filter(Boolean);

  return { adminToken: token, itemIds };
}

const vuTokens = {};

function getToken(data) {
  if (vuTokens[__VU]) return vuTokens[__VU];

  // Register a new user per VU
  const email = `stress_vu${__VU}_${Date.now()}@loadtest.com`;
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password: 'StressTest1!' }),
    { headers: JSON_HEADERS },
  );
  if (res.status === 201) {
    vuTokens[__VU] = JSON.parse(res.body).token;
    return vuTokens[__VU];
  }

  // Fallback to admin token
  return data.adminToken;
}

export default function (data) {
  const { adminToken, itemIds } = data;
  const token = getToken(data);
  const headers = authHeaders(token);
  const adminHdrs = authHeaders(adminToken);

  // Roll dice to pick which endpoint to hit this iteration
  const roll = Math.random();

  if (roll < 0.10) {
    // Health check (10%)
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'stress health: 200': (r) => r.status === 200 });

  } else if (roll < 0.20) {
    // Login (10%)
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
      { headers: JSON_HEADERS },
    );
    check(res, { 'stress login: 200': (r) => r.status === 200 });

  } else if (roll < 0.40) {
    // Public grocery list (20%)
    const res = http.get(`${BASE_URL}/groceries?page=1&limit=20`, { headers });
    check(res, { 'stress grocery list: 200': (r) => r.status === 200 });

  } else if (roll < 0.50) {
    // Single grocery item (10%)
    if (itemIds.length > 0) {
      const id = itemIds[Math.floor(Math.random() * itemIds.length)];
      const res = http.get(`${BASE_URL}/groceries/${id}`, { headers });
      check(res, { 'stress grocery single: 200': (r) => r.status === 200 });
    }

  } else if (roll < 0.65) {
    // Place order (15%) — heaviest operation
    if (itemIds.length > 0) {
      const id = itemIds[Math.floor(Math.random() * itemIds.length)];
      const res = http.post(
        `${BASE_URL}/orders`,
        JSON.stringify({ items: [{ groceryItemId: id, quantity: 1 }] }),
        {
          headers: { ...headers, 'Idempotency-Key': uuidv4() },
        },
      );
      // 201 = placed, 409 = out of stock — both valid under stress
      check(res, {
        'stress order: 201 or 409': (r) => r.status === 201 || r.status === 409,
      });
    }

  } else if (roll < 0.75) {
    // List own orders (10%)
    const res = http.get(`${BASE_URL}/orders?page=1&limit=10`, { headers });
    check(res, { 'stress order list: 200': (r) => r.status === 200 });

  } else if (roll < 0.85) {
    // Admin: list groceries (10%)
    const res = http.get(`${BASE_URL}/admin/groceries?page=1&limit=20`, {
      headers: adminHdrs,
    });
    check(res, { 'stress admin list: 200': (r) => r.status === 200 });

  } else if (roll < 0.92) {
    // Admin: create grocery (7%)
    const res = http.post(
      `${BASE_URL}/admin/groceries`,
      JSON.stringify({
        name: `Stress Item ${__VU} ${Date.now()}`,
        description: 'k6 stress test item',
        price: 1.99,
        stock: 1000,
      }),
      { headers: adminHdrs },
    );
    check(res, { 'stress admin create: 201': (r) => r.status === 201 });

  } else {
    // Admin: inventory update on a known item (8%)
    if (itemIds.length > 0) {
      const id = itemIds[Math.floor(Math.random() * itemIds.length)];
      const res = http.patch(
        `${BASE_URL}/admin/groceries/${id}/inventory`,
        JSON.stringify({ stock: Math.floor(Math.random() * 500) + 500 }),
        { headers: adminHdrs },
      );
      check(res, { 'stress inventory update: 200': (r) => r.status === 200 });
    }
  }

  sleep(Math.random() * 0.5); // 0–500ms think time
}
