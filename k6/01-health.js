/**
 * Load test: GET /health
 *
 * Stages:
 *   0→1 min  : ramp to 50 VUs  (warm-up)
 *   1→3 min  : hold 50 VUs      (steady load)
 *   3→4 min  : ramp to 200 VUs  (peak load)
 *   4→5 min  : hold 200 VUs     (sustain)
 *   5→6 min  : ramp down to 0
 *
 * Thresholds:
 *   - 95th percentile response time < 200 ms
 *   - Error rate < 1%
 */

import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, checkOk } from './lib/helpers.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  checkOk(res, 'health');
  sleep(0.5);
}
