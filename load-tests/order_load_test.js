import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ====================================================================
// 1. COMMAND LINE ARGUMENTS & ENV VARS
// ====================================================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SCENARIO = __ENV.SCENARIO || 'smoke';

// ====================================================================
// 2. CUSTOM METRICS
// ====================================================================
const orderDuration = new Trend('custom_order_processing_time');
const orderFailures = new Rate('custom_order_failure_rate');
const lockErrors = new Counter('custom_db_lock_errors');

// ====================================================================
// 3. K6 SCENARIOS CONFIGURATION
// ====================================================================
export const options = {
    scenarios: {
        [SCENARIO]: {
            ...({
                smoke: { executor: 'constant-vus', vus: 1, duration: '1m', exec: 'orderWorkflow' },
                load: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '2m', target: 50 }, { duration: '5m', target: 50 }, { duration: '2m', target: 0 }], exec: 'orderWorkflow' },
                stress: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '2m', target: 200 }, { duration: '5m', target: 200 }, { duration: '2m', target: 0 }], exec: 'orderWorkflow' },
                spike: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '10s', target: 500 }, { duration: '1m', target: 500 }, { duration: '10s', target: 0 }], exec: 'orderWorkflow' },
                soak: { executor: 'constant-vus', vus: 50, duration: '4h', exec: 'orderWorkflow' },
                race_condition: { executor: 'constant-vus', vus: 100, duration: '2m', exec: 'hotProductWorkflow' }
            })[SCENARIO]
        }
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],         
        http_req_duration: ['p(95)<500'],       
        custom_order_failure_rate: ['rate<0.01'], 
        custom_order_processing_time: ['p(95)<600'], 
    },
};

// ====================================================================
// 4. SETUP PHASE (Runs ONCE before the tests start)
// ====================================================================
export function setup() {
    // We fetch the REAL available products so we don't send fake UUIDs
    console.log(`Fetching available products from ${BASE_URL}...`);
    const res = http.get(`${BASE_URL}/api/products`);
    
    if (res.status !== 200) {
        console.error(`Failed to fetch products for load testing: returned ${res.status}`);
        return { products: [] };
    }

    let products = [];
    try {
        const body = JSON.parse(res.body);
        products = body.data || body; // Adjust based on your API response structure
    } catch (e) {
        console.error("Could not parse products:", res.body);
    }
    
    // Filter active/available products only
    const validProducts = products.filter(p => p.status === 'AVAILABLE' || p.stock_quantity > 0);
    
    if (validProducts.length === 0) {
        console.error("CRITICAL: No available products in the DB to test with!");
    } else {
        console.log(`Loaded ${validProducts.length} valid products for testing.`);
    }

    return { products: validProducts }; // Passed to the VU scripts
}

// ====================================================================
// 5. HELPER FUNCTIONS
// ====================================================================
function generateRandomUser() {
    return {
        customer_name: `Perf Tester ${Math.floor(Math.random() * 1000000)}`,
        phone: `+91${Math.floor(6000000000 + Math.random() * 3999999999)}`, 
    };
}

function buildOrderPayload(products, isHotProduct = false) {
    if (!products || products.length === 0) return null;

    const user = generateRandomUser();
    
    // Choose either a strictly single product, or a random one from DB
    const selectedProduct = isHotProduct ? products[0] : randomItem(products);
    const quantity = Math.floor(Math.random() * 2) + 1; 
    
    return JSON.stringify({
        customer_name: user.customer_name,
        phone: user.phone,
        total_price: Number(selectedProduct.price) * quantity,
        items: [{
            product_id: selectedProduct.id,
            quantity: quantity,
            price_at_purchase: Number(selectedProduct.price)
        }]
    });
}

const reqParams = {
    headers: { 'Content-Type': 'application/json' },
};

// ====================================================================
// 6. TEST EXECUTORS
// ====================================================================

export function orderWorkflow(data) {
    executeOrder(buildOrderPayload(data.products, false));
}

export function hotProductWorkflow(data) {
    executeOrder(buildOrderPayload(data.products, true)); // hits same product
}

function executeOrder(payload) {
    if (!payload) return sleep(1); // skip if setup failed

    const startTime = new Date().getTime();
    let orderRes = http.post(`${BASE_URL}/api/orders`, payload, reqParams);
    const duration = new Date().getTime() - startTime;

    orderDuration.add(duration);
    
    const isSuccess = check(orderRes, {
        'Order created successfully (200/201)': (r) => r.status === 200 || r.status === 201,
        'No 500 error': (r) => r.status !== 500,
        'Not 403 Service Offline': (r) => r.status !== 403, 
    });

    if (!isSuccess) {
        orderFailures.add(1);
        if (orderRes.body && orderRes.status === 403) {
            console.warn(`[!] API returned 403 (Likely "Service is Offline"). Go to Admin dashboard and turn the Queue ON!`);
        } else if (orderRes.body && (orderRes.body.includes('deadlock') || orderRes.body.includes('lock'))) {
            lockErrors.add(1);
        } else {
            console.error(`Order Failed (${orderRes.status}):`, orderRes.body);
        }
    } else {
        orderFailures.add(0);
    }

    sleep(Math.random() * 2 + 1); // 1-3 seconds think time so we don't spam instantly
}
