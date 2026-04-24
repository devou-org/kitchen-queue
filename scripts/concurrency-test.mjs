// Run with: node scripts/concurrency-test.mjs
const BASE_URL = 'http://localhost:3000';


async function runTest() {
  console.log('🚀 Starting Concurrency & Consistency Test...\n');

  // 1. Fetch Products
  console.log('--- Step 1: Fetching Products ---');
  const productsRes = await fetch(`${BASE_URL}/api/products`, {
    headers: { 'x-test-bypass': 'true' }
  });
  const productsJson = await productsRes.json();
  const products = productsJson.data || [];
  
  const targetProduct = products.find(p => p.name === 'Double Chocolate Brownie');
  const nachos = products.find(p => p.name === 'Loaded Nachos');

  if (!targetProduct) {
    console.error('❌ Could not find "Double Chocolate Brownie" for test.');
    process.exit(1);
  }

  const initialStock = targetProduct.stock_quantity;
  console.log(`Found: ${targetProduct.name} (Stock: ${initialStock}), ${nachos.name} (Stock: ${nachos.stock_quantity})`);

  // 2. Launch Concurrent Orders
  // We'll launch 10 concurrent orders of 3 units each.
  // With stock = 20, exactly 6 should succeed (18 total), and 4 should fail.
  const qtyPerOrder = 3;
  const numOrders = 10;
  const expectedSuccesses = Math.floor(initialStock / qtyPerOrder);

  console.log(`\n--- Step 2: Launching ${numOrders} concurrent orders for ${targetProduct.name} (${qtyPerOrder} units each, Stock: ${initialStock}) ---`);
  
  const orderPromises = Array.from({ length: numOrders }).map((_, i) => {
    return fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-test-bypass': 'true'
      },
      body: JSON.stringify({
        customer_name: `Concurrent User ${i + 1}`,
        phone: `+91900000000${i}`,
        items: [{
          product_id: targetProduct.id,
          product_name: targetProduct.name,
          quantity: qtyPerOrder,
          price_at_purchase: targetProduct.price
        }]
      })
    }).then(r => r.json());
  });

  const results = await Promise.all(orderPromises);
  const successes = results.filter(r => r.success);
  const failures = results.filter(r => !r.success);

  console.log(`✅ Successful orders: ${successes.length} (Total units reserved: ${successes.length * qtyPerOrder})`);
  console.log(`❌ Failed orders: ${failures.length} (Reason for first failure: ${failures[0]?.error})`);

  if (successes.length === expectedSuccesses) {
    console.log('🏆 CONCURRENCY CHECK PASSED: Stock was correctly contested and limited.');
  } else {
    console.warn(`⚠️ CONCURRENCY CHECK ANOMALY: Expected ${expectedSuccesses} successes based on stock of ${initialStock}, but got ${successes.length}.`);
  }

  // 3. Test Additional Items (Consistency)
  if (successes.length > 0) {
    const firstOrderId = successes[0].data.id;
    console.log(`\n--- Step 3: Adding items to Order #${successes[0].data.ticket_number} ---`);
    
    // Concurrent addition of 2 Loaded Nachos (from different simulated actions)
    const addPromises = [1, 1].map((qty, i) => {
       // We fetch the current order first to simulate the frontend incrementing the cart
       return fetch(`${BASE_URL}/api/orders/${firstOrderId}`, {
          headers: { 'x-test-bypass': 'true' }
       })
        .then(r => r.json())
        .then(current => {
           if (!current.data || !current.data.items) {
              console.error('❌ Step 3: Could not fetch order data. Response:', JSON.stringify(current));
              return { success: false };
           }
           const items = current.data.items.map(item => ({
              product_id: item.product_id,
              quantity: item.quantity + qty, // Add one more
              price_at_purchase: item.price_at_purchase
           }));
           // Also add a new item
           items.push({
              product_id: nachos.id,
              quantity: 1,
              price_at_purchase: nachos.price
           });

           return fetch(`${BASE_URL}/api/orders/${firstOrderId}`, {
              method: 'PUT',
              headers: { 
                 'Content-Type': 'application/json',
                 'x-test-bypass': 'true'
              },
              body: JSON.stringify({ items })
           }).then(r => r.json());
        });
    });

    const addResults = await Promise.all(addPromises);
    console.log(`Added results: ${addResults.map(r => r.success ? 'Success' : 'Fail').join(', ')}`);
    if (addResults.every(r => r.success)) {
        console.log('✅ CONSISTENCY CHECK: Additional items added.');
    }
  }

  console.log('\n--- EXPECTED RESULTS ---');
  console.log(`1. Inventory Summary: Should show ${successes.length * qtyPerOrder} Double Chocolate Brownies sold (Revenue: ₹${(successes.length * qtyPerOrder * targetProduct.price).toFixed(2)})`);
  console.log('2. Kitchen Snapshot: Should show the 6 successful orders in PENDING status.');
  console.log('3. Live Notifications: Admin dashboard should have flashed 6 times.');
  console.log('4. Stock Status: Double Chocolate Brownie should have 2 left (or LOW_STOCK if buffer is 5).');

  console.log('\n✨ Test Complete. Check your Admin Dashboard for real-time updates!');
}

runTest().catch(console.error);
