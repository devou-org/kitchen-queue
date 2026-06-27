import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  // Test configuration: ramping up virtual users
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users over 30 seconds
    { duration: '1m', target: 50 },  // Spike to 50 concurrent users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1000ms
    http_req_failed: ['rate<0.01'],    // Error rate should be less than 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-restaurant-slug': 'testcafe',
};

// Setup function runs once before the load test starts
export function setup() {
  console.log(`Starting load test for restaurant: testcafe on ${BASE_URL}`);
  
  // Fetch available products to use in the order
  const res = http.get(`${BASE_URL}/api/products`, { headers: HEADERS });
  
  if (res.status !== 200) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }
  
  const body = JSON.parse(res.body);
  if (!body.success || !body.data || body.data.length === 0) {
    throw new Error('No products available for testcafe. Please add products before testing.');
  }

  // Filter only in-stock products
  const availableProducts = body.data.filter(p => p.stock_quantity > 0 || p.stock_quantity === null);
  
  if (availableProducts.length === 0) {
    console.warn('WARNING: All products are out of stock. The test might fail or get rejected by the API.');
  }

  return { products: availableProducts.length > 0 ? availableProducts : body.data };
}

// The main virtual user logic
export default function (data) {
  const products = data.products;
  
  // Pick 1-3 random products to order
  const numItems = randomIntBetween(1, 3);
  const items = [];
  
  for (let i = 0; i < numItems; i++) {
    const product = products[randomIntBetween(0, products.length - 1)];
    items.push({
      product_id: product.id,
      quantity: randomIntBetween(1, 2),
      price_at_purchase: Number(product.price),
      name: product.name
    });
  }

  // Build the order payload
  const orderPayload = {
    customer_name: `Load Tester ${randomString(5)}`,
    phone: `+9190000${randomIntBetween(10000, 99999)}`,
    party_size: randomIntBetween(1, 5).toString(),
    table_number: `Table ${randomIntBetween(1, 15)}`,
    notes: 'Automated load test order',
    items: items,
  };

  // 1. Submit the order
  const orderRes = http.post(`${BASE_URL}/api/orders`, JSON.stringify(orderPayload), { headers: HEADERS });

  // 2. Validate the response
  check(orderRes, {
    'is status 200': (r) => r.status === 200,
    'order created successfully': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
    'service not started check': (r) => r.status !== 403, // Fails if the service toggle is off
  });

  // Small delay to simulate user think-time between actions
  sleep(randomIntBetween(1, 3));
}
