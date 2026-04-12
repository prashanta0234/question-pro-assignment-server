/**
 * Load test: Public grocery endpoints (requires USER JWT)
 *
 *   GET /groceries          — list with pagination, search, sort
 *   GET /groceries/:id      — single item
 *
 * Setup phase logs in as admin to get a token (admin is also a valid user
 * for read endpoints). The same token is reused across all VUs/iterations.
 *
 * Stages:
 *   0→1m   : ramp to 100 VUs
 *   1m→4m  : hold 100 VUs    (sustained load)
 *   4m→5m  : ramp to 300 VUs (peak)
 *   5m→6m  : hold 300 VUs
 *   6m→7m  : ramp down
 *
 * Thresholds:
 *   - p(95) < 500ms
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
  stages: [
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 300 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

// Shared state set in setup(), injected into default()
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

  // Get a real item ID to use in single-item tests
  const list = http.get(`${BASE_URL}/groceries?page=1&limit=1`, {
    headers: authHeaders(token),
  });
  let itemId = null;
  if (list.status === 200) {
    const body = JSON.parse(list.body);
    const items = body.data ?? body.items ?? [];
    if (items.length > 0) itemId = items[0].id;
  }

  return { token, itemId };
}

const SEARCHES = ['milk', 'bread', 'juice', 'egg', 'butter', 'chicken', 'rice', 'oil'];
const SORT_BY = ['name', 'price', 'stock'];
const SORT_ORDER = ['ASC', 'DESC'];

export default function (data) {
  const { token, itemId } = data;
  const headers = authHeaders(token);

  // --- GET /groceries (list) ---
  const search = SEARCHES[Math.floor(Math.random() * SEARCHES.length)];
  const sortBy = SORT_BY[Math.floor(Math.random() * SORT_BY.length)];
  const sortOrder = SORT_ORDER[Math.floor(Math.random() * SORT_ORDER.length)];
  const page = Math.floor(Math.random() * 5) + 1;

  const listRes = http.get(
    `${BASE_URL}/groceries?page=${page}&limit=20&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
    { headers },
  );
  check(listRes, {
    'GET /groceries: status 200': (r) => r.status === 200,
    'GET /groceries: has data array': (r) => {
      try {
        const b = JSON.parse(r.body);
        return Array.isArray(b.data ?? b.items ?? b);
      } catch { return false; }
    },
  });

  // --- GET /groceries (no search — full list, cache path) ---
  const plainList = http.get(`${BASE_URL}/groceries?page=1&limit=20`, { headers });
  check(plainList, {
    'GET /groceries (cached): status 200': (r) => r.status === 200,
  });

  // --- GET /groceries/:id ---
  if (itemId) {
    const single = http.get(`${BASE_URL}/groceries/${itemId}`, { headers });
    check(single, {
      'GET /groceries/:id: status 200': (r) => r.status === 200,
      'GET /groceries/:id: has id field': (r) => {
        try { return !!JSON.parse(r.body).id; } catch { return false; }
      },
    });
  }

  // --- GET /groceries/:id (invalid uuid → 400) ---
  const bad = http.get(`${BASE_URL}/groceries/not-a-uuid`, { headers });
  check(bad, {
    'GET /groceries/bad-id: status 400': (r) => r.status === 400,
  });

  sleep(0.5);
}
