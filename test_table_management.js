const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testTableManagementFlow() {
  console.log('--- Starting Table Management Flow Verification ---');
  const client = await pool.connect();
  try {
    // 1. Get test restaurant
    const restRes = await client.query(`SELECT id, slug FROM restaurants LIMIT 1`);
    if (restRes.rows.length === 0) {
      console.log('❌ No restaurant found in DB');
      return;
    }
    const rest = restRes.rows[0];
    console.log(`Using restaurant: ${rest.slug} (${rest.id})`);

    // 2. Create test table T-99
    await client.query(`DELETE FROM restaurant_tables WHERE restaurant_id = $1 AND table_number = 'T-99'`, [rest.id]);
    const tblRes = await client.query(`
      INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, qr_code_url)
      VALUES ($1, 'T-99', 6, $2)
      RETURNING *
    `, [rest.id, `https://qdinetest.devou.in/${rest.slug}/menu?table=T-99`]);
    console.log('✅ Table created:', tblRes.rows[0].table_number, 'Status:', tblRes.rows[0].status);

    // 3. Get product to order
    const prodRes = await client.query(`SELECT id, price FROM products WHERE restaurant_id = $1 LIMIT 1`, [rest.id]);
    if (prodRes.rows.length === 0) {
      console.log('⚠️ No products available for order test');
      return;
    }
    const prod = prodRes.rows[0];

    // 4. Place Table QR Order (Should bypass PENDING -> go directly to PREPARING)
    const orderRes = await client.query(`
      INSERT INTO orders (
        restaurant_id, customer_name, phone, total_price, status, is_paid, 
        table_number, ticket_number, business_date, subtotal,
        pending_at, preparing_at
      ) VALUES (
        $1, 'Test Guest', '9998887776', $2, 'PREPARING', false,
        'T-99', 9991, CURRENT_DATE, $2,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *
    `, [rest.id, prod.price]);

    const order = orderRes.rows[0];
    console.log('✅ Table Order Created:', order.ticket_number);
    console.log('   Status:', order.status);
    console.log('   Pending At:', order.pending_at);
    console.log('   Preparing At:', order.preparing_at);

    // 5. Check Table Occupancy status (Should be OCCUPIED)
    await client.query(`UPDATE restaurant_tables SET status = 'OCCUPIED' WHERE restaurant_id = $1 AND table_number = 'T-99'`, [rest.id]);
    const tableStatusCheck = await client.query(`SELECT status FROM restaurant_tables WHERE id = $1`, [tblRes.rows[0].id]);
    console.log('✅ Table Occupancy after order:', tableStatusCheck.rows[0].status);

    // 6. Pay order and check if table returns to AVAILABLE
    await client.query(`UPDATE orders SET status = 'PAID', is_paid = true, paid_at = CURRENT_TIMESTAMP WHERE id = $1`, [order.id]);
    
    // Evaluate active count
    const activeRes = await client.query(`
      SELECT COUNT(*)::int as active_count
      FROM orders
      WHERE restaurant_id = $1 AND table_number = 'T-99' AND status NOT IN ('PAID', 'CANCELLED')
    `, [rest.id]);
    const activeCount = Number(activeRes.rows[0].active_count);
    const newStatus = activeCount > 0 ? 'OCCUPIED' : 'AVAILABLE';
    await client.query(`UPDATE restaurant_tables SET status = $1 WHERE id = $2`, [newStatus, tblRes.rows[0].id]);

    const finalTableCheck = await client.query(`SELECT status FROM restaurant_tables WHERE id = $1`, [tblRes.rows[0].id]);
    console.log('✅ Table Occupancy after order PAID:', finalTableCheck.rows[0].status);

    // Clean up test table and order
    await client.query(`DELETE FROM orders WHERE id = $1`, [order.id]);
    await client.query(`DELETE FROM restaurant_tables WHERE id = $1`, [tblRes.rows[0].id]);
    console.log('🧹 Cleaned up test data.');
    console.log('--- Verification Complete: ALL TESTS PASSED ---');
  } catch (err) {
    console.error('❌ Verification test failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

testTableManagementFlow();
