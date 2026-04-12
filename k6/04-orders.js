/**
 * Load test: Order endpoints
 *
 *   POST /orders            — place an order (3-layer overselling prevention)
 *   GET  /orders            — list own orders
 *   GET  /orders/:id        — get single order
 *
 * Each VU registers its own account so orders are isolated per user.
 * The grocery item IDs are resolved in setup() and shared across all VUs.
 *
 * Stages:
 *   0→1m   : ramp to 20 VUs    (warm-up)
 *   1m→3m  : hold 20 VUs       (steady)
 *   3m→4m  : ramp to 50 VUs    (peak)
 *   4m→5m  : hold 50 VUs
 *   5m→6m  : ramp down
 *
 * Thresholds:
 *   - POST /orders p(95) < 1500ms  (write path hits DB + Redis)
 *   - GET  /orders p(95) < 500ms
 *   - error rate < 2%
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
  scenarios: {
    order_write: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 20 },
        { duration: '2m', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      exec: 'orderWriteFlow',
      gracefulRampDown: '15s',
    },
    order_read: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 0 },
      ],
      exec: 'orderReadFlow',
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:order_write}': ['p(95)<1500'],
    'http_req_duration{scenario:order_read}': ['p(95)<500'],
    http_req_failed: ['rate<0.02'],
  },
};

export function setup() {
  // Get admin token to fetch grocery item IDs
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: JSON_HEADERS },
  );
  if (loginRes.status !== 200) {
    throw new Error(`setup: admin login failed — ${loginRes.status} ${loginRes.body}`);
  }
  const adminToken = JSON.parse(loginRes.body).token;

  // Collect 10 item IDs with stock > 0 to use in orders
  const listRes = http.get(`${BASE_URL}/groceries?page=1&limit=10`, {
    headers: authHeaders(adminToken),
  });
  if (listRes.status !== 200) {
    throw new Error(`setup: grocery list failed — ${listRes.status}`);
  }
  const body = JSON.parse(listRes.body);
  const items = body.data ?? body.items ?? [];
  const itemIds = items.map((i) => i.id).filter(Boolean);

  if (itemIds.length === 0) {
    throw new Error('setup: no grocery items found — run pnpm seed:groceries first');
  }

  return { itemIds };
}

// Per-VU state: each VU gets its own user account and token
const vuTokens = {};
const vuOrderIds = {};

function ensureUserToken(vuId) {
  if (vuTokens[vuId]) return vuTokens[vuId];

  const email = `order_vu${vuId}_${Date.now()}@loadtest.com`;
  const password = 'LoadTest123!';

  const reg = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );
  if (reg.status !== 201) return null;

  const token = JSON.parse(reg.body).token;
  vuTokens[vuId] = token;
  return token;
}

export function orderWriteFlow(data) {
  const { itemIds } = data;
  const token = ensureUserToken(__VU);
  if (!token) { sleep(2); return; }

  const headers = authHeaders(token);
  const idempotencyKey = uuidv4();

  // Pick 1–3 random items
  const count = Math.floor(Math.random() * 3) + 1;
  const selected = [];
  for (let i = 0; i < count; i++) {
    const id = itemIds[Math.floor(Math.random() * itemIds.length)];
    if (!selected.find((s) => s.groceryItemId === id)) {
      selected.push({ groceryItemId: id, quantity: Math.floor(Math.random() * 3) + 1 });
    }
  }

  const orderRes = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({ items: selected }),
    {
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
    },
  );
  const placed = check(orderRes, {
    'POST /orders: status 201': (r) => r.status === 201,
    'POST /orders: has id': (r) => {
      try { return !!JSON.parse(r.body).id; } catch { return false; }
    },
  });

  // Store the first successful order id for the read flow
  if (placed && !vuOrderIds[__VU]) {
    try {
      vuOrderIds[__VU] = JSON.parse(orderRes.body).id;
    } catch { /* ignore */ }
  }

  // Replay same idempotency key — should return cached 201
  const replay = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({ items: selected }),
    {
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
    },
  );
  check(replay, {
    'POST /orders idempotency replay: status 201': (r) => r.status === 201,
  });

  // Bad request: empty items array
  const bad = http.post(
    `${BASE_URL}/orders`,
    JSON.stringify({ items: [] }),
    { headers },
  );
  check(bad, {
    'POST /orders empty items: status 400': (r) => r.status === 400,
  });

  sleep(1);
}

export function orderReadFlow(data) {
  const token = ensureUserToken(__VU);
  if (!token) { sleep(2); return; }
  const headers = authHeaders(token);

  // --- GET /orders ---
  const page = Math.floor(Math.random() * 3) + 1;
  const listRes = http.get(`${BASE_URL}/orders?page=${page}&limit=10`, { headers });
  check(listRes, {
    'GET /orders: status 200': (r) => r.status === 200,
  });

  // --- GET /orders/:id ---
  const orderId = vuOrderIds[__VU];
  if (orderId) {
    const single = http.get(`${BASE_URL}/orders/${orderId}`, { headers });
    check(single, {
      'GET /orders/:id: status 200': (r) => r.status === 200,
    });
  }

  // Bad UUID
  const bad = http.get(`${BASE_URL}/orders/not-a-uuid`, { headers });
  check(bad, {
    'GET /orders/bad-id: status 400': (r) => r.status === 400,
  });

  sleep(0.5);
}
