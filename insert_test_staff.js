const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
const dbPool = new Pool({ connectionString: dbUrl });

async function insertStaff() {
  const hashedPassword = await bcrypt.hash('password123', 10);
  const restaurantId = '0cb737d7-4751-42dd-938b-409534903ac6'; // Novotel
  
  // Clean up any test staffs first
  await dbPool.query("DELETE FROM staffs WHERE email IN ('kitchen@novotel.com', 'waiter@novotel.com')");

  // Insert Kitchen Staff
  await dbPool.query(`
    INSERT INTO staffs (name, email, password, role, is_active, restaurant_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, ['Chef John', 'kitchen@novotel.com', hashedPassword, 'KITCHEN', true, restaurantId]);

  // Insert Waiter Staff
  await dbPool.query(`
    INSERT INTO staffs (name, email, password, role, is_active, restaurant_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, ['Waiter Bob', 'waiter@novotel.com', hashedPassword, 'WAITER', true, restaurantId]);

  console.log('Inserted test staffs successfully.');
  dbPool.end();
}

insertStaff().catch(console.error);
