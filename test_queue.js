const { neon } = require('@neondatabase/serverless');

const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function testConcurrentOrders() {
  try {
    const productRows = await sql`SELECT id FROM products LIMIT 1`;
    if (!productRows.length) return console.log('No products found');
    const productId = productRows[0].id;

    console.log('Creating 5 orders concurrently...');
    const orderPromises = Array.from({ length: 5 }).map((_, i) => (async () => {
      const name = `Test User ${i}`;
      const oRows = await sql`INSERT INTO orders (customer_name, phone, total_price, status) VALUES (${name}, '1234567890', 100, 'PENDING') RETURNING id, ticket_number`;
      const order = oRows[0];
      
      await sql`INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (${order.id}, ${productId}, 1, 100)`;
      
      return order;
    })());

    const result = await Promise.all(orderPromises);
    console.log('Orders created:', result.map(o => o.ticket_number));

    console.log('\nChecking positions for these tickets:');
    for (const o of result) {
      const posQuery = await sql`
        WITH active_ranks AS (
          SELECT id, RANK() OVER (ORDER BY ticket_number ASC) as pos
          FROM orders 
          WHERE status IN ('PENDING', 'PREPARING')
        )
        SELECT pos FROM active_ranks WHERE id = ${o.id}
      `;
      console.log(`Ticket #${o.ticket_number} position: ${posQuery[0]?.pos}`);
    }

  } catch (err) {
    console.error('Test failed:', err);
  }
}

testConcurrentOrders();
