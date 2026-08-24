import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedTestData() {
  const restId = '3564690a-fdce-4338-9a9d-ca34b2e1ff36';

  console.log('Seeding rich test data for Tenant ID:', restId);

  // 1. Update/Ensure Restaurant settings
  await pool.query(
    `UPDATE restaurants SET 
       name = 'South Bite Coastal Kitchen',
       gst_type = 'REGULAR',
       gst_rate = 5.00,
       country_code = 'IN',
       state_code = 'KL',
       district = 'Kannur',
       city = 'Thalassery'
     WHERE id = $1`,
    [restId]
  );

  // 2. Ensure Menu Products
  const products = [
    { name: 'Thalassery Chicken Biryani', category: 'Main Course', price: 280, status: 'AVAILABLE', stock: 50, buffer: 10 },
    { name: 'Kallummakkaya Roast (Mussels)', category: 'Starters', price: 320, status: 'AVAILABLE', stock: 25, buffer: 5 },
    { name: 'Fish Curry Meals', category: 'Main Course', price: 220, status: 'AVAILABLE', stock: 40, buffer: 8 },
    { name: 'Nadan Malabar Porotta', category: 'Main Course', price: 25, status: 'AVAILABLE', stock: 200, buffer: 30 },
    { name: 'Chicken Ghee Roast', category: 'Starters', price: 340, status: 'AVAILABLE', stock: 15, buffer: 5 },
    { name: 'Elaneer Payasam (Tender Coconut)', category: 'Desserts', price: 140, status: 'LOW_STOCK', stock: 4, buffer: 5 },
    { name: 'Sulaimani Tea', category: 'Beverages', price: 30, status: 'AVAILABLE', stock: 100, buffer: 20 },
    { name: 'Fresh Kulukki Sarbath', category: 'Beverages', price: 60, status: 'AVAILABLE', stock: 60, buffer: 10 },
    { name: 'Prawns Fry (Karimeen Style)', category: 'Starters', price: 450, status: 'OUT_OF_STOCK', stock: 0, buffer: 5 }
  ];

  const productIds: { [name: string]: { id: string; price: number } } = {};

  for (const p of products) {
    const res = await pool.query(
      `INSERT INTO products (restaurant_id, name, category, price, status, stock_quantity, buffer_quantity, is_active, dietary_preference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'NON_VEG')
       ON CONFLICT (id) DO NOTHING
       RETURNING id, name, price`,
      [restId, p.name, p.category, p.price, p.status, p.stock, p.buffer]
    );

    if (res.rows.length > 0) {
      productIds[p.name] = { id: res.rows[0].id, price: Number(res.rows[0].price) };
    } else {
      const existing = await pool.query(`SELECT id, price FROM products WHERE restaurant_id = $1 AND name = $2 LIMIT 1`, [restId, p.name]);
      if (existing.rows.length > 0) {
        productIds[p.name] = { id: existing.rows[0].id, price: Number(existing.rows[0].price) };
      }
    }
  }

  console.log('Products configured:', Object.keys(productIds).length);

  // 3. Clear old test orders for this tenant to ensure clean statistics
  await pool.query(`DELETE FROM orders WHERE restaurant_id = $1`, [restId]);

  // 4. Generate Orders for the past 30 days
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date('2026-08-24');
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  let totalOrdersCount = 0;
  let totalRevenueCount = 0;

  const names = ['Anand Kumar', 'Riya Sharma', 'Rahul Nair', 'Sneha Menon', 'Vikas Patel', 'Walk-in Guest'];

  for (const businessDate of dates) {
    const isToday = businessDate === '2026-08-24';
    const isYesterday = businessDate === '2026-08-23';
    
    // Controlled order counts: Today = 35 orders, Yesterday = 28 orders
    const dayOrderCount = isToday ? 35 : (isYesterday ? 28 : Math.floor(Math.random() * 15) + 15);

    for (let j = 1; j <= dayOrderCount; j++) {
      totalOrdersCount++;
      const ticketNum = j;

      // Peak hours: 12-14 (Lunch), 19-21 (Dinner)
      const hours = [12, 12, 13, 13, 14, 19, 19, 20, 20, 21, 15, 18, 22];
      const hour = hours[Math.floor(Math.random() * hours.length)];
      const minute = Math.floor(Math.random() * 60);
      const createdAt = `${businessDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;

      // Status: 85% PAID, 10% CANCELLED, 5% PENDING
      const rand = Math.random();
      const status = rand < 0.85 ? 'PAID' : (rand < 0.95 ? 'CANCELLED' : 'PENDING');
      const paymentMethod = ['UPI', 'CASH', 'CARD'][Math.floor(Math.random() * 3)];
      const custName = names[Math.floor(Math.random() * names.length)];
      const custPhone = '98765432' + String(Math.floor(Math.random() * 90) + 10);

      // Pick items
      const itemKeys = Object.keys(productIds);
      const randomCount = Math.floor(Math.random() * 3) + 1;
      const selectedKeys = itemKeys.slice(0, randomCount);

      let subtotal = 0;
      const orderItems = selectedKeys.map(k => {
        const item = productIds[k];
        const qty = Math.floor(Math.random() * 3) + 1;
        const itemTotal = item.price * qty;
        subtotal += itemTotal;
        return { product_id: item.id, qty, price: item.price };
      });

      const gstRate = 5.00;
      const gstAmount = Math.round((subtotal * gstRate / 100) * 100) / 100;
      const totalPrice = subtotal + gstAmount;

      if (status === 'PAID') totalRevenueCount += totalPrice;

      const isPaidBool = status === 'PAID';
      const orderRes = await pool.query(
        `INSERT INTO orders (restaurant_id, ticket_number, customer_name, phone, status, is_paid, total_price, subtotal, gst_amount, gst_rate, gst_type, payment_method, business_date, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'REGULAR', $11, $12, $13)
         RETURNING id`,
        [restId, ticketNum, custName, custPhone, status, isPaidBool, totalPrice, subtotal, gstAmount, gstRate, paymentMethod, businessDate, createdAt]
      );

      const orderId = orderRes.rows[0].id;

      for (const item of orderItems) {
        await pool.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
           VALUES ($1, $2, $3, $4)`,
          [orderId, item.product_id, item.qty, item.price]
        );
      }
    }
  }

  // 5. Seed Holidays
  await pool.query(
    `INSERT INTO holidays (name, holiday_date, holiday_type, is_public_holiday, country_code, state_code, source)
     VALUES 
       ('Onam Festival / Thiruvonam', '2026-08-24', 'FESTIVAL', true, 'IN', 'KL', 'GOVT'),
       ('Sri Krishna Jayanti', '2026-08-25', 'RELIGIOUS', true, 'IN', 'KL', 'GOVT')
     ON CONFLICT DO NOTHING`
  );

  console.log(`Successfully seeded ${totalOrdersCount} total orders with ₹${Math.round(totalRevenueCount)} total paid revenue!`);
  process.exit(0);
}

seedTestData().catch(e => {
  console.error('Error seeding test data:', e);
  process.exit(1);
});
