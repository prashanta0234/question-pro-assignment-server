import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api/v1';

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Register a user and return { token, userId }.
 * Uses a unique email per VU+iteration to avoid 409 conflicts.
 */
export function registerAndLogin(suffix) {
  const email = `loadtest_${suffix}_${Date.now()}@example.com`;
  const password = 'LoadTest123!';

  const reg = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );

  if (reg.status !== 201) {
    return null;
  }

  return JSON.parse(reg.body);
}

/**
 * Login with given credentials, return token string or null.
 */
export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: JSON_HEADERS },
  );
  if (res.status !== 200) return null;
  return JSON.parse(res.body).token;
}

/**
 * Fetch first page of public groceries and return the first item id, or null.
 */
export function getFirstGroceryId(token) {
  const res = http.get(`${BASE_URL}/groceries?page=1&limit=1`, {
    headers: authHeaders(token),
  });
  if (res.status !== 200) return null;
  const body = JSON.parse(res.body);
  const items = body.data ?? body.items ?? body;
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0].id;
}

export function checkOk(res, label) {
  return check(res, {
    [`${label} status 200`]: (r) => r.status === 200,
    [`${label} has body`]: (r) => r.body && r.body.length > 0,
  });
}

export function checkCreated(res, label) {
  return check(res, {
    [`${label} status 201`]: (r) => r.status === 201,
    [`${label} has body`]: (r) => r.body && r.body.length > 0,
  });
}

export function checkStatus(res, status, label) {
  return check(res, {
    [`${label} status ${status}`]: (r) => r.status === status,
  });
}
