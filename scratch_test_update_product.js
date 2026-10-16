const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const pRes = await pool.query("SELECT id, restaurant_id, name, stock_quantity, buffer_quantity, status FROM products LIMIT 1");
  const prod = pRes.rows[0];
  console.log("Original:", prod);

  // Let's test updateProduct implementation from db.ts
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updateRes = await client.query(
      `
      UPDATE products SET
        stock_quantity = COALESCE($1, stock_quantity),
        buffer_quantity = COALESCE($2, buffer_quantity),
        status = COALESCE($3, status),
        updated_at = NOW()
      WHERE restaurant_id = $4 AND id = $5
      RETURNING *
      `,
      [55, 5, 'AVAILABLE', prod.restaurant_id, prod.id]
    );
    await client.query('COMMIT');
    console.log("Updated result:", {
      id: updateRes.rows[0].id,
      name: updateRes.rows[0].name,
      stock_quantity: updateRes.rows[0].stock_quantity,
      buffer_quantity: updateRes.rows[0].buffer_quantity,
      status: updateRes.rows[0].status
    });
  } finally {
    client.release();
  }

  const verify = await pool.query("SELECT id, name, stock_quantity, buffer_quantity, status FROM products WHERE id = $1", [prod.id]);
  console.log("Verified in DB:", verify.rows[0]);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
