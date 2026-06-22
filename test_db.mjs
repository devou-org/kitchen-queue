import { pool } from './src/lib/db.js';

async function test() {
  const client = await pool.connect();
  try {
    const phone = '9980918073';
    const localTimezone = 'Asia/Kolkata';
    const restaurantId = null; // or simulate some uuid

    console.log("trying insert");
    const logRes = await client.query(`
      INSERT INTO otp_logs (phone, sent_at, restaurant_id)
      VALUES ($1, NOW() AT TIME ZONE $2, $3)
      RETURNING id
    `, [phone, localTimezone, restaurantId || null]);
    console.log("Inserted!", logRes.rows[0]);
  } catch(e) {
    console.error("PG ERROR", e);
  } finally {
    client.release();
    pool.end();
  }
}

test();
