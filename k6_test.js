import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up to 20 users
    { duration: '1m', target: 20 },  // stay at 20 users
    { duration: '20s', target: 0 },  // ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

const BASE_URL = 'http://localhost:3000';

export default function () {
  // Test 1: Fetch products List
  const productsRes = http.get(`${BASE_URL}/api/products`);
  check(productsRes, {
    'status is 200': (r) => r.status === 200,
    'has products': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(1);

  // Test 2: Fetch current queue status
  const queueRes = http.get(`${BASE_URL}/api/queue/current`);
  check(queueRes, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
