/**
 * Load test: Admin grocery management endpoints
 *
 *   GET    /admin/groceries              — paginated list (includeDeleted support)
 *   GET    /admin/groceries/:id          — single item (including deleted)
 *   POST   /admin/groceries              — create item
 *   PATCH  /admin/groceries/:id          — update name/description/price
 *   PATCH  /admin/groceries/:id/inventory— set stock level
 *   DELETE /admin/groceries/:id          — soft-delete
 *
 * All routes require ADMIN JWT. Uses a single admin account across all VUs.
 * Each VU creates its own grocery items to avoid update conflicts.
 *
 * Stages:
 *   0→30s : ramp to 10 VUs
 *   30s→3m: hold 10 VUs
 *   3m→4m : ramp to 30 VUs
 *   4m→5m : hold 30 VUs
 *   5m→6m : ramp down
 *
 * Thresholds:
 *   - write ops (create/update/delete) p(95) < 1000ms
 *   - read ops p(95) < 400ms
 *   - error rate < 1%
 *
 * Set env vars:
 *   ADMIN_EMAIL / ADMIN_PASSWORD
 */

import http from 'k6/http';
import { sleep, check } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from './lib/helpers.js';

const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@gmail.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Admin123!';

export const options = {
  scenarios: {
    admin_read: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m30s', target: 10 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 30 },
        { duration: '30s', target: 0 },
      ],
      exec: 'adminReadFlow',
      gracefulRampDown: '10s',
    },
    admin_write: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 5 },
        { duration: '2m30s', target: 5 },
        { duration: '1m', target: 15 },
        { duration: '1m', target: 15 },
        { duration: '30s', target: 0 },
      ],
      exec: 'adminWriteFlow',
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    'http_req_duration{scenario:admin_read}': ['p(95)<400'],
    'http_req_duration{scenario:admin_write}': ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200) {
    throw new Error(`setup: admin login failed — ${res.status} ${res.body}`);
  }
  const token = JSON.parse(res.body).token;

  // Get a real item ID for read tests
  const list = http.get(`${BASE_URL}/admin/groceries?page=1&limit=1`, {
    headers: authHeaders(token),
  });
  let seedItemId = null;
  if (list.status === 200) {
    const body = JSON.parse(list.body);
    const items = body.data ?? body.items ?? [];
    if (items.length > 0) seedItemId = items[0].id;
  }

  return { token, seedItemId };
}

// Per-VU items created in write flow, reused within same VU
const vuItems = {};

export function adminReadFlow(data) {
  const { token, seedItemId } = data;
  const headers = authHeaders(token);

  // --- GET /admin/groceries ---
  const searches = ['milk', 'bread', 'butter', ''];
  const search = searches[Math.floor(Math.random() * searches.length)];
  const includeDeleted = Math.random() > 0.8;
  const page = Math.floor(Math.random() * 10) + 1;

  const url = `${BASE_URL}/admin/groceries?page=${page}&limit=20`
    + (search ? `&search=${search}` : '')
    + `&includeDeleted=${includeDeleted}`;

  const listRes = http.get(url, { headers });
  check(listRes, {
    'GET /admin/groceries: status 200': (r) => r.status === 200,
    'GET /admin/groceries: has data': (r) => {
      try {
        const b = JSON.parse(r.body);
        return Array.isArray(b.data ?? b.items ?? b);
      } catch { return false; }
    },
  });

  // --- GET /admin/groceries/:id ---
  if (seedItemId) {
    const single = http.get(`${BASE_URL}/admin/groceries/${seedItemId}`, { headers });
    check(single, {
      'GET /admin/groceries/:id: status 200': (r) => r.status === 200,
    });
  }

  // Bad ID
  const bad = http.get(`${BASE_URL}/admin/groceries/not-a-uuid`, { headers });
  check(bad, {
    'GET /admin/groceries/bad-id: status 400': (r) => r.status === 400,
  });

  sleep(0.3);
}

export function adminWriteFlow(data) {
  const { token } = data;
  const headers = authHeaders(token);
  const ts = Date.now();

  // --- POST /admin/groceries ---
  const createRes = http.post(
    `${BASE_URL}/admin/groceries`,
    JSON.stringify({
      name: `Load Test Item VU${__VU} ${ts}`,
      description: 'Created by k6 load test',
      price: parseFloat((Math.random() * 50 + 0.99).toFixed(2)),
      stock: Math.floor(Math.random() * 500) + 50,
    }),
    { headers },
  );
  const created = check(createRes, {
    'POST /admin/groceries: status 201': (r) => r.status === 201,
    'POST /admin/groceries: has id': (r) => {
      try { return !!JSON.parse(r.body).id; } catch { return false; }
    },
  });

  let itemId = null;
  if (created) {
    try { itemId = JSON.parse(createRes.body).id; } catch { /* ignore */ }
    vuItems[__VU] = itemId;
  }

  // Validation error: missing required fields
  const invalid = http.post(
    `${BASE_URL}/admin/groceries`,
    JSON.stringify({ name: '' }),
    { headers },
  );
  check(invalid, {
    'POST /admin/groceries invalid: status 400': (r) => r.status === 400,
  });

  if (!itemId && vuItems[__VU]) {
    itemId = vuItems[__VU];
  }

  if (itemId) {
    // --- PATCH /admin/groceries/:id ---
    const updateRes = http.patch(
      `${BASE_URL}/admin/groceries/${itemId}`,
      JSON.stringify({ price: parseFloat((Math.random() * 50 + 1).toFixed(2)) }),
      { headers },
    );
    check(updateRes, {
      'PATCH /admin/groceries/:id: status 200': (r) => r.status === 200,
    });

    // --- PATCH /admin/groceries/:id/inventory ---
    const stockRes = http.patch(
      `${BASE_URL}/admin/groceries/${itemId}/inventory`,
      JSON.stringify({ stock: Math.floor(Math.random() * 1000) }),
      { headers },
    );
    check(stockRes, {
      'PATCH /admin/groceries/:id/inventory: status 200': (r) => r.status === 200,
    });

    // Inventory validation: negative stock not allowed
    const badStock = http.patch(
      `${BASE_URL}/admin/groceries/${itemId}/inventory`,
      JSON.stringify({ stock: -1 }),
      { headers },
    );
    check(badStock, {
      'PATCH inventory negative: status 400': (r) => r.status === 400,
    });

    // --- DELETE /admin/groceries/:id ---
    const deleteRes = http.del(
      `${BASE_URL}/admin/groceries/${itemId}`,
      null,
      { headers },
    );
    check(deleteRes, {
      'DELETE /admin/groceries/:id: status 200': (r) => r.status === 200,
    });

    // Confirm double-delete returns 404
    const del2 = http.del(
      `${BASE_URL}/admin/groceries/${itemId}`,
      null,
      { headers },
    );
    check(del2, {
      'DELETE already-deleted: status 404': (r) => r.status === 404,
    });

    vuItems[__VU] = null; // cleared after delete
  }

  sleep(1);
}
